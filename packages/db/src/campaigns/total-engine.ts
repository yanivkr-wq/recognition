/**
 * Total engine — ledger-derived.
 *
 * A "total" campaign tracks a running quantity over its window, measured in
 * the journey's own unit (hours, pages, points…). Each feeding task
 * contributes its measured AMOUNT, not a flat 1, so the progress bar reflects
 * the real sum against the target:
 *   - daily template: SUM(measure_amount) of non-undone completions — how much
 *     one completion is worth toward the journey. E.g. a 120-hour practice
 *     journey fed by 15-hour tasks reads 30/120 after two completions. A task
 *     with NULL measure_amount contributes 0 (earns coins, no journey effect).
 *   - long_term template: SUM(quantity) of non-undone progress rows
 *     (the natural unit — e.g. "read 100 pages")
 *
 * Both filters apply: undone_at IS NULL AND approval_status IN
 * ('auto_approved', 'approved'). Pending submissions don't count until
 * the parent approves.
 *
 * BUILD-PLAN §"Phase 7" exit criteria:
 *   - "Admin creates a 100-page 'Read a book' total campaign over 60 days.
 *     Lia logs progress over 30 days, hits 100 pages on day 30 → instant
 *     completion + bonus + badge."
 *   - "Yael enrolls but only reads 40 pages by day 60. End_date reached →
 *     01:00 cron marks completed_kind='incomplete'."
 *
 * The engine itself doesn't post the bonus or mark the enrollment — it
 * just computes state. The caller (worker cron or completeTaskAction
 * hook) is responsible for the side-effects when `completedNow` flips.
 */

import type { PoolClient } from 'pg';

export interface EvaluateTotalInput {
  kidId: string;
  campaignId: string;
  /** "Today" — clamp window to min(asOfDate, end_date). */
  asOfDate: string; // YYYY-MM-DD
}

export interface EvaluateTotalResult {
  currentTotal: number;
  targetQuantity: number;
  /** True iff currentTotal just crossed targetQuantity AND the enrollment's
   *  completed_at is null. Caller writes the completion. */
  completedNow: boolean;
}

interface CampaignRow {
  start_date: string;
  end_date: string;
  total_target_quantity: number;
  completed_at: Date | null;
}

interface SumRow {
  total: string;
}

export async function evaluateTotal(
  client: PoolClient,
  input: EvaluateTotalInput,
): Promise<EvaluateTotalResult> {
  const cRes = await client.query<CampaignRow>(
    `SELECT
       c.start_date::text                 AS start_date,
       c.end_date::text                   AS end_date,
       c.total_target_quantity            AS total_target_quantity,
       e.completed_at                     AS completed_at
     FROM campaign c
     JOIN campaign_enrollment e ON e.campaign_id = c.id AND e.kid_id = $2
     WHERE c.id = $1 AND c.kind = 'total'`,
    [input.campaignId, input.kidId],
  );
  const camp = cRes.rows[0];
  if (!camp) {
    return { currentTotal: 0, targetQuantity: 0, completedNow: false };
  }

  const startDate = camp.start_date;
  const endDate = camp.end_date;
  const targetQuantity = camp.total_target_quantity ?? 0;
  const alreadyCompleted = camp.completed_at != null;

  const windowEnd = input.asOfDate > endDate ? endDate : input.asOfDate;
  if (windowEnd < startDate) {
    return { currentTotal: 0, targetQuantity, completedNow: false };
  }

  // Sum across both feeding kinds in a single round-trip.
  //   daily:     SUM(measure_amount) of qualifying task_completion rows
  //   long_term: SUM(quantity) of qualifying long_term_progress rows
  // The CTE then SUMs the two contributions.
  const sumRes = await client.query<SumRow>(
    `WITH feeding AS (
       SELECT cft.template_id, tt.kind, COALESCE(tt.measure_amount, 0) AS measure_amount
         FROM campaign_feeding_task cft
         JOIN task_template tt ON tt.id = cft.template_id
        WHERE cft.campaign_id = $1
     ),
     daily_total AS (
       SELECT COALESCE(SUM(f.measure_amount), 0)::bigint AS n
         FROM task_completion tc
         JOIN task_assignment ta ON ta.id = tc.assignment_id
         JOIN feeding f ON f.template_id = ta.template_id
        WHERE tc.kid_id = $2
          AND tc.undone_at IS NULL
          AND tc.approval_status IN ('auto_approved', 'approved')
          AND tc.completion_date BETWEEN $3::date AND $4::date
          AND f.kind = 'daily'
     ),
     long_total AS (
       SELECT COALESCE(SUM(lp.quantity), 0)::bigint AS n
         FROM long_term_progress lp
         JOIN task_assignment ta ON ta.id = lp.assignment_id
         JOIN feeding f ON f.template_id = ta.template_id
        WHERE lp.kid_id = $2
          AND lp.undone_at IS NULL
          AND lp.approval_status IN ('auto_approved', 'approved')
          AND lp.progress_date BETWEEN $3::date AND $4::date
          AND f.kind = 'long_term'
     )
     SELECT ((SELECT n FROM daily_total) + (SELECT n FROM long_total))::text AS total`,
    [input.campaignId, input.kidId, startDate, windowEnd],
  );
  const currentTotal = Number(sumRes.rows[0]?.total ?? 0);

  const completedNow =
    !alreadyCompleted && targetQuantity > 0 && currentTotal >= targetQuantity;

  return { currentTotal, targetQuantity, completedNow };
}
