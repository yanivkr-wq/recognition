/**
 * Undo a long-term progress entry inside the caller's transaction.
 *
 * Per BUILD-PLAN.md Phase 4 §3 (the "open question" resolved by the build
 * plan): the per-unit coins always reverse. The bonus reverses too IF the
 * undo drops total below goal AND the assignment had been marked completed.
 *
 *   kid logs 95 pages (no goal yet)        → no bonus posted, not done
 *   kid logs +10 → total 105 ≥ 100         → bonus posts, assignment marked done
 *   kid undoes the +10                     → total drops to 95 → reverse the
 *                                            bonus + clear long_term_completed_at
 *   kid undoes the +95 (already done)      → total drops to 0 → same path:
 *                                            reverse bonus + clear marker (the
 *                                            check is on newTotal vs goal, not
 *                                            on which row was undone)
 *
 * Same-day guard: kids can only undo today's rows (Asia/Jerusalem). Older
 * entries are immutable history. Admin "joker" lands in Phase 6.
 */

import type { PoolClient } from 'pg';
import { ledgerPost, type PostedEntry } from '../ledger/post';

export interface UndoProgressInput {
  householdId: string;
  kidId: string;
  progressId: string;
  /** IANA tz for the same-day check. Use the household tz. */
  tz: string;
}

export type UndoProgressResult =
  | {
      ok: true;
      perUnitUndo: PostedEntry | null;
      bonusUndo: PostedEntry | null;
      newTotal: number;
      assignmentReopened: boolean;
    }
  | {
      ok: false;
      error: 'not_found' | 'already_undone' | 'not_same_day';
    };

interface ProgressRow {
  id: string;
  kid_id: string;
  assignment_id: string;
  undone_at: Date | null;
  progress_date: string;
  ledger_credit_id: string | null;
}

interface AssignmentTotal {
  long_term_completed_at: Date | null;
  long_term_goal_quantity: number | null;
}

export async function undoLongTermProgressOperation(
  client: PoolClient,
  input: UndoProgressInput,
): Promise<UndoProgressResult> {
  const pRes = await client.query<ProgressRow>(
    `SELECT id, kid_id, assignment_id, undone_at, progress_date::text, ledger_credit_id
     FROM long_term_progress
     WHERE id = $1
     FOR UPDATE`,
    [input.progressId],
  );
  const p = pRes.rows[0];
  if (!p || p.kid_id !== input.kidId) return { ok: false, error: 'not_found' };
  if (p.undone_at) return { ok: false, error: 'already_undone' };

  const todayRes = await client.query<{ today: string }>(
    `SELECT (now() AT TIME ZONE $1)::date::text AS today`,
    [input.tz],
  );
  if (p.progress_date !== todayRes.rows[0]!.today) {
    return { ok: false, error: 'not_same_day' };
  }

  await client.query(
    `UPDATE long_term_progress SET undone_at = now() WHERE id = $1`,
    [input.progressId],
  );

  let perUnitUndo: PostedEntry | null = null;
  if (p.ledger_credit_id) {
    const credit = await client.query<{ amount: number }>(
      `SELECT amount FROM ledger_entry WHERE id = $1`,
      [p.ledger_credit_id],
    );
    perUnitUndo = await ledgerPost(client, {
      kind: 'undo',
      householdId: input.householdId,
      kidId: input.kidId,
      amount: -credit.rows[0]!.amount,
      undoOfEntryId: p.ledger_credit_id,
    });
  }

  const totalRes = await client.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(quantity), 0)::text AS total
     FROM long_term_progress
     WHERE assignment_id = $1
       AND undone_at IS NULL
       AND approval_status IN ('auto_approved', 'approved')`,
    [p.assignment_id],
  );
  const newTotal = Number(totalRes.rows[0]?.total ?? 0);

  let bonusUndo: PostedEntry | null = null;
  let assignmentReopened = false;

  const aRes = await client.query<AssignmentTotal>(
    `SELECT ta.long_term_completed_at, tt.long_term_goal_quantity
     FROM task_assignment ta
     JOIN task_template tt ON tt.id = ta.template_id
     WHERE ta.id = $1`,
    [p.assignment_id],
  );
  const aRow = aRes.rows[0];

  if (
    aRow?.long_term_completed_at &&
    newTotal < (aRow.long_term_goal_quantity ?? 0)
  ) {
    // The completion-triggering bonus is the most recent `earn` entry that:
    //   1. Points at one of this assignment's long_term_progress rows
    //   2. Is NOT anyone's per-unit ledger_credit_id (those are the per-unit
    //      earns; the bonus is a separate row that's not wired back via
    //      ledger_credit_id)
    //   3. Hasn't already been reversed by a prior undo
    const bonusRes = await client.query<{ id: string; amount: number }>(
      `SELECT le.id, le.amount
       FROM ledger_entry le
       JOIN long_term_progress ltp ON ltp.id = le.long_term_progress_id
       WHERE ltp.assignment_id = $1
         AND le.kind = 'earn'
         AND le.id NOT IN (
           SELECT ledger_credit_id FROM long_term_progress
           WHERE assignment_id = $1 AND ledger_credit_id IS NOT NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM ledger_entry u
           WHERE u.kind = 'undo' AND u.undo_of_entry_id = le.id
         )
       ORDER BY le.created_at DESC
       LIMIT 1`,
      [p.assignment_id],
    );
    const bonusEntry = bonusRes.rows[0];
    if (bonusEntry) {
      bonusUndo = await ledgerPost(client, {
        kind: 'undo',
        householdId: input.householdId,
        kidId: input.kidId,
        amount: -bonusEntry.amount,
        undoOfEntryId: bonusEntry.id,
      });
    }
    await client.query(
      `UPDATE task_assignment SET long_term_completed_at = NULL WHERE id = $1`,
      [p.assignment_id],
    );
    assignmentReopened = true;
  }

  return {
    ok: true,
    perUnitUndo,
    bonusUndo,
    newTotal,
    assignmentReopened,
  };
}
