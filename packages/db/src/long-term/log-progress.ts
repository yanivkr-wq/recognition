/**
 * Log a long-term task progress entry inside the caller's transaction.
 *
 * Three things happen atomically:
 *   1. INSERT a long_term_progress row.
 *   2. ledger.post('earn', quantity × per_unit_coins, long_term_progress_id=row).
 *   3. If the new total (SUM(quantity over active rows)) crossed the template's
 *      long_term_goal_quantity AND the template has a bonus_on_complete > 0:
 *        - ledger.post('earn', bonus, long_term_progress_id=triggering_row)
 *        - UPDATE task_assignment SET long_term_completed_at = now()
 *
 * Why two `earn` entries (not a separate `campaign_bonus` kind)?
 *   - A long-term task is NOT a campaign by default (ARCHITECTURE.md §10.3
 *     + BUILD-PLAN Phase 4 §2). The `campaign_bonus` ledger kind requires a
 *     campaign_id FK; we don't have one here.
 *   - `earn` accepts a long_term_progress_id FK, so both posts wire to the
 *     row that triggered them. The DB CHECK constraint allows multiple
 *     earn entries pointing at the same long_term_progress_id (no UNIQUE).
 *   - Undo-of-bonus can find the bonus by "earn entries for this assignment's
 *     progress rows that aren't anyone's ledger_credit_id" — covered in
 *     ./undo-progress.ts.
 *
 * Caller responsibilities:
 *   - Open the transaction. Caller may want to compose with other writes.
 *   - Provide a valid kid_id matching the assignment (auth check upstream).
 */

import type { PoolClient } from 'pg';
import { ledgerPost, type PostedEntry } from '../ledger/post';
import { processCompletionForCampaigns } from '../campaigns/process-completion';

export interface LogProgressInput {
  householdId: string;
  kidId: string;
  assignmentId: string;
  quantity: number;
  /** IANA tz for the progress_date column. Use the household tz. */
  tz: string;
}

export type LogProgressResult =
  | {
      ok: true;
      progressId: string;
      perUnitEarn: PostedEntry;
      bonusEarn: PostedEntry | null;
      newTotal: number;
      goalReached: boolean;
    }
  | {
      ok: false;
      error:
        | 'invalid_quantity'
        | 'not_found'
        | 'wrong_kind'
        | 'already_done'
        | 'disabled';
    };

interface AssignmentLookup {
  kid_id: string;
  enabled: boolean;
  archived_at: Date | null;
  long_term_completed_at: Date | null;
  kind: string;
  template_id: string;
  per_unit_coins: number | null;
  goal_quantity: number | null;
  bonus_on_complete: number | null;
}

export async function logProgressOperation(
  client: PoolClient,
  input: LogProgressInput,
): Promise<LogProgressResult> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: 'invalid_quantity' };
  }

  const aRes = await client.query<AssignmentLookup>(
    `SELECT ta.kid_id, ta.enabled, ta.archived_at, ta.long_term_completed_at,
            tt.kind, tt.id AS template_id,
            tt.long_term_per_unit_coins AS per_unit_coins,
            tt.long_term_goal_quantity AS goal_quantity,
            tt.long_term_bonus_on_complete AS bonus_on_complete
     FROM task_assignment ta
     JOIN task_template tt ON tt.id = ta.template_id
     WHERE ta.id = $1 AND ta.kid_id = $2
     LIMIT 1`,
    [input.assignmentId, input.kidId],
  );
  const a = aRes.rows[0];
  if (!a) return { ok: false, error: 'not_found' };
  if (a.archived_at || !a.enabled) return { ok: false, error: 'disabled' };
  if (a.kind !== 'long_term') return { ok: false, error: 'wrong_kind' };
  if (a.long_term_completed_at) return { ok: false, error: 'already_done' };
  if (a.per_unit_coins == null || a.goal_quantity == null) {
    // Schema CHECK guarantees these are populated for long_term, but TS
    // doesn't know that — guard for safety.
    return { ok: false, error: 'not_found' };
  }

  const inserted = await client.query<{ id: string; progress_date: string }>(
    `INSERT INTO long_term_progress (
       household_id, assignment_id, kid_id, progress_date, quantity, approval_status
     ) VALUES (
       $1, $2, $3, (now() AT TIME ZONE $4)::date, $5, 'auto_approved'
     )
     RETURNING id, progress_date::text AS progress_date`,
    [input.householdId, input.assignmentId, input.kidId, input.tz, input.quantity],
  );
  const progressId = inserted.rows[0]!.id;
  const progressDate = inserted.rows[0]!.progress_date;

  const perUnitEarn = await ledgerPost(client, {
    kind: 'earn',
    householdId: input.householdId,
    kidId: input.kidId,
    amount: input.quantity * a.per_unit_coins,
    longTermProgressId: progressId,
  });
  await client.query(
    `UPDATE long_term_progress SET ledger_credit_id = $1 WHERE id = $2`,
    [perUnitEarn.id, progressId],
  );

  const totalRes = await client.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(quantity), 0)::text AS total
     FROM long_term_progress
     WHERE assignment_id = $1
       AND undone_at IS NULL
       AND approval_status IN ('auto_approved', 'approved')`,
    [input.assignmentId],
  );
  const newTotal = Number(totalRes.rows[0]?.total ?? 0);
  const goalReached = newTotal >= a.goal_quantity;

  let bonusEarn: PostedEntry | null = null;
  if (goalReached) {
    if ((a.bonus_on_complete ?? 0) > 0) {
      bonusEarn = await ledgerPost(client, {
        kind: 'earn',
        householdId: input.householdId,
        kidId: input.kidId,
        amount: a.bonus_on_complete!,
        longTermProgressId: progressId,
      });
    }
    await client.query(
      `UPDATE task_assignment SET long_term_completed_at = now() WHERE id = $1`,
      [input.assignmentId],
    );
  }

  // Phase 7 — campaign fan-out. The per-unit earn (and optional bonus earn)
  // already landed; the engine reads them via long_term_progress + ledger.
  // Failures here roll back the entire log-progress operation (caller's tx).
  await processCompletionForCampaigns(client, {
    kidId: input.kidId,
    householdId: input.householdId,
    templateId: a.template_id,
    asOfDate: progressDate,
  });

  return {
    ok: true,
    progressId,
    perUnitEarn,
    bonusEarn,
    newTotal,
    goalReached,
  };
}
