/**
 * Admin-side approve / deny for evidence submissions.
 *
 * FCFS contract (per BUILD-PLAN.md Phase 5 §5):
 *   - Approve: `UPDATE submission SET status='approved' WHERE id=$1 AND
 *     status='pending'`. If rowcount=0 the other parent already resolved it;
 *     the UI shows "already resolved." If rowcount=1: this parent wins,
 *     ledger.post fires, completion is marked approved, audit row written.
 *   - Deny: same shape with `status='denied' AND deny_reason=$2`. CHECK
 *     constraint on submission rejects a denied row without a reason — we
 *     enforce non-empty at the app layer first for a friendlier error.
 *
 * Atomicity:
 *   - On approve, the ledger.post + completion update + audit insert all run
 *     inside one transaction. If the ledger CHECK fails (defense-in-depth),
 *     the submission UPDATE rolls back too.
 *   - On deny, the submission + completion + audit also run together.
 *
 * The audit_log entry is the household-visible record both parents see in
 * `/admin/audit` (Phase 6 lands the full feed).
 */

'use server';

import 'server-only';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getPool, approveSubmissionOperation } from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';

export type ApproveSubmissionState =
  | { ok: true; submissionId: string; coinsAwarded: number }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'not_found'
        | 'already_resolved'
        | 'internal';
    };

export async function approveSubmissionAction(
  _prev: ApproveSubmissionState | undefined,
  formData: FormData,
): Promise<ApproveSubmissionState> {
  const submissionId = String(formData.get('submissionId') ?? '');
  if (!submissionId) return { ok: false, error: 'not_found' };

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const hdrs = await headers();
  const requestIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await approveSubmissionOperation(client, {
      submissionId,
      adminUserId: admin.userId,
      householdId: admin.householdId,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      if (
        result.error === 'wrong_household' ||
        result.error === 'completion_already_resolved'
      ) {
        return { ok: false, error: 'already_resolved' };
      }
      return { ok: false, error: result.error };
    }
    // Notify the player their submission was approved — a bell event the kid's
    // notifications page renders ("✅ approved") and the bell badge counts.
    // Idempotent via the dedup_key unique index.
    await client.query(
      `INSERT INTO notification_event
         (household_id, event_kind, recipient_kid_id, channel, state, dedup_key, payload_json)
       SELECT s.household_id, 'submission_approved', s.kid_id, 'bell', 'pending', $2, '{}'::jsonb
         FROM submission s WHERE s.id = $1
       ON CONFLICT (dedup_key, channel) DO NOTHING`,
      [submissionId, `submission_approved:${submissionId}`],
    );
    await client.query('COMMIT');
    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]', 'layout');
    return {
      ok: true,
      submissionId: result.submissionId,
      coinsAwarded: result.ledgerEntry.amount,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('approveSubmissionAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

export type DenySubmissionState =
  | { ok: true; submissionId: string }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'not_found'
        | 'already_resolved'
        | 'reason_required'
        | 'internal';
    };

export async function denySubmissionAction(
  _prev: DenySubmissionState | undefined,
  formData: FormData,
): Promise<DenySubmissionState> {
  const submissionId = String(formData.get('submissionId') ?? '');
  const denyReason = String(formData.get('denyReason') ?? '').trim();
  if (!submissionId) return { ok: false, error: 'not_found' };
  if (!denyReason) return { ok: false, error: 'reason_required' };

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const hdrs = await headers();
  const requestIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const upd = await client.query<{
      id: string;
      task_completion_id: string | null;
      household_id: string;
    }>(
      `UPDATE submission
         SET status = 'denied',
             deny_reason = $1,
             resolved_at = now(),
             resolved_by_user_id = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id, task_completion_id, household_id`,
      [denyReason, admin.userId, submissionId],
    );
    if (upd.rowCount !== 1) {
      await client.query('ROLLBACK');
      const exists = await getPool().query<{ id: string }>(
        `SELECT id FROM submission WHERE id = $1`,
        [submissionId],
      );
      return {
        ok: false,
        error: exists.rowCount === 0 ? 'not_found' : 'already_resolved',
      };
    }
    const s = upd.rows[0]!;
    if (s.household_id !== admin.householdId || !s.task_completion_id) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'forbidden' };
    }

    // Mark the completion denied. NO ledger entry — the kid never got coins.
    // Same-day undo + redo path (Phase 3) is how a kid retries.
    await client.query(
      `UPDATE task_completion
         SET approval_status = 'denied', updated_at = now()
       WHERE id = $1 AND approval_status = 'pending'`,
      [s.task_completion_id],
    );

    await client.query(
      `INSERT INTO audit_log (
         household_id, actor_user_id, action, target_kind, target_id,
         reason, after_json, request_ip, user_agent
       ) VALUES (
         $1, $2, 'submission.denied', 'submission', $3,
         $4, $5, $6, $7
       )`,
      [
        s.household_id,
        admin.userId,
        s.id,
        denyReason,
        JSON.stringify({ deny_reason: denyReason }),
        requestIp,
        userAgent,
      ],
    );

    await client.query('COMMIT');
    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]', 'layout');
    return { ok: true, submissionId: s.id };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('denySubmissionAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}
