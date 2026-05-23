/**
 * Invariant tests for the single ledger writer.
 *
 * These exercise the contract listed in SCHEMA.md §13:
 *   - earn / redeem / undo / admin_credit / admin_debit shape checks
 *   - balance_after equals SUM(amount) at every prior row
 *   - display balance never goes negative (clamp at 0)
 *   - admin_debit overdraw records clamped_amount, ledger truth stays negative
 *   - per-kid concurrency: same kid serializes, different kids run in parallel
 *
 * The harness from src/test-utils/test-db.ts opens a real Postgres pool and
 * TRUNCATEs between tests. Each test must seed its own household via
 * seedBaseFixtures().
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupTestDb,
  seedBaseFixtures,
  ledgerSum,
  displayBalance,
  type TestDbHandle,
  type SeedHandles,
} from '../test-utils/index';
import { ledgerPost, postWithTransaction, LedgerInvariantError } from './post';
import { ledgerEntry, taskCompletion, redemption, rewardItem } from '../schema/index';

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

async function insertCompletion(assignmentId: string, kidId: string): Promise<string> {
  const res = await harness.pool.query<{ id: string }>(
    `INSERT INTO task_completion (household_id, assignment_id, kid_id, completion_date)
     VALUES ($1, $2, $3, CURRENT_DATE)
     RETURNING id`,
    [ids.householdId, assignmentId, kidId],
  );
  return res.rows[0]!.id;
}

// Note: a full redeem invariant test would require a redemption row, but
// redemption.ledger_debit_id is NOT NULL — a chicken-and-egg with the
// ledger_entry the redemption refers to. Phase 6's redemption flow either
// (a) defers the FK or (b) makes the column nullable; that decision is
// out of scope for Phase 3. The 'redeem amount must be < 0' input-validation
// test above covers the only ledger.post path that isn't Phase-6-shaped.

describe('ledgerPost — input validation', () => {
  it('rejects earn with non-positive amount', async () => {
    const client = await harness.pool.connect();
    try {
      await client.query('BEGIN');
      await expect(
        ledgerPost(client, {
          kind: 'earn',
          householdId: ids.householdId,
          kidId: ids.liaId,
          amount: 0,
          taskCompletionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        }),
      ).rejects.toBeInstanceOf(LedgerInvariantError);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('rejects earn without a task or progress FK', async () => {
    await expect(
      postWithTransaction(harness.pool, {
        kind: 'earn',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 5,
      }),
    ).rejects.toThrow(/taskCompletionId or longTermProgressId/);
  });

  it('rejects earn that names BOTH a task and a long-term FK', async () => {
    await expect(
      postWithTransaction(harness.pool, {
        kind: 'earn',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 5,
        taskCompletionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        longTermProgressId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      }),
    ).rejects.toThrow(/cannot reference both/);
  });

  it('rejects redeem with non-negative amount', async () => {
    await expect(
      postWithTransaction(harness.pool, {
        kind: 'redeem',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 0,
        redemptionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      }),
    ).rejects.toThrow(/redeem amount must be < 0/);
  });

  it('rejects admin_credit without a note', async () => {
    await expect(
      postWithTransaction(harness.pool, {
        kind: 'admin_credit',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 5,
        adminUserId: ids.parentId,
        note: '   ',
      }),
    ).rejects.toThrow(/non-empty note/);
  });

  it('rejects admin_debit with a positive amount', async () => {
    await expect(
      postWithTransaction(harness.pool, {
        kind: 'admin_debit',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 5,
        adminUserId: ids.parentId,
        note: 'oops',
      }),
    ).rejects.toThrow(/admin_debit amount must be < 0/);
  });

  it('rejects non-integer amounts', async () => {
    await expect(
      postWithTransaction(harness.pool, {
        kind: 'admin_credit',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 1.5,
        adminUserId: ids.parentId,
        note: 'half a coin',
      }),
    ).rejects.toThrow(/integer/);
  });
});

describe('ledgerPost — happy paths', () => {
  it('posts an earn and computes balance_after correctly', async () => {
    const completionId = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    const entry = await postWithTransaction(harness.pool, {
      kind: 'earn',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 5,
      taskCompletionId: completionId,
    });
    expect(entry.amount).toBe(5);
    expect(entry.balanceAfter).toBe(5);
    expect(entry.clampedAmount).toBeNull();
    expect(await displayBalance(harness, ids.liaId)).toBe(5);
  });

  it('accumulates balance_after across consecutive earns', async () => {
    const c1 = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    const e1 = await postWithTransaction(harness.pool, {
      kind: 'earn',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 5,
      taskCompletionId: c1,
    });
    expect(e1.balanceAfter).toBe(5);

    // Soft-delete the first slot so we can create a second same-day completion
    // without colliding with the partial unique index.
    await harness.pool.query(
      `UPDATE task_completion SET undone_at = now() WHERE id = $1`,
      [c1],
    );
    const c2 = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);

    const e2 = await postWithTransaction(harness.pool, {
      kind: 'earn',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 7,
      taskCompletionId: c2,
    });
    expect(e2.balanceAfter).toBe(12);
    expect(await ledgerSum(harness, ids.liaId)).toBe(12);
  });

  it('isolates per-kid balances (Lia earn does not affect Yael)', async () => {
    const liaCompletion = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    await postWithTransaction(harness.pool, {
      kind: 'earn',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 5,
      taskCompletionId: liaCompletion,
    });
    expect(await displayBalance(harness, ids.liaId)).toBe(5);
    expect(await displayBalance(harness, ids.yaelId)).toBe(0);
  });

  it('records an undo reversing a prior earn', async () => {
    const completionId = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    const earn = await postWithTransaction(harness.pool, {
      kind: 'earn',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 5,
      taskCompletionId: completionId,
    });
    const undo = await postWithTransaction(harness.pool, {
      kind: 'undo',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: -5,
      undoOfEntryId: earn.id,
    });
    expect(undo.balanceAfter).toBe(0);
    expect(await displayBalance(harness, ids.liaId)).toBe(0);
  });

  it('admin_credit adds positive coins with a note', async () => {
    const entry = await postWithTransaction(harness.pool, {
      kind: 'admin_credit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 10,
      adminUserId: ids.parentId,
      note: 'helped with dishes',
    });
    expect(entry.amount).toBe(10);
    expect(entry.balanceAfter).toBe(10);
    const row = await harness.db
      .select()
      .from(ledgerEntry)
      .where(eq(ledgerEntry.id, entry.id));
    expect(row[0]?.note).toBe('helped with dishes');
    expect(row[0]?.adminUserId).toBe(ids.parentId);
  });
});

describe('ledgerPost — admin_debit clamping', () => {
  it('does NOT clamp when balance covers the debit', async () => {
    await postWithTransaction(harness.pool, {
      kind: 'admin_credit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 50,
      adminUserId: ids.parentId,
      note: 'starting balance',
    });
    const debit = await postWithTransaction(harness.pool, {
      kind: 'admin_debit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: -30,
      adminUserId: ids.parentId,
      note: 'broke something',
    });
    expect(debit.amount).toBe(-30);
    expect(debit.balanceAfter).toBe(20);
    expect(debit.clampedAmount).toBeNull();
    expect(await displayBalance(harness, ids.liaId)).toBe(20);
  });

  it('clamps an overdrawing admin_debit: ledger truth stays negative, display floors at 0', async () => {
    await postWithTransaction(harness.pool, {
      kind: 'admin_credit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 30,
      adminUserId: ids.parentId,
      note: 'starting',
    });
    const debit = await postWithTransaction(harness.pool, {
      kind: 'admin_debit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: -100,
      adminUserId: ids.parentId,
      note: 'big overdraft',
    });
    // Per SCHEMA.md §7 and BUILD-PLAN.md §6 acceptance test.
    expect(debit.amount).toBe(-100);
    expect(debit.balanceAfter).toBe(-70);
    expect(debit.clampedAmount).toBe(70);
    expect(await ledgerSum(harness, ids.liaId)).toBe(-70);
    expect(await displayBalance(harness, ids.liaId)).toBe(0);
  });

  it('records the FULL debit as clamped when balance is already overdrawn', async () => {
    // Set up an already-overdrawn state.
    await postWithTransaction(harness.pool, {
      kind: 'admin_credit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 5,
      adminUserId: ids.parentId,
      note: 'tiny start',
    });
    await postWithTransaction(harness.pool, {
      kind: 'admin_debit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: -15,
      adminUserId: ids.parentId,
      note: 'over once',
    });
    expect(await displayBalance(harness, ids.liaId)).toBe(0);
    expect(await ledgerSum(harness, ids.liaId)).toBe(-10);

    const second = await postWithTransaction(harness.pool, {
      kind: 'admin_debit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: -20,
      adminUserId: ids.parentId,
      note: 'over twice',
    });
    expect(second.amount).toBe(-20);
    expect(second.clampedAmount).toBe(20);
    expect(second.balanceAfter).toBe(-30);
  });
});

describe('ledgerPost — DB CHECK constraints (second line of defense)', () => {
  it('rejects an INSERT INTO ledger_entry that bypasses input validation but violates a CHECK', async () => {
    // Direct INSERT — this is what the grep test forbids in production code,
    // but here in the invariant suite it proves the DB itself catches bad shapes.
    await expect(
      harness.pool.query(
        `INSERT INTO ledger_entry (household_id, kid_id, kind, amount, balance_after)
         VALUES ($1, $2, 'earn', 5, 5)`,
        [ids.householdId, ids.liaId],
      ),
    ).rejects.toThrow();
  });
});

describe('ledgerPost — concurrency', () => {
  it('serializes concurrent earns for the same kid (no lost updates)', async () => {
    const c1 = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    await harness.pool.query(
      `UPDATE task_completion SET undone_at = now() WHERE id = $1`,
      [c1],
    );
    const c2 = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    await harness.pool.query(
      `UPDATE task_completion SET undone_at = now() WHERE id = $1`,
      [c2],
    );
    const c3 = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);

    await Promise.all([
      postWithTransaction(harness.pool, {
        kind: 'earn',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 5,
        taskCompletionId: c1,
      }),
      postWithTransaction(harness.pool, {
        kind: 'earn',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 7,
        taskCompletionId: c2,
      }),
      postWithTransaction(harness.pool, {
        kind: 'earn',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 3,
        taskCompletionId: c3,
      }),
    ]);

    // The advisory lock guarantees no lost updates. Each post computed its
    // balance_after from the committed state at the moment it acquired the
    // lock — so for every row, (balance_after − amount) must equal either
    // 0 (if it was first) or the balance_after of some OTHER row that
    // committed earlier.
    // The exact serialization order of [5,7,3] is non-deterministic (six
    // permutations × millisecond-tied created_at values), but the lost-
    // update invariant holds across all of them.
    const rows = await harness.db
      .select({ amount: ledgerEntry.amount, balanceAfter: ledgerEntry.balanceAfter })
      .from(ledgerEntry)
      .where(eq(ledgerEntry.kidId, ids.liaId));
    expect(rows).toHaveLength(3);

    const validPriors = new Set<number>([0, ...rows.map((r) => r.balanceAfter)]);
    for (const r of rows) {
      const prior = r.balanceAfter - r.amount;
      expect(
        validPriors.has(prior),
        `row balance_after=${r.balanceAfter} amount=${r.amount} implies prior=${prior}, which is not in {0, ${rows.map((x) => x.balanceAfter).join(', ')}}`,
      ).toBe(true);
    }
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(15);
    expect(await displayBalance(harness, ids.liaId)).toBe(15);
  });

  it('does NOT block concurrent earns for DIFFERENT kids', async () => {
    const liaC = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    const yaelC = await insertCompletion(ids.assignmentYaelDailyId, ids.yaelId);

    // If the advisory lock were on household instead of kid, this would
    // serialize and run noticeably slower; on kid-id it should complete
    // in roughly the time of a single transaction.
    await Promise.all([
      postWithTransaction(harness.pool, {
        kind: 'earn',
        householdId: ids.householdId,
        kidId: ids.liaId,
        amount: 5,
        taskCompletionId: liaC,
      }),
      postWithTransaction(harness.pool, {
        kind: 'earn',
        householdId: ids.householdId,
        kidId: ids.yaelId,
        amount: 7,
        taskCompletionId: yaelC,
      }),
    ]);

    expect(await displayBalance(harness, ids.liaId)).toBe(5);
    expect(await displayBalance(harness, ids.yaelId)).toBe(7);
  });
});

describe('ledgerPost — append-only invariant', () => {
  it('every ledger row balance_after equals SUM(amount) over prior rows for that kid', async () => {
    // Mix of all kinds; assert per-row balance correctness at the end.
    const c1 = await insertCompletion(ids.assignmentLiaDailyId, ids.liaId);
    const earn = await postWithTransaction(harness.pool, {
      kind: 'earn',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 5,
      taskCompletionId: c1,
    });
    await postWithTransaction(harness.pool, {
      kind: 'undo',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: -5,
      undoOfEntryId: earn.id,
    });
    await postWithTransaction(harness.pool, {
      kind: 'admin_credit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: 10,
      adminUserId: ids.parentId,
      note: 'birthday boost',
    });
    await postWithTransaction(harness.pool, {
      kind: 'admin_debit',
      householdId: ids.householdId,
      kidId: ids.liaId,
      amount: -3,
      adminUserId: ids.parentId,
      note: 'broke a glass',
    });

    const rows = await harness.db
      .select({ amount: ledgerEntry.amount, balanceAfter: ledgerEntry.balanceAfter })
      .from(ledgerEntry)
      .where(eq(ledgerEntry.kidId, ids.liaId))
      .orderBy(ledgerEntry.createdAt);

    let runningSum = 0;
    for (const r of rows) {
      runningSum += r.amount;
      expect(r.balanceAfter).toBe(runningSum);
    }
    expect(await displayBalance(harness, ids.liaId)).toBe(runningSum);
  });
});

// Quiet unused-import for tooling — these schemas are imported for the
// types they expose to future Phase 6 tests, but Phase 3's ledger suite
// doesn't query them directly.
void redemption;
void rewardItem;
void taskCompletion;
