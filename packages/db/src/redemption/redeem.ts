/**
 * In-tx primitive for kid-side reward redemption.
 *
 * The atomicity contract (BUILD-PLAN §"Phase 6" task 2):
 *
 *   1. SELECT reward FOR UPDATE — locks the row for stock/availability checks.
 *      Any concurrent redemption of the same reward serializes behind us.
 *   2. Verify availability: not archived, visible_to_kids, household match.
 *      If stock_quantity is set and ≤ 0 → out_of_stock.
 *   3. Per-day cap check: count today's (IL date) pending_delivery + received
 *      redemptions of this reward by this kid. If ≥ max_per_kid_per_day →
 *      per_day_cap_exceeded.
 *   4. Spendable check: GREATEST(0, SUM(amount)) < coin_cost → insufficient_funds.
 *   5. Stock decrement (only when stock_quantity is not null) — race-safe
 *      because we hold the FOR UPDATE row lock.
 *   6. ledgerPost('redeem', -coin_cost, redemptionId=R) — R is pre-generated;
 *      the FK ledger_entry.redemption_id → redemption is DEFERRED (migration
 *      0004) so the INSERT succeeds even though the redemption row doesn't
 *      yet exist.
 *   7. INSERT redemption (id=R, ledger_debit_id=L, snapshot fields). Both
 *      FKs OK now: redemption_ledger_debit_fk → ledger_entry(L) exists, and
 *      ledger_entry → redemption(R) gets validated at COMMIT.
 *   8. INSERT audit_log row keyed by the actor (kid).
 *
 * The caller owns the transaction. Server actions (web) wrap a single redeem
 * in BEGIN/COMMIT. Tests bypass the action and call this directly to assert
 * concurrent-redemption serialization, stock exhaustion, and per-day caps.
 */

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ledgerPost, type PostedEntry } from '../ledger/post';

export interface RedeemInput {
  rewardItemId: string;
  kidId: string;
  householdId: string;
  requestIp?: string | null;
  userAgent?: string | null;
}

export type RedeemResult =
  | {
      ok: true;
      redemptionId: string;
      coinCost: number;
      ledgerEntry: PostedEntry;
      snapshotTitleHe: string;
      snapshotTitleEn: string;
    }
  | {
      ok: false;
      error:
        | 'not_found'
        | 'unavailable'
        | 'out_of_stock'
        | 'per_day_cap_exceeded'
        | 'insufficient_funds'
        | 'wrong_household';
      // Surfaced for the kid UI so we can show "you have 12, this costs 15"
      // or "Lia already got this today (max 1/day)" rather than a generic error.
      meta?: {
        coinCost?: number;
        spendable?: number;
        capLimit?: number;
        capUsedToday?: number;
      };
    };

interface RewardRow {
  coin_cost: number;
  stock_quantity: number | null;
  max_per_kid_per_day: number | null;
  visible_to_kids: boolean;
  archived_at: Date | null;
  household_id: string;
  title_he: string;
  title_en: string;
}

interface SumRow {
  sum: string | null;
}

interface CountRow {
  count: string;
}

export async function redeemOperation(
  client: PoolClient,
  input: RedeemInput,
): Promise<RedeemResult> {
  // 1. Lock the reward row for the rest of the transaction.
  const r = await client.query<RewardRow>(
    `SELECT coin_cost, stock_quantity, max_per_kid_per_day,
            visible_to_kids, archived_at, household_id, title_he, title_en
       FROM reward_item
      WHERE id = $1
      FOR UPDATE`,
    [input.rewardItemId],
  );
  const reward = r.rows[0];
  if (!reward) return { ok: false, error: 'not_found' };
  if (reward.household_id !== input.householdId) {
    return { ok: false, error: 'wrong_household' };
  }
  if (reward.archived_at !== null || !reward.visible_to_kids) {
    return { ok: false, error: 'unavailable' };
  }
  if (reward.stock_quantity !== null && reward.stock_quantity <= 0) {
    return { ok: false, error: 'out_of_stock' };
  }

  // 2. Per-day cap (IL date) — count active (non-cancelled) redemptions today
  //    by this kid for this reward.
  if (reward.max_per_kid_per_day !== null) {
    const cap = await client.query<CountRow>(
      `SELECT count(*)::text AS count
         FROM redemption
        WHERE kid_id = $1
          AND reward_item_id = $2
          AND status IN ('pending_delivery', 'received')
          AND (redeemed_at AT TIME ZONE 'Asia/Jerusalem')::date
            = (now()        AT TIME ZONE 'Asia/Jerusalem')::date`,
      [input.kidId, input.rewardItemId],
    );
    const usedToday = Number(cap.rows[0]?.count ?? 0);
    if (usedToday >= reward.max_per_kid_per_day) {
      return {
        ok: false,
        error: 'per_day_cap_exceeded',
        meta: {
          capLimit: reward.max_per_kid_per_day,
          capUsedToday: usedToday,
        },
      };
    }
  }

  // 3. Spendable balance check.
  const sumResult = await client.query<SumRow>(
    `SELECT COALESCE(SUM(amount), 0)::text AS sum
       FROM ledger_entry WHERE kid_id = $1`,
    [input.kidId],
  );
  const spendable = Math.max(0, Number(sumResult.rows[0]?.sum ?? 0));
  if (spendable < reward.coin_cost) {
    return {
      ok: false,
      error: 'insufficient_funds',
      meta: { coinCost: reward.coin_cost, spendable },
    };
  }

  // 4. Stock decrement (only when finite). The FOR UPDATE lock above
  //    serializes concurrent decrements; the CHECK on > 0 is belt-and-braces.
  if (reward.stock_quantity !== null) {
    const dec = await client.query(
      `UPDATE reward_item
          SET stock_quantity = stock_quantity - 1,
              updated_at = now()
        WHERE id = $1 AND stock_quantity > 0`,
      [input.rewardItemId],
    );
    if (dec.rowCount !== 1) {
      // The FOR UPDATE serialized us, so this should be impossible — but if
      // it ever does happen, surface as out_of_stock and roll back rather
      // than minting a phantom debit.
      return { ok: false, error: 'out_of_stock' };
    }
  }

  // 5. Pre-generate the redemption id so the ledger entry can reference it.
  //    The FK ledger_entry.redemption_id → redemption is DEFERRED (migration
  //    0004): the INSERT below succeeds even though redemption(R) doesn't
  //    yet exist; the FK is validated at COMMIT.
  const redemptionId = randomUUID();

  const entry = await ledgerPost(client, {
    kind: 'redeem',
    householdId: input.householdId,
    kidId: input.kidId,
    amount: -reward.coin_cost,
    redemptionId,
  });

  // 6. INSERT redemption with snapshot fields + the ledger debit FK.
  await client.query(
    `INSERT INTO redemption (
       id, household_id, kid_id, reward_item_id,
       snapshot_title_he, snapshot_title_en, snapshot_coin_cost,
       ledger_debit_id
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       $8
     )`,
    [
      redemptionId,
      input.householdId,
      input.kidId,
      input.rewardItemId,
      reward.title_he,
      reward.title_en,
      reward.coin_cost,
      entry.id,
    ],
  );

  // 7. Audit row (kid-initiated action).
  await client.query(
    `INSERT INTO audit_log (
       household_id, actor_kid_id, action, target_kind, target_id,
       after_json, request_ip, user_agent
     ) VALUES (
       $1, $2, 'redemption.created', 'redemption', $3,
       $4, $5, $6
     )`,
    [
      input.householdId,
      input.kidId,
      redemptionId,
      JSON.stringify({
        reward_item_id: input.rewardItemId,
        coin_cost: reward.coin_cost,
        ledger_entry_id: entry.id,
      }),
      input.requestIp ?? null,
      input.userAgent ?? null,
    ],
  );

  return {
    ok: true,
    redemptionId,
    coinCost: reward.coin_cost,
    ledgerEntry: entry,
    snapshotTitleHe: reward.title_he,
    snapshotTitleEn: reward.title_en,
  };
}
