/**
 * Joker / admin wallet adjustment.
 *
 * A parent credits or debits a kid's wallet outside the normal earn/redeem
 * flow ("extra dish duty: +5", "broke a vase: -10"). Always requires a
 * non-empty reason — enforced by both:
 *   - this function's input validation, and
 *   - the CHECK constraint on ledger_entry (admin_credit/admin_debit require
 *     admin_user_id AND note IS NOT NULL).
 *
 * The clamping behavior for admin_debit lives in `ledgerPost`: balance can
 * legitimately go negative in the ledger (so the audit shows "you tried to
 * subtract 100 from a balance of 30") while the kid's UI floors at 0.
 *
 * Both parents see the audit_log entry; this is the household's record of
 * every joker action.
 */

import type { PoolClient } from 'pg';
import { ledgerPost, type PostedEntry } from '../ledger/post';

export interface AdjustWalletInput {
  /** Positive for credit, negative for debit. The function maps the sign
   *  to the corresponding ledger kind so callers don't have to. */
  amount: number;
  kidId: string;
  householdId: string;
  adminUserId: string;
  reason: string;
  requestIp?: string | null;
  userAgent?: string | null;
}

export type AdjustWalletResult =
  | { ok: true; ledgerEntry: PostedEntry }
  | { ok: false; error: 'reason_required' | 'invalid_amount' | 'wrong_household' };

export async function adjustWalletOperation(
  client: PoolClient,
  input: AdjustWalletInput,
): Promise<AdjustWalletResult> {
  if (!input.reason.trim()) return { ok: false, error: 'reason_required' };
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    return { ok: false, error: 'invalid_amount' };
  }

  // Defense in depth: confirm the target kid actually belongs to the
  // admin's household. The server action already checks this — but if a
  // future test or refactor calls this op directly with a mismatched
  // householdId, we'd otherwise mint a cross-tenant ledger entry.
  const k = await client.query<{ household_id: string }>(
    `SELECT household_id FROM kid WHERE id = $1`,
    [input.kidId],
  );
  if (k.rowCount === 0 || k.rows[0]!.household_id !== input.householdId) {
    return { ok: false, error: 'wrong_household' };
  }

  const entry =
    input.amount > 0
      ? await ledgerPost(client, {
          kind: 'admin_credit',
          householdId: input.householdId,
          kidId: input.kidId,
          amount: input.amount,
          adminUserId: input.adminUserId,
          note: input.reason,
        })
      : await ledgerPost(client, {
          kind: 'admin_debit',
          householdId: input.householdId,
          kidId: input.kidId,
          amount: input.amount,
          adminUserId: input.adminUserId,
          note: input.reason,
        });

  await client.query(
    `INSERT INTO audit_log (
       household_id, actor_user_id, action, target_kind, target_id,
       after_json, reason, request_ip, user_agent
     ) VALUES (
       $1, $2, $3, 'kid', $4,
       $5, $6, $7, $8
     )`,
    [
      input.householdId,
      input.adminUserId,
      input.amount > 0 ? 'wallet.admin_credit' : 'wallet.admin_debit',
      input.kidId,
      JSON.stringify({
        amount: input.amount,
        ledger_entry_id: entry.id,
        clamped_amount: entry.clampedAmount,
        balance_after: entry.balanceAfter,
      }),
      input.reason,
      input.requestIp ?? null,
      input.userAgent ?? null,
    ],
  );

  return { ok: true, ledgerEntry: entry };
}
