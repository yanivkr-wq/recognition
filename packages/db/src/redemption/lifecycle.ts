/**
 * Post-redemption state transitions: mark-received, admin-cancel, admin-refund.
 *
 * Status machine (SCHEMA.md §6):
 *
 *   pending_delivery ──▶ received      (kid taps "got it" OR admin marks)
 *                  └──▶ cancelled      (admin only, before delivery; ledger refund)
 *                  └──▶ refunded       (admin only, AFTER delivery; ledger refund)
 *
 * The first UPDATE in each transition is the integrity point: a single
 * `UPDATE … WHERE status = '<expected>'` with a rowcount check. If
 * rowcount=0 another caller already moved the redemption out of the
 * pending state — we return `already_resolved`, the UI tells the user
 * "the other parent handled this 2 minutes ago" rather than throwing.
 *
 * Cancel/refund post a `redemption_refund` ledger entry crediting the kid
 * back the snapshot_coin_cost. Both paths require a reason (CHECK on the
 * ledger row is enforced by the writer's input validation + UI).
 */

import type { PoolClient } from 'pg';
import { ledgerPost, type PostedEntry } from '../ledger/post';

interface RedemptionRow {
  id: string;
  household_id: string;
  kid_id: string;
  snapshot_coin_cost: number;
  status: string;
}

// ──────────────────────────────── mark received ────────────────────────────────

export interface MarkReceivedInput {
  redemptionId: string;
  householdId: string;
  /** Exactly one of these is non-null. The kid-side action passes kidId;
   *  the admin-side action passes adminUserId. The CHECK constraint on the
   *  `redemption` table mirrors this (received_by_user_id XOR received_by_kid_id). */
  actorKidId?: string;
  actorAdminUserId?: string;
  requestIp?: string | null;
  userAgent?: string | null;
}

export type MarkReceivedResult =
  | { ok: true; redemptionId: string }
  | {
      ok: false;
      error: 'not_found' | 'wrong_household' | 'wrong_kid' | 'already_resolved';
    };

export async function markRedemptionReceivedOperation(
  client: PoolClient,
  input: MarkReceivedInput,
): Promise<MarkReceivedResult> {
  if (!input.actorKidId === !input.actorAdminUserId) {
    throw new Error(
      'markRedemptionReceivedOperation: exactly one of actorKidId | actorAdminUserId required',
    );
  }

  // Lock the row + scope check before the FCFS UPDATE so we can tell apart
  // "wrong household", "wrong kid", and "already resolved by the other side".
  const r = await client.query<RedemptionRow>(
    `SELECT id, household_id, kid_id, snapshot_coin_cost, status
       FROM redemption WHERE id = $1 FOR UPDATE`,
    [input.redemptionId],
  );
  const row = r.rows[0];
  if (!row) return { ok: false, error: 'not_found' };
  if (row.household_id !== input.householdId) {
    return { ok: false, error: 'wrong_household' };
  }
  if (input.actorKidId && row.kid_id !== input.actorKidId) {
    return { ok: false, error: 'wrong_kid' };
  }
  if (row.status !== 'pending_delivery') {
    return { ok: false, error: 'already_resolved' };
  }

  const upd = await client.query(
    `UPDATE redemption
        SET status = 'received',
            received_at = now(),
            received_by_user_id = $2,
            received_by_kid_id  = $3
      WHERE id = $1 AND status = 'pending_delivery'`,
    [input.redemptionId, input.actorAdminUserId ?? null, input.actorKidId ?? null],
  );
  if (upd.rowCount !== 1) {
    // Lost the race to a concurrent caller (the FOR UPDATE released between
    // SELECT and UPDATE only on COMMIT — practically can't reach here, but
    // keep the typed error so the UI never throws).
    return { ok: false, error: 'already_resolved' };
  }

  await client.query(
    `INSERT INTO audit_log (
       household_id, actor_user_id, actor_kid_id, action, target_kind, target_id,
       after_json, request_ip, user_agent
     ) VALUES (
       $1, $2, $3, 'redemption.received', 'redemption', $4,
       $5, $6, $7
     )`,
    [
      input.householdId,
      input.actorAdminUserId ?? null,
      input.actorKidId ?? null,
      input.redemptionId,
      JSON.stringify({ marked_by: input.actorAdminUserId ? 'admin' : 'kid' }),
      input.requestIp ?? null,
      input.userAgent ?? null,
    ],
  );

  return { ok: true, redemptionId: input.redemptionId };
}

// ──────────────────────────────── cancel / refund ────────────────────────────────

export interface AdminReverseInput {
  redemptionId: string;
  householdId: string;
  adminUserId: string;
  reason: string;
  requestIp?: string | null;
  userAgent?: string | null;
}

export type AdminReverseResult =
  | {
      ok: true;
      redemptionId: string;
      refundLedgerEntry: PostedEntry;
      mode: 'cancelled' | 'refunded';
    }
  | {
      ok: false;
      error:
        | 'not_found'
        | 'wrong_household'
        | 'already_resolved'
        | 'invalid_state_for_cancel'
        | 'invalid_state_for_refund'
        | 'reason_required';
    };

async function reverseRedemption(
  client: PoolClient,
  input: AdminReverseInput,
  mode: 'cancelled' | 'refunded',
): Promise<AdminReverseResult> {
  if (!input.reason.trim()) return { ok: false, error: 'reason_required' };

  const r = await client.query<RedemptionRow>(
    `SELECT id, household_id, kid_id, snapshot_coin_cost, status
       FROM redemption WHERE id = $1 FOR UPDATE`,
    [input.redemptionId],
  );
  const row = r.rows[0];
  if (!row) return { ok: false, error: 'not_found' };
  if (row.household_id !== input.householdId) {
    return { ok: false, error: 'wrong_household' };
  }

  // Cancel requires status='pending_delivery'. Refund requires
  // status='received'. Anything else is invalid.
  if (mode === 'cancelled' && row.status !== 'pending_delivery') {
    return { ok: false, error: 'invalid_state_for_cancel' };
  }
  if (mode === 'refunded' && row.status !== 'received') {
    return { ok: false, error: 'invalid_state_for_refund' };
  }

  // Post the refund ledger entry first; we'll wire it via UPDATE next.
  const entry = await ledgerPost(client, {
    kind: 'redemption_refund',
    householdId: input.householdId,
    kidId: row.kid_id,
    amount: row.snapshot_coin_cost, // positive — credit back the kid
    redemptionId: row.id,
  });

  // FCFS update + status transition + ledger pointer + admin attribution +
  // reason text in the matching field.
  const upd =
    mode === 'cancelled'
      ? await client.query(
          `UPDATE redemption
              SET status = 'cancelled',
                  cancelled_at = now(),
                  cancelled_by_user_id = $2,
                  cancel_reason = $3,
                  ledger_refund_credit_id = $4
            WHERE id = $1 AND status = 'pending_delivery'`,
          [input.redemptionId, input.adminUserId, input.reason, entry.id],
        )
      : await client.query(
          `UPDATE redemption
              SET status = 'refunded',
                  refunded_at = now(),
                  refunded_by_user_id = $2,
                  refund_reason = $3,
                  ledger_refund_credit_id = $4
            WHERE id = $1 AND status = 'received'`,
          [input.redemptionId, input.adminUserId, input.reason, entry.id],
        );
  if (upd.rowCount !== 1) {
    return { ok: false, error: 'already_resolved' };
  }

  await client.query(
    `INSERT INTO audit_log (
       household_id, actor_user_id, action, target_kind, target_id,
       before_json, after_json, reason, request_ip, user_agent
     ) VALUES (
       $1, $2, $3, 'redemption', $4,
       $5, $6, $7, $8, $9
     )`,
    [
      input.householdId,
      input.adminUserId,
      mode === 'cancelled' ? 'redemption.cancelled' : 'redemption.refunded',
      input.redemptionId,
      JSON.stringify({ status: row.status }),
      JSON.stringify({
        status: mode,
        refund_ledger_entry_id: entry.id,
        refund_amount: row.snapshot_coin_cost,
      }),
      input.reason,
      input.requestIp ?? null,
      input.userAgent ?? null,
    ],
  );

  return { ok: true, redemptionId: input.redemptionId, refundLedgerEntry: entry, mode };
}

export function cancelRedemptionOperation(
  client: PoolClient,
  input: AdminReverseInput,
): Promise<AdminReverseResult> {
  return reverseRedemption(client, input, 'cancelled');
}

export function refundRedemptionOperation(
  client: PoolClient,
  input: AdminReverseInput,
): Promise<AdminReverseResult> {
  return reverseRedemption(client, input, 'refunded');
}
