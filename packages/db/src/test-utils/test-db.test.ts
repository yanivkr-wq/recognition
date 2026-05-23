/**
 * Smoke test for the Vitest+Postgres harness itself.
 *
 * If this passes: migrations apply, the truncate helper preserves __migrations,
 * fixed-ID seeds round-trip, and the cross-test isolation behaves as designed.
 * If this fails, every Phase 3 ledger test is going to fail too — so it's
 * intentionally the first test to read when triaging.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupTestDb,
  seedBaseFixtures,
  IDS,
  type TestDbHandle,
} from './index';
import { household, kid, taskAssignment } from '../schema/index';

let harness: TestDbHandle;

beforeAll(async () => {
  harness = await setupTestDb();
});

beforeEach(async () => {
  await harness.truncate();
});

afterAll(async () => {
  await harness.close();
});

describe('test-db harness', () => {
  it('seeds + reads back a household', async () => {
    await seedBaseFixtures(harness);
    const rows = await harness.db
      .select({ name: household.name })
      .from(household)
      .where(eq(household.id, IDS.household));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Test Household');
  });

  it('isolates state between tests via truncate', async () => {
    // No seeding done in this test — if the previous test's data leaked,
    // we'd see >0 rows.
    const kids = await harness.db.select({ id: kid.id }).from(kid);
    expect(kids).toHaveLength(0);
    const households = await harness.db.select({ id: household.id }).from(household);
    expect(households).toHaveLength(0);
  });

  it('preserves __migrations across truncates (no re-apply)', async () => {
    const res = await harness.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM __migrations`,
    );
    expect(Number(res.rows[0]?.count ?? 0)).toBeGreaterThan(0);
  });

  it('respects circular FKs via CASCADE during truncate', async () => {
    // Round-trip: seed → assignments exist → truncate clears them
    await seedBaseFixtures(harness);
    const before = await harness.db.select({ id: taskAssignment.id }).from(taskAssignment);
    expect(before.length).toBeGreaterThan(0);

    await harness.truncate();
    const after = await harness.db.select({ id: taskAssignment.id }).from(taskAssignment);
    expect(after).toHaveLength(0);
  });
});
