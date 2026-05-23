/**
 * In-tx primitive for FCFS submission approval.
 *
 * The atomicity contract (BUILD-PLAN §"Phase 5" step 6, ARCHITECTURE §10.1):
 *
 *   UPDATE submission SET status='approved' WHERE id=$1 AND status='pending'
 *
 * is the single critical row. If `rowcount=0`, the other parent already
 * resolved this submission and we return `already_resolved` — the UI shows
 * "Mom approved this 2 min ago" instead of a generic error.
 *
 * If `rowcount=1`, we're the winner. We then:
 *   - look up the task_completion + template.coin_value
 *   - post the earn through `ledgerPost()` (the single ledger writer)
 *   - mark the completion approved + wire its ledger_credit_id
 *   - INSERT audit_log (household-visible record both parents see)
 *
 * All four steps run in the caller's transaction. The caller (web server
 * action) opens BEGIN and decides what to do on error. Tests bypass the
 * server action and call this directly, asserting that two concurrent
 * callers serialize as expected.
 */

import type { PoolClient } from 'pg';
import { ledgerPost, type PostedEntry } from '../ledger/post';
import { processCompletionForCampaigns } from '../campaigns/process-completion';

export interface ApproveInput {
  submissionId: string;
  adminUserId: string;
  /** Defense-in-depth: the action verifies the submission's household_id
   *  matches the admin's session. We pass it explicitly so the test harness
   *  can prove cross-household submissions are rejected. */
  householdId: string;
  requestIp?: string | null;
  userAgent?: string | null;
}

export type ApproveResult =
  | { ok: true; submissionId: string; ledgerEntry: PostedEntry }
  | {
      ok: false;
      error:
        | 'not_found'
        | 'already_resolved'
        | 'wrong_household'
        | 'completion_already_resolved';
    };

export async function approveSubmissionOperation(
  client: PoolClient,
  input: ApproveInput,
): Promise<ApproveResult> {
  // 1. FCFS UPDATE — only succeeds if status is still 'pending'.
  const upd = await client.query<{
    id: string;
    task_completion_id: string | null;
    kid_id: string;
    household_id: string;
  }>(
    `UPDATE submission
       SET status = 'approved',
           resolved_at = now(),
           resolved_by_user_id = $1
     WHERE id = $2 AND status = 'pending'
     RETURNING id, task_completion_id, kid_id, household_id`,
    [input.adminUserId, input.submissionId],
  );
  if (upd.rowCount !== 1) {
    // Distinguish "doesn't exist" from "another parent already resolved" via
    // a separate SELECT. Both result in the same UX, but the typed error
    // lets the admin queue page narrow the message.
    const exists = await client.query<{ id: string }>(
      `SELECT id FROM submission WHERE id = $1`,
      [input.submissionId],
    );
    return {
      ok: false,
      error: exists.rowCount === 0 ? 'not_found' : 'already_resolved',
    };
  }
  const s = upd.rows[0]!;

  if (s.household_id !== input.householdId) {
    // The action shouldn't even reach this branch (admin scope is checked
    // before we open the tx), but the defense-in-depth check matters if a
    // future refactor inadvertently widens the scope.
    return { ok: false, error: 'wrong_household' };
  }
  if (!s.task_completion_id) {
    // Submission with no task_completion_id is a long-term-progress
    // submission (Phase 4 territory). Long-term approvals don't pass
    // through this operation in v1.
    return { ok: false, error: 'not_found' };
  }

  // 2. Look up the completion + template.coin_value + template_id (for the
  //    Phase 7 campaign fan-out below) + completion_date.
  const cRes = await client.query<{
    coin_value: number;
    approval_status: string;
    template_id: string;
    completion_date: string;
  }>(
    `SELECT tt.coin_value,
            tc.approval_status,
            tt.id            AS template_id,
            tc.completion_date::text AS completion_date
     FROM task_completion tc
     JOIN task_assignment ta ON ta.id = tc.assignment_id
     JOIN task_template tt ON tt.id = ta.template_id
     WHERE tc.id = $1`,
    [s.task_completion_id],
  );
  const c = cRes.rows[0];
  if (!c) return { ok: false, error: 'not_found' };
  if (c.approval_status !== 'pending') {
    return { ok: false, error: 'completion_already_resolved' };
  }

  // 3. Post the earn.
  const entry = await ledgerPost(client, {
    kind: 'earn',
    householdId: s.household_id,
    kidId: s.kid_id,
    amount: c.coin_value,
    taskCompletionId: s.task_completion_id,
  });

  // 4. Mark completion approved + wire ledger credit.
  await client.query(
    `UPDATE task_completion
       SET approval_status = 'approved',
           ledger_credit_id = $1,
           updated_at = now()
     WHERE id = $2`,
    [entry.id, s.task_completion_id],
  );

  // 5. Audit row.
  await client.query(
    `INSERT INTO audit_log (
       household_id, actor_user_id, action, target_kind, target_id,
       after_json, request_ip, user_agent
     ) VALUES (
       $1, $2, 'submission.approved', 'submission', $3,
       $4, $5, $6
     )`,
    [
      s.household_id,
      input.adminUserId,
      s.id,
      JSON.stringify({ coins: c.coin_value, ledger_entry_id: entry.id }),
      input.requestIp ?? null,
      input.userAgent ?? null,
    ],
  );

  // 6. Phase 7 — campaign fan-out. The approval just made the completion
  //    visible to the engines (approval_status 'pending' → 'approved'), so
  //    we run processCompletion now. Failures here roll back the whole
  //    approval (the caller's transaction owns the BEGIN/COMMIT).
  await processCompletionForCampaigns(client, {
    kidId: s.kid_id,
    householdId: s.household_id,
    templateId: c.template_id,
    asOfDate: c.completion_date,
  });

  return { ok: true, submissionId: s.id, ledgerEntry: entry };
}
