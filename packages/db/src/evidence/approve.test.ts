/**
 * Invariant tests for the FCFS approval flow.
 *
 * The critical race is two parents tapping "Approve" on the same submission
 * at the same time. The UPDATE-WHERE-status-pending pattern means exactly
 * one transaction wins. Per BUILD-PLAN §"Phase 5" exit criterion 3 +
 * ARCHITECTURE §10.1: the loser sees "already resolved by Mom 2 min ago,"
 * no double-credit ever lands on the ledger.
 *
 * These tests exercise approveSubmissionOperation directly so the assertions
 * focus on data correctness, not on Next's server-action plumbing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupTestDb,
  seedBaseFixtures,
  displayBalance,
  type TestDbHandle,
  type SeedHandles,
} from '../test-utils/index';
import {
  approveSubmissionOperation,
  type ApproveResult,
} from './approve';
import { ledgerEntry, taskCompletion, submission as submissionTable } from '../schema/index';

let harness: TestDbHandle;
let ids: SeedHandles;

beforeAll(async () => {
  harness = await setupTestDb();
});

beforeEach(async () => {
  await harness.truncate();
  ids = await seedBaseFixtures(harness);
});

afterAll(async () => {
  await harness.close();
});

/** Create a pending completion + submission ready for approval. */
async function seedPendingSubmission(): Promise<{
  completionId: string;
  submissionId: string;
  evidenceId: string;
}> {
  // Evidence row
  const eRes = await harness.pool.query<{ id: string }>(
    `INSERT INTO evidence (household_id, kid_id, filename, mime_type, size_bytes)
     VALUES ($1, $2, 'fixture/x.png', 'image/png', 100)
     RETURNING id`,
    [ids.householdId, ids.liaId],
  );
  const evidenceId = eRes.rows[0]!.id;

  // Pending task_completion for the evidence-required assignment
  const cRes = await harness.pool.query<{ id: string }>(
    `INSERT INTO task_completion (
       household_id, assignment_id, kid_id, completion_date, approval_status
     ) VALUES ($1, $2, $3, CURRENT_DATE, 'pending')
     RETURNING id`,
    [ids.householdId, ids.assignmentLiaEvidenceId, ids.liaId],
  );
  const completionId = cRes.rows[0]!.id;

  // Submission linking them
  const sRes = await harness.pool.query<{ id: string }>(
    `INSERT INTO submission (
       household_id, kid_id, task_completion_id, evidence_id, status
     ) VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [ids.householdId, ids.liaId, completionId, evidenceId],
  );
  const submissionId = sRes.rows[0]!.id;

  // Wire the back-FK
  await harness.pool.query(
    `UPDATE task_completion SET evidence_submission_id = $1 WHERE id = $2`,
    [submissionId, completionId],
  );

  return { completionId, submissionId, evidenceId };
}

async function withTx<T>(fn: (c: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const c = await harness.pool.connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

describe('approveSubmissionOperation — happy path', () => {
  it('marks submission + completion approved AND posts an earn for the template coin_value', async () => {
    const { submissionId, completionId } = await seedPendingSubmission();
    const result = await withTx((c) =>
      approveSubmissionOperation(c, {
        submissionId,
        adminUserId: ids.parentId,
        householdId: ids.householdId,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.ledgerEntry.amount).toBe(20); // taskEvidence has coinValue=20
    expect(result.ledgerEntry.balanceAfter).toBe(20);

    // submission.status = 'approved'
    const s = await harness.db
      .select({ status: submissionTable.status })
      .from(submissionTable)
      .where(eq(submissionTable.id, submissionId));
    expect(s[0]?.status).toBe('approved');

    // completion approval + ledger_credit wired
    const c = await harness.db
      .select({
        status: taskCompletion.approvalStatus,
        ledgerCreditId: taskCompletion.ledgerCreditId,
      })
      .from(taskCompletion)
      .where(eq(taskCompletion.id, completionId));
    expect(c[0]?.status).toBe('approved');
    expect(c[0]?.ledgerCreditId).toBe(result.ledgerEntry.id);

    expect(await displayBalance(harness, ids.liaId)).toBe(20);
  });
});

describe('approveSubmissionOperation — FCFS race', () => {
  it('two concurrent approves: exactly ONE succeeds, the other returns already_resolved', async () => {
    const { submissionId } = await seedPendingSubmission();

    // Fire both approvals in parallel. Each opens its own tx + pool client.
    const [resA, resB] = await Promise.all([
      withTx((c) =>
        approveSubmissionOperation(c, {
          submissionId,
          adminUserId: ids.parentId,
          householdId: ids.householdId,
        }),
      ),
      withTx((c) =>
        approveSubmissionOperation(c, {
          submissionId,
          adminUserId: ids.parentId,
          householdId: ids.householdId,
        }),
      ),
    ]);

    const winners = [resA, resB].filter((r): r is Extract<ApproveResult, { ok: true }> => r.ok);
    const losers = [resA, resB].filter((r): r is Extract<ApproveResult, { ok: false }> => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]!.error).toBe('already_resolved');

    // Only ONE earn entry exists.
    const ledgerRows = await harness.db
      .select({ id: ledgerEntry.id, amount: ledgerEntry.amount })
      .from(ledgerEntry)
      .where(eq(ledgerEntry.kidId, ids.liaId));
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]?.amount).toBe(20);
    expect(await displayBalance(harness, ids.liaId)).toBe(20);
  });

  it('three concurrent approves: exactly ONE succeeds, two return already_resolved', async () => {
    const { submissionId } = await seedPendingSubmission();
    const results = await Promise.all(
      [0, 1, 2].map(() =>
        withTx((c) =>
          approveSubmissionOperation(c, {
            submissionId,
            adminUserId: ids.parentId,
            householdId: ids.householdId,
          }),
        ),
      ),
    );
    const wins = results.filter((r) => r.ok);
    const fails = results.filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(fails).toHaveLength(2);
    expect(fails.every((r) => !r.ok && r.error === 'already_resolved')).toBe(true);

    expect(await displayBalance(harness, ids.liaId)).toBe(20);
  });
});

describe('approveSubmissionOperation — rejection paths', () => {
  it('returns not_found for a missing submission id', async () => {
    const result = await withTx((c) =>
      approveSubmissionOperation(c, {
        submissionId: '00000000-0000-0000-0000-000000000000',
        adminUserId: ids.parentId,
        householdId: ids.householdId,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_found');
  });

  it('returns wrong_household if an admin from a DIFFERENT household tries to approve', async () => {
    const { submissionId } = await seedPendingSubmission();
    const result = await withTx((c) =>
      approveSubmissionOperation(c, {
        submissionId,
        adminUserId: ids.parentId,
        // A different household_id — should never happen via the action
        // (auth scope is checked upstream), but defense-in-depth says no.
        householdId: '00000000-0000-0000-0000-000000000000',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('wrong_household');
  });

  it('returns already_resolved after a prior approve succeeded', async () => {
    const { submissionId } = await seedPendingSubmission();
    await withTx((c) =>
      approveSubmissionOperation(c, {
        submissionId,
        adminUserId: ids.parentId,
        householdId: ids.householdId,
      }),
    );
    const second = await withTx((c) =>
      approveSubmissionOperation(c, {
        submissionId,
        adminUserId: ids.parentId,
        householdId: ids.householdId,
      }),
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('already_resolved');

    expect(await displayBalance(harness, ids.liaId)).toBe(20);
  });
});
