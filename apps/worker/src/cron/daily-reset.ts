/**
 * Daily reset — Phase 7 cron job (00:00 Asia/Jerusalem).
 *
 * Three responsibilities, all idempotent:
 *
 *   1. Streak engine re-evaluation. For every active streak enrollment,
 *      re-derive the streak as of YESTERDAY (the day that just ended at
 *      midnight). Update cache fields + fire notification events on
 *      state transitions:
 *        - cache.current_streak > 0 AND new=0 → streak_broken
 *        - new freezes_used > cached freezes_used → streak_freeze_used
 *        - completedNow → fan out the same campaign-completion side
 *          effects as processCompletionForCampaigns (bonus + badge +
 *          campaign_completed event + sibling_badge_earned for siblings)
 *
 *   2. Window close. Any active enrollment whose campaign.end_date is
 *      before today gets marked completed_kind='incomplete' (no bonus,
 *      no badge) and emits a campaign_completed bell event with
 *      incomplete payload. The BUILD-PLAN exit criterion: "Yael only
 *      reads 40 pages by day 60 → 01:00 cron marks completed_kind=
 *      'incomplete'." Sub-7d folds the 01:00 close into the same 00:00
 *      reset to keep the cron count lean — semantically identical.
 *
 *   3. Yearly birthday badge. For each non-archived kid whose birthdate
 *      (month+day) matches today and who has NOT yet earned the household's
 *      birthday badge for the current year, INSERT kid_badge with
 *      awarded_for_year=YYYY + a campaign_completed-style notification.
 *      Birthday badge identified by title_en='Birthday' (seeded convention).
 *
 * The function returns counters so the registry log line is meaningful.
 */

import { Pool, type PoolClient } from 'pg';
import { ledgerPost } from '@reco/db';
import { evaluateStreak } from '@reco/db';
import { logger } from '../logger';

interface DailyResetCounts {
  streakEvaluated: number;
  streakCompleted: number;
  streakBroken: number;
  freezesUsed: number;
  windowClosed: number;
  birthdayAwarded: number;
  errors: number;
}

export async function runDailyReset(pool: Pool): Promise<DailyResetCounts> {
  const counts: DailyResetCounts = {
    streakEvaluated: 0,
    streakCompleted: 0,
    streakBroken: 0,
    freezesUsed: 0,
    windowClosed: 0,
    birthdayAwarded: 0,
    errors: 0,
  };

  const client = await pool.connect();
  try {
    // Today + yesterday in IL date.
    const dateRes = await client.query<{
      today: string;
      yesterday: string;
      year: number;
    }>(
      `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text     AS today,
              ((now() AT TIME ZONE 'Asia/Jerusalem')::date - 1)::text AS yesterday,
              EXTRACT(year FROM (now() AT TIME ZONE 'Asia/Jerusalem')::date)::int AS year`,
    );
    const { today, yesterday, year } = dateRes.rows[0]!;

    // ── 1. Streak evaluation ───────────────────────────────────────────────
    interface StreakEnrollmentRow {
      enrollment_id: string;
      campaign_id: string;
      kid_id: string;
      household_id: string;
      prior_current_streak: number;
      prior_freezes_used: number;
      bonus_coins: number;
      badge_id: string | null;
    }
    const streakRows = await client.query<StreakEnrollmentRow>(
      `SELECT e.id              AS enrollment_id,
              c.id              AS campaign_id,
              e.kid_id          AS kid_id,
              e.household_id    AS household_id,
              e.current_streak  AS prior_current_streak,
              e.freezes_used    AS prior_freezes_used,
              c.bonus_coins     AS bonus_coins,
              c.badge_id        AS badge_id
         FROM campaign_enrollment e
         JOIN campaign c ON c.id = e.campaign_id
        WHERE c.kind = 'streak'
          AND c.archived_at IS NULL
          AND e.completed_at IS NULL
          AND c.start_date <= $1::date
          AND c.end_date   >= $1::date`,
      [yesterday], // evaluate the day that just ended
    );

    for (const e of streakRows.rows) {
      try {
        await client.query('BEGIN');
        const evalRes = await evaluateStreak(client, {
          kidId: e.kid_id,
          campaignId: e.campaign_id,
          asOfDate: yesterday,
        });
        counts.streakEvaluated += 1;

        // Update cache fields.
        await client.query(
          `UPDATE campaign_enrollment
              SET current_streak           = $1,
                  longest_streak           = GREATEST(longest_streak, $1),
                  freezes_used             = $2,
                  last_streak_advance_date = CASE WHEN $1 > 0 THEN $3::date ELSE last_streak_advance_date END
            WHERE id = $4`,
          [evalRes.currentStreak, evalRes.freezesUsed, yesterday, e.enrollment_id],
        );

        // State transitions → notification events.
        if (
          evalRes.brokeNow &&
          e.prior_current_streak > 0 &&
          evalRes.currentStreak === 0
        ) {
          await insertBellEvent(
            client,
            e.household_id,
            'streak_broken',
            e.kid_id,
            `streak_broken:${e.campaign_id}:${e.kid_id}:${yesterday}`,
            {
              campaign_id: e.campaign_id,
              prior_streak: e.prior_current_streak,
              broken_on: yesterday,
            },
          );
          counts.streakBroken += 1;
        }

        if (evalRes.freezesUsed > e.prior_freezes_used) {
          await insertBellEvent(
            client,
            e.household_id,
            'streak_freeze_used',
            e.kid_id,
            `streak_freeze_used:${e.campaign_id}:${e.kid_id}:${evalRes.freezesUsed}`,
            {
              campaign_id: e.campaign_id,
              freezes_used: evalRes.freezesUsed,
            },
          );
          counts.freezesUsed += 1;
        }

        if (evalRes.completedNow) {
          await awardCampaignCompletion(client, {
            enrollmentId: e.enrollment_id,
            campaignId: e.campaign_id,
            kidId: e.kid_id,
            householdId: e.household_id,
            bonusCoins: e.bonus_coins,
            badgeId: e.badge_id,
          });
          counts.streakCompleted += 1;
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        counts.errors += 1;
        logger.error(
          { err, enrollmentId: e.enrollment_id },
          'daily-reset: streak evaluation failed',
        );
      }
    }

    // ── 2. Window close ────────────────────────────────────────────────────
    // Mark every active enrollment whose campaign ended yesterday-or-earlier
    // as 'incomplete'. No bonus, no badge. Bell-only notification.
    interface OverdueRow {
      enrollment_id: string;
      campaign_id: string;
      kid_id: string;
      household_id: string;
    }
    const overdueRows = await client.query<OverdueRow>(
      `SELECT e.id           AS enrollment_id,
              c.id           AS campaign_id,
              e.kid_id       AS kid_id,
              e.household_id AS household_id
         FROM campaign_enrollment e
         JOIN campaign c ON c.id = e.campaign_id
        WHERE e.completed_at IS NULL
          AND c.archived_at  IS NULL
          AND c.end_date     <  $1::date`,
      [today],
    );

    for (const r of overdueRows.rows) {
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE campaign_enrollment
              SET completed_at = now(),
                  completed_kind = 'incomplete'
            WHERE id = $1`,
          [r.enrollment_id],
        );
        await insertBellEvent(
          client,
          r.household_id,
          'campaign_completed',
          r.kid_id,
          `campaign_completed:${r.campaign_id}:${r.kid_id}`,
          { campaign_id: r.campaign_id, completed_kind: 'incomplete' },
        );
        await client.query(
          `INSERT INTO audit_log (
             household_id, actor_kid_id, action, target_kind, target_id, after_json
           ) VALUES (
             $1, $2, 'campaign.window_closed', 'campaign', $3, $4
           )`,
          [
            r.household_id,
            r.kid_id,
            r.campaign_id,
            JSON.stringify({ completed_kind: 'incomplete' }),
          ],
        );
        await client.query('COMMIT');
        counts.windowClosed += 1;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        counts.errors += 1;
        logger.error(
          { err, enrollmentId: r.enrollment_id },
          'daily-reset: window close failed',
        );
      }
    }

    // ── 3. Birthday badge ──────────────────────────────────────────────────
    interface BirthdayKidRow {
      id: string;
      household_id: string;
      name: string;
    }
    const bdayRows = await client.query<BirthdayKidRow>(
      `SELECT k.id, k.household_id, k.name
         FROM kid k
        WHERE k.archived_at IS NULL
          AND k.birthdate IS NOT NULL
          AND EXTRACT(month FROM k.birthdate) = EXTRACT(month FROM ($1::date))
          AND EXTRACT(day   FROM k.birthdate) = EXTRACT(day   FROM ($1::date))`,
      [today],
    );

    for (const k of bdayRows.rows) {
      try {
        await client.query('BEGIN');
        // Look up the household's birthday badge (seeded as title_en='Birthday').
        const bRes = await client.query<{ id: string }>(
          `SELECT id FROM badge
            WHERE household_id = $1 AND title_en = 'Birthday' AND archived_at IS NULL
            LIMIT 1`,
          [k.household_id],
        );
        const badgeId = bRes.rows[0]?.id;
        if (!badgeId) {
          await client.query('ROLLBACK');
          continue;
        }
        // The UNIQUE NULLS NOT DISTINCT on (kid_id, badge_id, awarded_for_year)
        // makes the INSERT a no-op if already earned this year.
        const ins = await client.query<{ id: string }>(
          `INSERT INTO kid_badge (kid_id, badge_id, awarded_for_year)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [k.id, badgeId, year],
        );
        if (ins.rowCount === 1) {
          await insertBellEvent(
            client,
            k.household_id,
            'campaign_completed',
            k.id,
            `birthday_badge:${k.id}:${year}`,
            { badge_id: badgeId, awarded_for_year: year, birthday: true },
          );
          await client.query(
            `INSERT INTO audit_log (
               household_id, actor_kid_id, action, target_kind, target_id, after_json
             ) VALUES (
               $1, $2, 'badge.birthday_awarded', 'kid_badge', $3, $4
             )`,
            [
              k.household_id,
              k.id,
              ins.rows[0]!.id,
              JSON.stringify({ badge_id: badgeId, year }),
            ],
          );
          counts.birthdayAwarded += 1;
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        counts.errors += 1;
        logger.error({ err, kidId: k.id }, 'daily-reset: birthday badge failed');
      }
    }
  } finally {
    client.release();
  }

  return counts;
}

async function insertBellEvent(
  client: PoolClient,
  householdId: string,
  eventKind: string,
  kidId: string,
  dedupKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO notification_event (
       household_id, event_kind, recipient_kid_id, channel,
       dedup_key, payload_json
     ) VALUES (
       $1, $2, $3, 'bell', $4, $5
     )
     ON CONFLICT (dedup_key, channel) DO NOTHING`,
    [householdId, eventKind, kidId, dedupKey, JSON.stringify(payload)],
  );
}

interface AwardInput {
  enrollmentId: string;
  campaignId: string;
  kidId: string;
  householdId: string;
  bonusCoins: number;
  badgeId: string | null;
}

/**
 * Mirrors processCompletionForCampaigns's maybeComplete logic but called
 * from the cron context (no surrounding completion event). We deliberately
 * keep the two implementations side by side rather than extracting a
 * shared helper because the cron's transaction shape is different: it
 * owns BEGIN/COMMIT here, while process-completion participates in the
 * caller's transaction.
 */
async function awardCampaignCompletion(
  client: PoolClient,
  input: AwardInput,
): Promise<void> {
  let bonusLedgerId: string | null = null;
  if (input.bonusCoins > 0) {
    const entry = await ledgerPost(client, {
      kind: 'campaign_bonus',
      householdId: input.householdId,
      kidId: input.kidId,
      amount: input.bonusCoins,
      campaignId: input.campaignId,
    });
    bonusLedgerId = entry.id;
  }

  let badgeAwardId: string | null = null;
  if (input.badgeId) {
    const bRes = await client.query<{ id: string }>(
      `INSERT INTO kid_badge (kid_id, badge_id, source_campaign_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [input.kidId, input.badgeId, input.campaignId],
    );
    badgeAwardId = bRes.rows[0]?.id ?? null;
  }

  await client.query(
    `UPDATE campaign_enrollment
        SET completed_at    = now(),
            completed_kind  = 'success',
            bonus_ledger_id = $1,
            badge_award_id  = $2
      WHERE id = $3`,
    [bonusLedgerId, badgeAwardId, input.enrollmentId],
  );

  await client.query(
    `INSERT INTO audit_log (
       household_id, actor_kid_id, action, target_kind, target_id, after_json
     ) VALUES (
       $1, $2, 'campaign.completed', 'campaign', $3, $4
     )`,
    [
      input.householdId,
      input.kidId,
      input.campaignId,
      JSON.stringify({
        bonus_coins: input.bonusCoins,
        bonus_ledger_id: bonusLedgerId,
        badge_award_id: badgeAwardId,
        source: 'daily_reset',
      }),
    ],
  );

  await insertBellEvent(
    client,
    input.householdId,
    'campaign_completed',
    input.kidId,
    `campaign_completed:${input.campaignId}:${input.kidId}`,
    {
      campaign_id: input.campaignId,
      bonus_coins: input.bonusCoins,
      badge_award_id: badgeAwardId,
    },
  );

  if (input.badgeId) {
    await client.query(
      `INSERT INTO notification_event (
         household_id, event_kind, recipient_kid_id, channel,
         dedup_key, payload_json
       )
       SELECT $1, 'sibling_badge_earned', sib.id, 'bell',
              'sibling_badge_earned:' || $2 || ':' || sib.id::text,
              $3
         FROM kid sib
        WHERE sib.household_id = $1
          AND sib.id <> $4
          AND sib.archived_at IS NULL
       ON CONFLICT (dedup_key, channel) DO NOTHING`,
      [
        input.householdId,
        input.campaignId,
        JSON.stringify({
          campaign_id: input.campaignId,
          earner_kid_id: input.kidId,
          badge_id: input.badgeId,
        }),
        input.kidId,
      ],
    );
  }
}
