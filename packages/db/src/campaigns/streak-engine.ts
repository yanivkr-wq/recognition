/**
 * Streak engine — ledger-derived (NOT flag-driven).
 *
 * Per SCHEMA.md §13 invariant 6: "Streak engine is purely derivable from
 * task_completion + long_term_progress filtered by undone_at IS NULL and
 * approval_status IN ('auto_approved','approved'). campaign_enrollment.
 * current_streak is a cache, recomputable from scratch by the daily-reset
 * cron's logic if ever corrupted."
 *
 * BUILD-PLAN §"Phase 7" exit criterion: "Retroactive undo: Lia has
 * streak=4. Lia undoes day 3 today (day 5). On next daily-reset
 * evaluation, streak should be 0 (broken on day 3 from the perspective
 * of derivation)."
 *
 * Algorithm — chain-from-first-active-day model:
 *
 *   1. Determine evaluation window = [campaign.start_date, min(asOfDate, end_date)].
 *   2. For each day in the window, derive a per-day boolean "active"
 *      from task_completion + long_term_progress rows for the campaign's
 *      feeding task templates.
 *   3. Find the first active day in the window. If none → streak = 0.
 *   4. Walk forward from the first active day. Each step:
 *        active                                   → chain continues
 *        missing AND freezes_remaining > 0        → consume freeze, continue
 *        missing AND freezes_remaining = 0        → CHAIN BROKEN — streak = 0
 *   5. If the walk reaches asOfDate without breaking, streak = chain length.
 *
 * Why "0 on any break inside the campaign window" rather than "chain
 * length from the most recent break":
 *   - Matches the BUILD-PLAN exit criterion above (retroactive undo of
 *     day 3 zeros the streak even with days 4-5 active).
 *   - Easier kid mental model: "if I miss a day without a freeze, my
 *     streak goes to zero for this campaign."
 *   - Encourages the kid to engage every day, not just at the end.
 *
 * Why "find first active day" rather than "walk from campaign start":
 *   - A kid who joins the campaign late (or whose admin enrolled them
 *     mid-campaign) shouldn't have a phantom break from start_date to
 *     their first activity. Their streak starts when they start.
 *   - With freezes_allowed = 0 (a strict campaign), a kid who started
 *     day 3 in a 5-day campaign still gets streak = 3 if they do days
 *     3, 4, 5. The campaign target (e.g. 5 days) just won't be reachable.
 *
 * Concurrency: the engine is read-only (the daily-reset cron is the
 * writer, calling this function and then updating campaign_enrollment).
 * The caller's transaction provides snapshot isolation for the read.
 *
 * Edge cases handled:
 *   - asOfDate before campaign start_date         → returns streak = 0.
 *   - Campaign archived                            → caller skips; engine
 *                                                    doesn't filter (defense
 *                                                    in depth at the cron level).
 *   - Wrong household for kid                      → caller filters; engine
 *                                                    assumes inputs are valid.
 */

import type { PoolClient } from 'pg';

export interface EvaluateStreakInput {
  kidId: string;
  campaignId: string;
  /** "Today" from the engine's perspective. Defaults to the household TZ's
   *  current date when the daily-reset cron fires. */
  asOfDate: string; // YYYY-MM-DD
}

export interface EvaluateStreakResult {
  currentStreak: number;
  freezesUsed: number;
  /** True iff currentStreak just reached/exceeded streak_target_days AND
   *  the enrollment row's completed_at is still null. Caller posts bonus
   *  + badge + writes completed_at when this flag flips. */
  completedNow: boolean;
  /** Cap-friendly diagnostic for tests + the kid UI: the absolute target
   *  the kid is trying to hit. */
  targetDays: number;
  /** True iff the chain broke between first active day and asOfDate. The
   *  daily-reset cron uses this to fire a `streak_broken` notification
   *  event once when the cache shows a non-zero prior streak. */
  brokeNow: boolean;
}

interface CampaignRow {
  start_date: string;
  end_date: string;
  streak_target_days: number;
  streak_freezes_allowed: number;
  streak_per_day_threshold: number | null;
  completed_at: Date | null;
}

interface DayRow {
  day: string; // YYYY-MM-DD
}

export async function evaluateStreak(
  client: PoolClient,
  input: EvaluateStreakInput,
): Promise<EvaluateStreakResult> {
  // 1. Load the campaign + enrollment state.
  const cRes = await client.query<CampaignRow>(
    `SELECT
       c.start_date::text                 AS start_date,
       c.end_date::text                   AS end_date,
       c.streak_target_days               AS streak_target_days,
       c.streak_freezes_allowed           AS streak_freezes_allowed,
       c.streak_per_day_threshold         AS streak_per_day_threshold,
       e.completed_at                     AS completed_at
     FROM campaign c
     JOIN campaign_enrollment e ON e.campaign_id = c.id AND e.kid_id = $2
     WHERE c.id = $1 AND c.kind = 'streak'`,
    [input.campaignId, input.kidId],
  );
  const camp = cRes.rows[0];
  if (!camp) {
    // No enrollment or campaign is total-kind — degrade to "no streak".
    return {
      currentStreak: 0,
      freezesUsed: 0,
      completedNow: false,
      targetDays: 0,
      brokeNow: false,
    };
  }

  const startDate = camp.start_date;
  const endDate = camp.end_date;
  const targetDays = camp.streak_target_days ?? 0;
  const freezesAllowed = camp.streak_freezes_allowed;
  const perDayThreshold = camp.streak_per_day_threshold;
  const alreadyCompleted = camp.completed_at != null;

  // Clamp asOfDate to the campaign window. Past-end means "evaluate at end".
  const windowEnd = input.asOfDate > endDate ? endDate : input.asOfDate;
  if (windowEnd < startDate) {
    return {
      currentStreak: 0,
      freezesUsed: 0,
      completedNow: false,
      targetDays,
      brokeNow: false,
    };
  }

  // 2. Pull all active days for this kid within the window across all
  //    feeding templates. The query unions:
  //      - task_completion rows (for daily templates) — one "day" per row.
  //      - long_term_progress rows (for long-term templates), grouped by
  //        date with the per_day_threshold gate applied.
  //    The result is the set of dates where the kid had qualifying activity.
  const activeRes = await client.query<DayRow>(
    `WITH feeding AS (
       SELECT template_id, tt.kind
         FROM campaign_feeding_task cft
         JOIN task_template tt ON tt.id = cft.template_id
        WHERE cft.campaign_id = $1
     ),
     daily_days AS (
       SELECT DISTINCT tc.completion_date::text AS day
         FROM task_completion tc
         JOIN task_assignment ta ON ta.id = tc.assignment_id
         JOIN feeding f ON f.template_id = ta.template_id
        WHERE tc.kid_id = $2
          AND tc.undone_at IS NULL
          AND tc.approval_status IN ('auto_approved', 'approved')
          AND tc.completion_date BETWEEN $3::date AND $4::date
          AND f.kind = 'daily'
     ),
     long_term_days AS (
       SELECT lp.progress_date::text AS day
         FROM long_term_progress lp
         JOIN task_assignment ta ON ta.id = lp.assignment_id
         JOIN feeding f ON f.template_id = ta.template_id
        WHERE lp.kid_id = $2
          AND lp.undone_at IS NULL
          AND lp.approval_status IN ('auto_approved', 'approved')
          AND lp.progress_date BETWEEN $3::date AND $4::date
          AND f.kind = 'long_term'
        GROUP BY lp.progress_date
       HAVING (
         $5::int IS NULL
         OR SUM(lp.quantity) >= $5::int
       )
     )
     SELECT day FROM daily_days
     UNION
     SELECT day FROM long_term_days`,
    [input.campaignId, input.kidId, startDate, windowEnd, perDayThreshold],
  );
  const activeDays = new Set<string>(activeRes.rows.map((r) => r.day));

  // 3. Find first active day. If none in window, streak = 0.
  const allDays = enumerateDates(startDate, windowEnd);
  const firstActiveIdx = allDays.findIndex((d) => activeDays.has(d));
  if (firstActiveIdx === -1) {
    return {
      currentStreak: 0,
      freezesUsed: 0,
      completedNow: false,
      targetDays,
      brokeNow: false,
    };
  }

  // 4. Walk forward from first active day to windowEnd. Each step:
  //    active → continue. Missing → consume freeze; if no freeze left,
  //    the chain is broken — streak = 0.
  let freezesUsed = 0;
  let broken = false;
  for (let i = firstActiveIdx; i < allDays.length; i++) {
    const day = allDays[i]!;
    if (activeDays.has(day)) continue;
    // Missing day. Try freeze.
    if (freezesUsed < freezesAllowed) {
      freezesUsed += 1;
      continue;
    }
    broken = true;
    break;
  }

  const currentStreak = broken
    ? 0
    : allDays.length - firstActiveIdx; // chain length from first active day through windowEnd

  const completedNow =
    !alreadyCompleted && targetDays > 0 && currentStreak >= targetDays;

  // brokeNow distinguishes "broken just now" from "chain not yet started".
  // Used by the daily-reset cron to fire `streak_broken` ONCE per break.
  // The cron compares against the cached enrollment.current_streak — that's
  // the "did the cache go from > 0 to 0?" check.
  const brokeNow = broken;

  return { currentStreak, freezesUsed, completedNow, targetDays, brokeNow };
}

/** Inclusive YYYY-MM-DD enumeration. Pure JS — no Postgres round-trip. */
function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  // Parse as UTC midnight so day arithmetic is timezone-agnostic — the
  // input strings are already IL-date strings from the cron's perspective.
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}
