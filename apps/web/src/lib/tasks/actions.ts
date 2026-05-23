/**
 * Server actions for daily task completion + same-day undo.
 *
 * Three things happen here together (each in its own transaction):
 *   1. INSERT task_completion — the partial unique index
 *      task_completion_assignment_date_active is the double-claim guard. A
 *      double-tap raises 23505 which we translate to a typed `already_done`.
 *   2. ledger.post('earn', amount, taskCompletionId) — but only if the
 *      template doesn't require evidence. Evidence-required tasks defer the
 *      ledger credit to Phase 5's approval flow; their completion row sits
 *      in approval_status='pending' until then.
 *   3. UPDATE task_completion SET ledger_credit_id — so undo can find the
 *      counter-entry to write.
 *
 * Same-day undo (per BUILD-PLAN.md Phase 3 task 5):
 *   - Verifies the completion belongs to this kid (kid-scoped).
 *   - Requires today_IL match (older slots are immutable history).
 *   - Marks `undone_at`, then `ledger.post('undo', -amount)` if there's a
 *     credit. The partial unique index respects `undone_at IS NULL` so a
 *     fresh re-complete on the same date inserts a NEW row (covered by
 *     re-calling completeTaskAction — no separate "redo" action needed).
 *
 * Concurrency:
 *   - The completion INSERT path runs in a transaction; the partial unique
 *     constraint is the integrity point.
 *   - The undo path locks the row via SELECT ... FOR UPDATE inside the same
 *     tx that posts the undo ledger entry — so a kid double-tapping undo
 *     can't post two counter-entries.
 *   - ledgerPost itself takes an advisory lock per kid_id (see
 *     packages/db/src/ledger/post.ts), so this never collides with a worker
 *     cron writing campaign_bonus for the same kid.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import {
  getDb,
  getPool,
  ledgerPost,
  processCompletionForCampaigns,
  taskAssignment,
  taskTemplate,
} from '@reco/db';
import { requireKid, UnauthorizedError } from '../auth/guards';

const HOUSEHOLD_TZ = 'Asia/Jerusalem';
const PG_UNIQUE_VIOLATION = '23505';

interface PgError {
  code?: string;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as PgError)?.code === PG_UNIQUE_VIOLATION;
}

export type CompleteTaskState =
  | { ok: true; completionId: string; balanceAfter: number; coinsAdded: number; evidenceRequired: boolean }
  | { ok: false; error: 'already_done' | 'not_found' | 'wrong_kind' | 'forbidden' | 'deadline_passed' | 'internal' };

export async function completeTaskAction(
  _prev: CompleteTaskState | undefined,
  formData: FormData,
): Promise<CompleteTaskState> {
  const assignmentId = String(formData.get('assignmentId') ?? '');
  if (!assignmentId) return { ok: false, error: 'not_found' };

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  // Verify assignment belongs to this kid AND is daily AND active. Doing this
  // before the transaction means we don't open a connection for an obviously
  // bad request; the INSERT below would also fail the FK / CHECK paths.
  const aRows = await getDb()
    .select({
      kidId: taskAssignment.kidId,
      templateId: taskAssignment.templateId,
      enabled: taskAssignment.enabled,
      archivedAt: taskAssignment.archivedAt,
      kind: taskTemplate.kind,
      coinValue: taskTemplate.coinValue,
      evidenceRequired: taskTemplate.evidenceRequired,
      deadlineTime: taskTemplate.deadlineTime,
    })
    .from(taskAssignment)
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskAssignment.templateId))
    .where(and(eq(taskAssignment.id, assignmentId), eq(taskAssignment.kidId, kid.kidId)))
    .limit(1);
  const a = aRows[0];
  if (!a || a.archivedAt || !a.enabled) return { ok: false, error: 'not_found' };
  if (a.kind !== 'daily') return { ok: false, error: 'wrong_kind' };

  // Phase 7.5 deadline gate: if the template has a deadline_time set, the
  // kid can only complete the task before that wall-clock time in IL.
  // Past the deadline the action rejects with `deadline_passed`; an admin
  // can still complete on the kid's behalf via adminCompleteForKidAction.
  if (a.deadlineTime) {
    const nowRes = await getPool().query<{ past: boolean }>(
      `SELECT (now() AT TIME ZONE $1)::time > $2::time AS past`,
      [HOUSEHOLD_TZ, a.deadlineTime],
    );
    if (nowRes.rows[0]?.past) {
      return { ok: false, error: 'deadline_passed' };
    }
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const todayRes = await client.query<{ today: string }>(
      `SELECT (now() AT TIME ZONE $1)::date::text AS today`,
      [HOUSEHOLD_TZ],
    );
    const completionDate = todayRes.rows[0]!.today;

    let completionId: string;
    try {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO task_completion (
           household_id, assignment_id, kid_id, completion_date, approval_status
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          kid.householdId,
          assignmentId,
          kid.kidId,
          completionDate,
          a.evidenceRequired ? 'pending' : 'auto_approved',
        ],
      );
      completionId = inserted.rows[0]!.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'already_done' };
      }
      throw err;
    }

    let balanceAfter = 0;
    let coinsAdded = 0;

    if (!a.evidenceRequired) {
      const entry = await ledgerPost(client, {
        kind: 'earn',
        householdId: kid.householdId,
        kidId: kid.kidId,
        amount: a.coinValue,
        taskCompletionId: completionId,
      });
      await client.query(
        `UPDATE task_completion SET ledger_credit_id = $1, updated_at = now() WHERE id = $2`,
        [entry.id, completionId],
      );
      balanceAfter = Math.max(0, entry.balanceAfter);
      coinsAdded = entry.amount;

      // Phase 7 — fan out to every campaign feeding off this template. The
      // engine re-derives streak/total from the freshly-mutated history; if
      // this completion crosses a target, campaign_bonus + kid_badge land
      // in the same transaction. We re-read the wallet sum afterwards so
      // the kid's pulse animation reflects task earn + any campaign bonus.
      const fanout = await processCompletionForCampaigns(client, {
        kidId: kid.kidId,
        householdId: kid.householdId,
        templateId: a.templateId,
        asOfDate: completionDate,
      });
      if (fanout.some((f) => f.completedNow)) {
        const sumRes = await client.query<{ sum: string | null }>(
          `SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entry WHERE kid_id = $1`,
          [kid.kidId],
        );
        balanceAfter = Math.max(0, Number(sumRes.rows[0]?.sum ?? 0));
      }
    } else {
      // Phase 5 will replace this branch: kid uploads evidence, parent
      // approves, only THEN does the ledger credit fire. For Phase 3, an
      // evidence-required completion sits at approval_status='pending' and
      // contributes 0 coins immediately.
      const sumRes = await client.query<{ sum: string | null }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entry WHERE kid_id = $1`,
        [kid.kidId],
      );
      balanceAfter = Math.max(0, Number(sumRes.rows[0]?.sum ?? 0));
    }

    await client.query('COMMIT');
    revalidatePath('/[lang]', 'layout');
    return {
      ok: true,
      completionId,
      balanceAfter,
      coinsAdded,
      evidenceRequired: a.evidenceRequired,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('completeTaskAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

export type UndoTaskState =
  | { ok: true; balanceAfter: number; coinsRemoved: number }
  | { ok: false; error: 'not_found' | 'not_same_day' | 'forbidden' | 'already_undone' | 'internal' };

export async function undoTaskCompletionAction(
  _prev: UndoTaskState | undefined,
  formData: FormData,
): Promise<UndoTaskState> {
  const completionId = String(formData.get('completionId') ?? '');
  if (!completionId) return { ok: false, error: 'not_found' };

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const cRes = await client.query<{
      id: string;
      kid_id: string;
      undone_at: Date | null;
      completion_date: string;
      ledger_credit_id: string | null;
    }>(
      `SELECT id, kid_id, undone_at, completion_date::text, ledger_credit_id
       FROM task_completion
       WHERE id = $1
       FOR UPDATE`,
      [completionId],
    );
    const c = cRes.rows[0];
    if (!c || c.kid_id !== kid.kidId) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'not_found' };
    }
    if (c.undone_at) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'already_undone' };
    }

    const todayRes = await client.query<{ today: string }>(
      `SELECT (now() AT TIME ZONE $1)::date::text AS today`,
      [HOUSEHOLD_TZ],
    );
    if (c.completion_date !== todayRes.rows[0]!.today) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'not_same_day' };
    }

    await client.query(
      `UPDATE task_completion SET undone_at = now(), updated_at = now() WHERE id = $1`,
      [completionId],
    );

    let coinsRemoved = 0;
    let balanceAfter = 0;
    if (c.ledger_credit_id) {
      const creditRes = await client.query<{ amount: number }>(
        `SELECT amount FROM ledger_entry WHERE id = $1`,
        [c.ledger_credit_id],
      );
      const amt = creditRes.rows[0]!.amount;
      const entry = await ledgerPost(client, {
        kind: 'undo',
        householdId: kid.householdId,
        kidId: kid.kidId,
        amount: -amt,
        undoOfEntryId: c.ledger_credit_id,
      });
      coinsRemoved = amt;
      balanceAfter = Math.max(0, entry.balanceAfter);
    } else {
      const sumRes = await client.query<{ sum: string | null }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entry WHERE kid_id = $1`,
        [kid.kidId],
      );
      balanceAfter = Math.max(0, Number(sumRes.rows[0]?.sum ?? 0));
    }

    await client.query('COMMIT');
    revalidatePath('/[lang]', 'layout');
    return { ok: true, balanceAfter, coinsRemoved };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('undoTaskCompletionAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}
