/**
 * Invariant tests for redeemOperation + the lifecycle operations.
 *
 * The critical concurrency point: two redemptions of the same low-stock
 * reward landing simultaneously. The FOR UPDATE row lock + the stock
 * decrement `WHERE stock_quantity > 0` together must guarantee exactly
 * one winner. The deferred FK from migration 0004 lets the operation
 * INSERT the ledger entry referencing the redemption that lands later
 * in the same transaction; rollback safety means a failed redeem doesn't
 * mint an orphan ledger row.
 *
 * Lifecycle invariants cover the FCFS contract on mark-received +
 * cancel + refund: the single `UPDATE … WHERE status='<expected>'` is
 * the integrity surface; rowcount-0 returns a typed `already_resolved`
 * rather than throwing.
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
import {
  redeemOperation,
  markRedemptionReceivedOperation,
  cancelRedemptionOperation,
  refundRedemptionOperation,
} from './index';
import { ledgerPost } from '../ledger/post';
import { ledgerEntry, redemption, rewardItem } from '../schema/index';

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

interface RewardOpts {
  coinCost?: number;
  stockQuantity?: number | null;
  maxPerKidPerDay?: number | null;
  visibleToKids?: boolean;
  archived?: boolean;
}

/** Create a reward in the test household with sensible defaults. */
async function makeReward(opts: RewardOpts = {}): Promise<string> {
  const res = await harness.pool.query<{ id: string }>(
    `INSERT INTO reward_item (
       household_id, title_he, title_en, icon_key, color, coin_cost,
       stock_quantity, max_per_kid_per_day, visible_to_kids, archived_at
     ) VALUES ($1, 'פרס', 'Reward', 'rw-candy', '#FFF0F6', $2,
       $3, $4, $5, $6)
     RETURNING id`,
    [
      ids.householdId,
      opts.coinCost ?? 5,
      opts.stockQuantity ?? null,
      opts.maxPerKidPerDay ?? null,
      opts.visibleToKids ?? true,
      opts.archived ? new Date() : null,
    ],
  );
  return res.rows[0]!.id;
}

/** Credit a kid's wallet via the joker path so they have spendable coins. */
async function giveKidCoins(kidId: string, amount: number): Promise<void> {
  const c = await harness.pool.connect();
  try {
    await c.query('BEGIN');
    await ledgerPost(c, {
      kind: 'admin_credit',
      householdId: ids.householdId,
      kidId,
      amount,
      adminUserId: ids.parentId,
      note: 'test seed credit',
    });
    await c.query('COMMIT');
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
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

// ──────────────────────────────────────────────────────────────────────────────
// redeemOperation
// ──────────────────────────────────────────────────────────────────────────────

describe('redeemOperation — happy path', () => {
  it('debits the wallet AND writes a redemption with circular FKs populated', async () => {
    const rewardId = await makeReward({ coinCost: 3 });
    await giveKidCoins(ids.liaId, 10);

    const result = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coinCost).toBe(3);
    expect(result.ledgerEntry.amount).toBe(-3);
    expect(result.ledgerEntry.balanceAfter).toBe(7);

    // redemption row landed with snapshot + circular FK
    const rows = await harness.db
      .select()
      .from(redemption)
      .where(eq(redemption.id, result.redemptionId));
    expect(rows[0]?.snapshotCoinCost).toBe(3);
    expect(rows[0]?.snapshotTitleHe).toBe('פרס');
    expect(rows[0]?.status).toBe('pending_delivery');
    expect(rows[0]?.ledgerDebitId).toBe(result.ledgerEntry.id);

    // ledger row's redemption_id points back
    const lrows = await harness.db
      .select()
      .from(ledgerEntry)
      .where(eq(ledgerEntry.id, result.ledgerEntry.id));
    expect(lrows[0]?.redemptionId).toBe(result.redemptionId);
    expect(lrows[0]?.kind).toBe('redeem');

    // Display balance reflects the debit.
    expect(await displayBalance(harness, ids.liaId)).toBe(7);
  });
});

describe('redeemOperation — rejections', () => {
  it('rejects when reward does not exist', async () => {
    const result = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: '00000000-0000-0000-0000-000000000000',
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });

  it('rejects when reward is archived', async () => {
    const rewardId = await makeReward({ archived: true });
    await giveKidCoins(ids.liaId, 10);
    const result = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(result).toEqual({ ok: false, error: 'unavailable' });
  });

  it('rejects when reward is hidden from kids', async () => {
    const rewardId = await makeReward({ visibleToKids: false });
    await giveKidCoins(ids.liaId, 10);
    const result = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(result).toEqual({ ok: false, error: 'unavailable' });
  });

  it('rejects when stock_quantity is 0', async () => {
    const rewardId = await makeReward({ stockQuantity: 0 });
    await giveKidCoins(ids.liaId, 10);
    const result = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('out_of_stock');
  });

  it('rejects when balance < cost AND surfaces the deficit', async () => {
    const rewardId = await makeReward({ coinCost: 15 });
    await giveKidCoins(ids.liaId, 10);
    const result = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('insufficient_funds');
      expect(result.meta?.coinCost).toBe(15);
      expect(result.meta?.spendable).toBe(10);
    }
    // No partial state landed.
    expect(await ledgerSum(harness, ids.liaId)).toBe(10);
  });

  it('rejects when per-day cap reached', async () => {
    const rewardId = await makeReward({ coinCost: 2, maxPerKidPerDay: 1 });
    await giveKidCoins(ids.liaId, 10);
    // First redeem succeeds.
    const first = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(first.ok).toBe(true);
    // Second on the same day → cap.
    const second = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      }),
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toBe('per_day_cap_exceeded');
      expect(second.meta?.capLimit).toBe(1);
      expect(second.meta?.capUsedToday).toBe(1);
    }
  });

  it('rejects cross-household reward id (defense in depth)', async () => {
    // Insert an other-household reward via raw SQL (skip seedBaseFixtures's scope).
    const otherHouseholdId = '99999999-9999-9999-9999-999999999999';
    await harness.pool.query(
      `INSERT INTO household (id, name) VALUES ($1, 'Other') ON CONFLICT DO NOTHING`,
      [otherHouseholdId],
    );
    const orRes = await harness.pool.query<{ id: string }>(
      `INSERT INTO reward_item (
         household_id, title_he, title_en, icon_key, color, coin_cost
       ) VALUES ($1, 'X', 'X', 'rw-x', '#FFF', 1)
       RETURNING id`,
      [otherHouseholdId],
    );
    await giveKidCoins(ids.liaId, 10);
    const result = await withTx((c) =>
      redeemOperation(c, {
        rewardItemId: orRes.rows[0]!.id,
        kidId: ids.liaId,
        householdId: ids.householdId, // attacker passes their own household
      }),
    );
    expect(result).toEqual({ ok: false, error: 'wrong_household' });
  });
});

describe('redeemOperation — concurrent stock decrement', () => {
  it('serializes two concurrent redemptions of a stock-1 reward: ONE wins', async () => {
    const rewardId = await makeReward({ coinCost: 2, stockQuantity: 1 });
    await giveKidCoins(ids.liaId, 10);
    await giveKidCoins(ids.yaelId, 10);

    const both = await Promise.allSettled([
      withTx((c) =>
        redeemOperation(c, {
          rewardItemId: rewardId,
          kidId: ids.liaId,
          householdId: ids.householdId,
        }),
      ),
      withTx((c) =>
        redeemOperation(c, {
          rewardItemId: rewardId,
          kidId: ids.yaelId,
          householdId: ids.householdId,
        }),
      ),
    ]);

    const results = both.map((p) =>
      p.status === 'fulfilled' ? p.value : { ok: false, error: 'rejected' as const },
    );
    const wins = results.filter((r) => r.ok === true);
    const losses = results.filter((r) => r.ok === false);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect((losses[0] as { error: string }).error).toBe('out_of_stock');

    // Exactly one redemption + one ledger redeem entry landed.
    const rRows = await harness.db.select().from(redemption);
    expect(rRows).toHaveLength(1);

    // Stock is now 0.
    const stockRows = await harness.db
      .select({ stock: rewardItem.stockQuantity })
      .from(rewardItem)
      .where(eq(rewardItem.id, rewardId));
    expect(stockRows[0]?.stock).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// markRedemptionReceivedOperation
// ──────────────────────────────────────────────────────────────────────────────

async function makeRedemption(kidId: string, coinCost = 3): Promise<string> {
  const rewardId = await makeReward({ coinCost });
  await giveKidCoins(kidId, coinCost + 5);
  const result = await withTx((c) =>
    redeemOperation(c, {
      rewardItemId: rewardId,
      kidId,
      householdId: ids.householdId,
    }),
  );
  if (!result.ok) throw new Error('seed redemption failed: ' + JSON.stringify(result));
  return result.redemptionId;
}

describe('markRedemptionReceivedOperation', () => {
  it('flips status to received and attributes by_kid when kid taps', async () => {
    const redemptionId = await makeRedemption(ids.liaId);
    const r = await withTx((c) =>
      markRedemptionReceivedOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        actorKidId: ids.liaId,
      }),
    );
    expect(r.ok).toBe(true);

    const rows = await harness.db.select().from(redemption).where(eq(redemption.id, redemptionId));
    expect(rows[0]?.status).toBe('received');
    expect(rows[0]?.receivedByKidId).toBe(ids.liaId);
    expect(rows[0]?.receivedByUserId).toBeNull();
  });

  it('rejects when other kid tries to mark another kid\'s redemption', async () => {
    const redemptionId = await makeRedemption(ids.liaId);
    const r = await withTx((c) =>
      markRedemptionReceivedOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        actorKidId: ids.yaelId,
      }),
    );
    expect(r).toEqual({ ok: false, error: 'wrong_kid' });
  });

  it('returns already_resolved when called twice', async () => {
    const redemptionId = await makeRedemption(ids.liaId);
    await withTx((c) =>
      markRedemptionReceivedOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        actorKidId: ids.liaId,
      }),
    );
    const second = await withTx((c) =>
      markRedemptionReceivedOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        actorAdminUserId: ids.parentId,
      }),
    );
    expect(second).toEqual({ ok: false, error: 'already_resolved' });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// cancelRedemptionOperation + refundRedemptionOperation
// ──────────────────────────────────────────────────────────────────────────────

describe('cancelRedemptionOperation', () => {
  it('cancels a pending redemption AND posts redemption_refund credit', async () => {
    const redemptionId = await makeRedemption(ids.liaId, 5);
    const before = await displayBalance(harness, ids.liaId);
    expect(before).toBe(5); // 10 seeded - 5 redeem

    const r = await withTx((c) =>
      cancelRedemptionOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        adminUserId: ids.parentId,
        reason: 'item not available',
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe('cancelled');
    expect(r.refundLedgerEntry.amount).toBe(5);
    expect(r.refundLedgerEntry.kind).toBe('redemption_refund');

    // Wallet restored.
    expect(await displayBalance(harness, ids.liaId)).toBe(10);

    // Status + reason + refund FK populated.
    const rows = await harness.db.select().from(redemption).where(eq(redemption.id, redemptionId));
    expect(rows[0]?.status).toBe('cancelled');
    expect(rows[0]?.cancelReason).toBe('item not available');
    expect(rows[0]?.ledgerRefundCreditId).toBe(r.refundLedgerEntry.id);
  });

  it('rejects cancel on a received redemption (invalid_state_for_cancel)', async () => {
    const redemptionId = await makeRedemption(ids.liaId);
    await withTx((c) =>
      markRedemptionReceivedOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        actorKidId: ids.liaId,
      }),
    );
    const r = await withTx((c) =>
      cancelRedemptionOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        adminUserId: ids.parentId,
        reason: 'changed my mind',
      }),
    );
    expect(r).toEqual({ ok: false, error: 'invalid_state_for_cancel' });
  });

  it('rejects empty reason', async () => {
    const redemptionId = await makeRedemption(ids.liaId);
    const r = await withTx((c) =>
      cancelRedemptionOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        adminUserId: ids.parentId,
        reason: '   ',
      }),
    );
    expect(r).toEqual({ ok: false, error: 'reason_required' });
  });
});

describe('refundRedemptionOperation', () => {
  it('refunds a received redemption AND posts redemption_refund credit', async () => {
    const redemptionId = await makeRedemption(ids.liaId, 7);
    await withTx((c) =>
      markRedemptionReceivedOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        actorKidId: ids.liaId,
      }),
    );

    const r = await withTx((c) =>
      refundRedemptionOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        adminUserId: ids.parentId,
        reason: 'item was broken',
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe('refunded');
    expect(r.refundLedgerEntry.amount).toBe(7);
    expect(await displayBalance(harness, ids.liaId)).toBe(12); // 10 + 5 seeded - 7 + 7
  });

  it('rejects refund on a pending redemption (invalid_state_for_refund)', async () => {
    const redemptionId = await makeRedemption(ids.liaId);
    const r = await withTx((c) =>
      refundRedemptionOperation(c, {
        redemptionId,
        householdId: ids.householdId,
        adminUserId: ids.parentId,
        reason: 'too soon',
      }),
    );
    expect(r).toEqual({ ok: false, error: 'invalid_state_for_refund' });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Rollback safety — failed redeem leaves no ledger orphan
// ──────────────────────────────────────────────────────────────────────────────

describe('redeemOperation — rollback safety', () => {
  it('leaves NO ledger row when the surrounding tx is rolled back mid-op', async () => {
    const rewardId = await makeReward({ coinCost: 3 });
    await giveKidCoins(ids.liaId, 10);
    const before = await harness.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ledger_entry WHERE kid_id = $1`,
      [ids.liaId],
    );
    const beforeN = Number(before.rows[0]!.n);

    // Run the operation but force a rollback after it returns. The deferred
    // FK from ledger_entry → redemption is never validated because no commit
    // happens; the ledger insert and redemption insert both disappear.
    const c = await harness.pool.connect();
    try {
      await c.query('BEGIN');
      const result = await redeemOperation(c, {
        rewardItemId: rewardId,
        kidId: ids.liaId,
        householdId: ids.householdId,
      });
      expect(result.ok).toBe(true);
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }

    const after = await harness.pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ledger_entry WHERE kid_id = $1`,
      [ids.liaId],
    );
    expect(Number(after.rows[0]!.n)).toBe(beforeN);
    const rows = await harness.db.select().from(redemption);
    expect(rows).toHaveLength(0);
  });
});
