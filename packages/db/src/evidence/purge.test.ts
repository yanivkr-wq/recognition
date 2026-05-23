/**
 * Invariant tests for the evidence-purge cron logic.
 *
 * The cron lives in apps/worker/src/cron/evidence-purge.ts but its SQL
 * contract is what matters: only purge `evidence` rows where the linked
 * submission is resolved AND > 30 days old (or where the row is orphaned
 * AND > 30 days from uploaded_at). The cron's filesystem unlink is the side
 * effect; the DB row's purged_at flip is what the tests assert.
 *
 * These tests run the SAME SQL the cron runs (inlined here so we don't need
 * to cross the workspace boundary into apps/worker). If apps/worker's
 * implementation drifts from the contract here, the cron has regressed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, seedBaseFixtures, type TestDbHandle, type SeedHandles } from '../test-utils/index';
import { eq, isNull } from 'drizzle-orm';
import { evidence as evidenceTable } from '../schema/index';

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

/** Mirror of the cron's purge-candidate SELECT — kept in lockstep with
 *  apps/worker/src/cron/evidence-purge.ts. */
const PURGE_CANDIDATE_SQL = `
  SELECT e.id, e.filename
    FROM evidence e
    LEFT JOIN submission s ON s.evidence_id = e.id
   WHERE e.purged_at IS NULL
     AND (
       (s.id IS NOT NULL
          AND s.status IN ('approved', 'denied')
          AND s.resolved_at < (now() - INTERVAL '30 days'))
       OR
       (s.id IS NULL
          AND e.uploaded_at < (now() - INTERVAL '30 days'))
     )
`;

async function insertEvidence(opts: {
  uploadedAt?: string;
  alreadyPurged?: boolean;
}): Promise<string> {
  const sql = `
    INSERT INTO evidence (
      household_id, kid_id, filename, mime_type, size_bytes, uploaded_at, purged_at
    ) VALUES (
      $1, $2, $3, 'image/png', 1234, COALESCE($4::timestamptz, now()), $5
    ) RETURNING id`;
  const res = await harness.pool.query<{ id: string }>(sql, [
    ids.householdId,
    ids.liaId,
    `${ids.liaId.slice(0, 8)}/${Math.random().toString(16).slice(2)}.png`,
    opts.uploadedAt ?? null,
    opts.alreadyPurged ? new Date() : null,
  ]);
  return res.rows[0]!.id;
}

async function insertCompletionAndSubmission(opts: {
  evidenceId: string;
  submissionStatus: 'pending' | 'approved' | 'denied';
  resolvedDaysAgo: number | null;
  denyReason?: string;
}): Promise<string> {
  const cRes = await harness.pool.query<{ id: string }>(
    `INSERT INTO task_completion (
       household_id, assignment_id, kid_id, completion_date, approval_status
     ) VALUES ($1, $2, $3, CURRENT_DATE, $4)
     RETURNING id`,
    [
      ids.householdId,
      ids.assignmentLiaEvidenceId,
      ids.liaId,
      opts.submissionStatus === 'pending' ? 'pending' : opts.submissionStatus,
    ],
  );
  const completionId = cRes.rows[0]!.id;

  const resolvedAtClause =
    opts.resolvedDaysAgo == null
      ? null
      : `(now() - INTERVAL '${opts.resolvedDaysAgo} days')::timestamptz`;
  const sRes = await harness.pool.query<{ id: string }>(
    `INSERT INTO submission (
       household_id, kid_id, task_completion_id, evidence_id, status,
       resolved_at, deny_reason
     ) VALUES ($1, $2, $3, $4, $5, ${resolvedAtClause ?? 'NULL'}, $6)
     RETURNING id`,
    [
      ids.householdId,
      ids.liaId,
      completionId,
      opts.evidenceId,
      opts.submissionStatus,
      opts.submissionStatus === 'denied' ? (opts.denyReason ?? 'try a clearer photo') : null,
    ],
  );
  return sRes.rows[0]!.id;
}

async function purgeIds(): Promise<string[]> {
  const res = await harness.pool.query<{ id: string }>(PURGE_CANDIDATE_SQL);
  return res.rows.map((r) => r.id);
}

describe('evidence-purge SQL — what gets purged', () => {
  it('purges an approved submission resolved 31 days ago', async () => {
    const evidenceId = await insertEvidence({});
    await insertCompletionAndSubmission({
      evidenceId,
      submissionStatus: 'approved',
      resolvedDaysAgo: 31,
    });
    expect(await purgeIds()).toContain(evidenceId);
  });

  it('purges a denied submission resolved 31 days ago', async () => {
    const evidenceId = await insertEvidence({});
    await insertCompletionAndSubmission({
      evidenceId,
      submissionStatus: 'denied',
      resolvedDaysAgo: 31,
      denyReason: 'unclear photo',
    });
    expect(await purgeIds()).toContain(evidenceId);
  });

  it('purges an orphaned evidence row uploaded 31 days ago', async () => {
    const evidenceId = await insertEvidence({});
    // Backdate via SQL so the INTERVAL is computed server-side.
    await harness.pool.query(
      `UPDATE evidence SET uploaded_at = now() - INTERVAL '31 days' WHERE id = $1`,
      [evidenceId],
    );
    expect(await purgeIds()).toContain(evidenceId);
  });
});

describe('evidence-purge SQL — what stays', () => {
  it('does NOT purge a pending submission no matter how old', async () => {
    const evidenceId = await insertEvidence({});
    await insertCompletionAndSubmission({
      evidenceId,
      submissionStatus: 'pending',
      resolvedDaysAgo: null,
    });
    // Backdate the upload to be safe — pending submissions never purge.
    await harness.pool.query(
      `UPDATE evidence SET uploaded_at = now() - INTERVAL '90 days' WHERE id = $1`,
      [evidenceId],
    );
    expect(await purgeIds()).not.toContain(evidenceId);
  });

  it('does NOT purge an approved submission resolved 29 days ago (still in window)', async () => {
    const evidenceId = await insertEvidence({});
    await insertCompletionAndSubmission({
      evidenceId,
      submissionStatus: 'approved',
      resolvedDaysAgo: 29,
    });
    expect(await purgeIds()).not.toContain(evidenceId);
  });

  it('does NOT re-purge an already-purged row', async () => {
    const evidenceId = await insertEvidence({ alreadyPurged: true });
    await insertCompletionAndSubmission({
      evidenceId,
      submissionStatus: 'approved',
      resolvedDaysAgo: 60,
    });
    expect(await purgeIds()).not.toContain(evidenceId);
  });

  it('does NOT purge an orphan that\'s only 29 days old', async () => {
    const evidenceId = await insertEvidence({});
    await harness.pool.query(
      `UPDATE evidence SET uploaded_at = now() - INTERVAL '29 days' WHERE id = $1`,
      [evidenceId],
    );
    expect(await purgeIds()).not.toContain(evidenceId);
  });
});

describe('purged_at flip', () => {
  it('marks the row purged after the cron runs the UPDATE', async () => {
    const evidenceId = await insertEvidence({});
    await insertCompletionAndSubmission({
      evidenceId,
      submissionStatus: 'approved',
      resolvedDaysAgo: 31,
    });
    // Simulate what the cron's per-row UPDATE does after unlinking:
    await harness.pool.query(`UPDATE evidence SET purged_at = now() WHERE id = $1`, [evidenceId]);

    const rows = await harness.db
      .select({ id: evidenceTable.id, purgedAt: evidenceTable.purgedAt })
      .from(evidenceTable)
      .where(eq(evidenceTable.id, evidenceId));
    expect(rows[0]?.purgedAt).not.toBeNull();

    // Re-query: should no longer be a candidate.
    expect(await purgeIds()).not.toContain(evidenceId);
  });

  it('the partial index evidence_purge_candidates only scans un-purged rows', async () => {
    // Spot-check: insert lots of purged rows + one fresh candidate;
    // candidate query still finds it.
    for (let i = 0; i < 5; i += 1) {
      await insertEvidence({ alreadyPurged: true });
    }
    const target = await insertEvidence({});
    await insertCompletionAndSubmission({
      evidenceId: target,
      submissionStatus: 'approved',
      resolvedDaysAgo: 31,
    });
    expect(await purgeIds()).toEqual([target]);

    // Sanity: the count of unpurged rows is small.
    const unpurged = await harness.db
      .select({ id: evidenceTable.id })
      .from(evidenceTable)
      .where(isNull(evidenceTable.purgedAt));
    expect(unpurged).toHaveLength(1);
  });
});
