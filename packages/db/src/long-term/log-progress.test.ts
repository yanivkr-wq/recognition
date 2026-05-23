/**
 * Invariant tests for the long-term progress operations.
 *
 * BUILD-PLAN.md Phase 4 risk concentration:
 *   - Per-unit earn accumulates correctly across multiple logProgress calls.
 *   - Bonus posts iff total crosses goal AND bonus_on_complete > 0.
 *   - Bonus REVERSES on undo iff the resulting total drops below goal.
 *   - Cycle: cross goal → undo crossing-row → re-log → cross again → new bonus.
 *
 * Test fixtures (from seedBaseFixtures): task `taskLongTermId` has
 *   per_unit = 1, goal = 100, bonus = 50.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, and, isNull } from 'drizzle-orm';
import {
  setupTestDb,
  seedBaseFixtures,
  ledgerSum,
  displayBalance,
  type TestDbHandle,
  type SeedHandles,
} from '../test-utils/index';
import {
  logProgressOperation,
  type LogProgressResult,
} from './log-progress';
import { undoLongTermProgressOperation } from './undo-progress';
import { taskAssignment, longTermProgress } from '../schema/index';

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

async function withTx<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
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

async function logProgress(quantity: number): Promise<LogProgressResult> {
  return withTx((c) =>
    logProgressOperation(c, {
      householdId: ids.householdId,
      kidId: ids.liaId,
      assignmentId: ids.assignmentLiaLongTermId,
      quantity,
      tz: 'Asia/Jerusalem',
    }),
  );
}

async function undoProgress(progressId: string) {
  return withTx((c) =>
    undoLongTermProgressOperation(c, {
      householdId: ids.householdId,
      kidId: ids.liaId,
      progressId,
      tz: 'Asia/Jerusalem',
    }),
  );
}

async function assignmentCompletedAt(assignmentId: string): Promise<Date | null> {
  const rows = await harness.db
    .select({ x: taskAssignment.longTermCompletedAt })
    .from(taskAssignment)
    .where(eq(taskAssignment.id, assignmentId));
  return rows[0]?.x ?? null;
}

async function activeProgressCount(assignmentId: string): Promise<number> {
  const rows = await harness.db
    .select({ id: longTermProgress.id })
    .from(longTermProgress)
    .where(
      and(
        eq(longTermProgress.assignmentId, assignmentId),
        isNull(longTermProgress.undoneAt),
      ),
    );
  return rows.length;
}

describe('logProgressOperation — input validation', () => {
  it('rejects zero quantity', async () => {
    const r = await logProgress(0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_quantity');
  });

  it('rejects negative quantity', async () => {
    const r = await logProgress(-5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_quantity');
  });

  it('rejects when the assignment is a daily kind, not long-term', async () => {
    const r = await withTx((c) =>
      logProgressOperation(c, {
        householdId: ids.householdId,
        kidId: ids.liaId,
        assignmentId: ids.assignmentLiaDailyId,
        quantity: 5,
        tz: 'Asia/Jerusalem',
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('wrong_kind');
  });

  it('rejects when the kid does not own the assignment', async () => {
    const r = await withTx((c) =>
      logProgressOperation(c, {
        householdId: ids.householdId,
        kidId: ids.yaelId, // Yael trying to log against Lia's long-term task
        assignmentId: ids.assignmentLiaLongTermId,
        quantity: 5,
        tz: 'Asia/Jerusalem',
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_found');
  });
});

describe('logProgressOperation — per-unit earn', () => {
  it('posts a single earn for quantity × per_unit_coins (1 coin/page)', async () => {
    const r = await logProgress(5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.perUnitEarn.amount).toBe(5);
    expect(r.bonusEarn).toBeNull();
    expect(r.newTotal).toBe(5);
    expect(r.goalReached).toBe(false);
    expect(await displayBalance(harness, ids.liaId)).toBe(5);
    expect(await assignmentCompletedAt(ids.assignmentLiaLongTermId)).toBeNull();
  });

  it('accumulates total across multiple logs', async () => {
    await logProgress(20);
    await logProgress(30);
    const r = await logProgress(25);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newTotal).toBe(75);
    expect(r.goalReached).toBe(false);
    expect(await ledgerSum(harness, ids.liaId)).toBe(75);
  });
});

describe('logProgressOperation — goal cross + bonus', () => {
  it('posts the bonus and marks the assignment completed on goal cross', async () => {
    await logProgress(95);
    const r = await logProgress(10); // 95 + 10 = 105 ≥ 100
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newTotal).toBe(105);
    expect(r.goalReached).toBe(true);
    expect(r.perUnitEarn.amount).toBe(10);
    expect(r.bonusEarn?.amount).toBe(50);
    // Per-unit (95) + per-unit (10) + bonus (50) = 155
    expect(await displayBalance(harness, ids.liaId)).toBe(155);
    expect(await assignmentCompletedAt(ids.assignmentLiaLongTermId)).not.toBeNull();
  });

  it('rejects further logs after the assignment is completed', async () => {
    await logProgress(100); // crosses immediately
    const r = await logProgress(5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('already_done');
  });

  it('does NOT post a bonus when bonus_on_complete is null/zero', async () => {
    // Override the seed template's bonus to zero so we can test the "no bonus" path.
    await harness.pool.query(
      `UPDATE task_template SET long_term_bonus_on_complete = 0 WHERE id = $1`,
      [ids.taskLongTermId],
    );
    const r = await logProgress(100);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.goalReached).toBe(true);
    expect(r.bonusEarn).toBeNull();
    expect(await displayBalance(harness, ids.liaId)).toBe(100);
    // Assignment still marked completed even without a bonus.
    expect(await assignmentCompletedAt(ids.assignmentLiaLongTermId)).not.toBeNull();
  });
});

describe('undoLongTermProgressOperation — per-unit only', () => {
  it('reverses the per-unit earn and leaves the assignment open', async () => {
    const a = await logProgress(20);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const u = await undoProgress(a.progressId);
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(u.perUnitUndo?.amount).toBe(-20);
    expect(u.bonusUndo).toBeNull();
    expect(u.newTotal).toBe(0);
    expect(u.assignmentReopened).toBe(false);
    expect(await displayBalance(harness, ids.liaId)).toBe(0);
  });

  it('rejects already-undone rows', async () => {
    const a = await logProgress(10);
    if (!a.ok) throw new Error('setup');
    await undoProgress(a.progressId);
    const u = await undoProgress(a.progressId);
    expect(u.ok).toBe(false);
    if (!u.ok) expect(u.error).toBe('already_undone');
  });

  it('rejects rows owned by a different kid', async () => {
    const a = await logProgress(10);
    if (!a.ok) throw new Error('setup');
    const u = await withTx((c) =>
      undoLongTermProgressOperation(c, {
        householdId: ids.householdId,
        kidId: ids.yaelId, // wrong kid
        progressId: a.progressId,
        tz: 'Asia/Jerusalem',
      }),
    );
    expect(u.ok).toBe(false);
    if (!u.ok) expect(u.error).toBe('not_found');
  });
});

describe('undoLongTermProgressOperation — bonus reversal edge case', () => {
  it('reverses BOTH per-unit AND bonus when undo drops total below goal', async () => {
    // Cross the goal: +95 then +10 → total 105 (bonus fires).
    const first = await logProgress(95);
    if (!first.ok) throw new Error('setup');
    const cross = await logProgress(10);
    if (!cross.ok) throw new Error('setup');
    expect(cross.goalReached).toBe(true);
    expect(await displayBalance(harness, ids.liaId)).toBe(155);
    expect(await assignmentCompletedAt(ids.assignmentLiaLongTermId)).not.toBeNull();

    // Undo the row that crossed the goal.
    const u = await undoProgress(cross.progressId);
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(u.perUnitUndo?.amount).toBe(-10);
    expect(u.bonusUndo?.amount).toBe(-50);
    expect(u.newTotal).toBe(95);
    expect(u.assignmentReopened).toBe(true);
    // 95 (per-unit) remains; 10 (per-unit) reversed; 50 (bonus) reversed.
    expect(await displayBalance(harness, ids.liaId)).toBe(95);
    expect(await assignmentCompletedAt(ids.assignmentLiaLongTermId)).toBeNull();
  });

  it('reverses bonus + reopens even if the undo target is NOT the crossing row', async () => {
    // Cross with +95 then +10 (bonus on the +10 row), then undo the +95 row.
    // Total drops from 105 to 10, still below goal → reverse bonus too.
    const first = await logProgress(95);
    if (!first.ok) throw new Error('setup');
    const cross = await logProgress(10);
    if (!cross.ok) throw new Error('setup');

    const u = await undoProgress(first.progressId);
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(u.perUnitUndo?.amount).toBe(-95);
    expect(u.bonusUndo?.amount).toBe(-50);
    expect(u.newTotal).toBe(10);
    expect(u.assignmentReopened).toBe(true);
    // 10 (per-unit on the crossing row) remains; everything else reversed.
    expect(await displayBalance(harness, ids.liaId)).toBe(10);
  });

  // Note on a NOT-tested scenario: "undo while total stays above goal."
  // This can't happen given the current contract — once an assignment hits
  // long_term_completed_at, further logProgress calls are rejected
  // ('already_done'). So you can't accumulate "above-goal" progress to
  // then undo back to "still above goal." If Phase 7 introduces a way for
  // the engine to keep accepting progress past the goal (e.g., for a
  // streak campaign feeding a long-term task), revisit this.
  it('rejects logProgress once the assignment is completed (already_done)', async () => {
    await logProgress(100);
    const r = await logProgress(5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('already_done');
    // And state unchanged
    expect(await activeProgressCount(ids.assignmentLiaLongTermId)).toBe(1);
  });
});

describe('cycle: cross → undo → re-log → re-cross', () => {
  it('re-crossing the goal posts a fresh bonus entry', async () => {
    const cross1 = await logProgress(100);
    if (!cross1.ok) throw new Error('setup');
    expect(cross1.bonusEarn?.amount).toBe(50);
    expect(await displayBalance(harness, ids.liaId)).toBe(150);

    // Undo it
    const u = await undoProgress(cross1.progressId);
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(u.bonusUndo?.amount).toBe(-50);
    expect(await displayBalance(harness, ids.liaId)).toBe(0);
    expect(await assignmentCompletedAt(ids.assignmentLiaLongTermId)).toBeNull();

    // Re-cross
    const cross2 = await logProgress(100);
    if (!cross2.ok) throw new Error('setup');
    expect(cross2.bonusEarn?.amount).toBe(50);
    expect(cross2.bonusEarn?.id).not.toBe(cross1.bonusEarn?.id);
    expect(await displayBalance(harness, ids.liaId)).toBe(150);
    expect(await assignmentCompletedAt(ids.assignmentLiaLongTermId)).not.toBeNull();
  });
});
