/**
 * Admin joker — wallet adjustment server action.
 *
 * Wraps `adjustWalletOperation` (single ledger writer, clamping built in).
 * Server-side validation: admin session, non-empty reason, integer non-zero
 * amount. Positive maps to admin_credit; negative maps to admin_debit. The
 * UI's "credit / debit" buttons just set the sign on the amount input.
 *
 * The clamping behavior is the lesson-learned from Phase 3's ledger writer:
 * if a parent tries to debit more than the kid has, the ledger keeps the
 * truth (`balance_after` may go negative, `clamped_amount` records the
 * portion not backed by positive balance) while the kid's display floors
 * at zero (GREATEST(0, SUM(amount))).
 */

'use server';

import 'server-only';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getPool, adjustWalletOperation, ledgerPost } from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';

export type AdjustWalletState =
  | {
      ok: true;
      kidId: string;
      amount: number;
      balanceAfter: number;
      clampedAmount: number | null;
    }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'reason_required'
        | 'invalid_amount'
        | 'not_found'
        | 'internal';
    };

export async function adjustWalletAction(
  _prev: AdjustWalletState | undefined,
  formData: FormData,
): Promise<AdjustWalletState> {
  const kidId = String(formData.get('kidId') ?? '');
  const amountRaw = String(formData.get('amount') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (!kidId) return { ok: false, error: 'not_found' };
  if (!reason) return { ok: false, error: 'reason_required' };
  const amount = Number.parseInt(amountRaw, 10);
  if (!Number.isInteger(amount) || amount === 0) {
    return { ok: false, error: 'invalid_amount' };
  }

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const hdrs = await headers();
  const requestIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await adjustWalletOperation(client, {
      amount,
      kidId,
      householdId: admin.householdId,
      adminUserId: admin.userId,
      reason,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      if (result.error === 'wrong_household') return { ok: false, error: 'not_found' };
      return { ok: false, error: result.error };
    }
    await client.query('COMMIT');
    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]', 'layout');
    return {
      ok: true,
      kidId,
      amount,
      balanceAfter: result.ledgerEntry.balanceAfter,
      clampedAmount: result.ledgerEntry.clampedAmount,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('adjustWalletAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

/**
 * One-click reverse of a single ledger entry, straight from the ledger page
 * (Lily: "if I see someone earned points I can revoke them, or add back points
 * that were revoked, right from that page").
 *
 * Writes a new entry of kind='undo' that points at the original via
 * `undo_of_entry_id`. The link is what the ledger-page render uses to PAIR
 * the entries and hide the cancelled one — Lily's request: "the original
 * earned activity should disappear when revoked, not show side-by-side with
 * the revoke record". Re-revoking (an undo of an undo) continues the chain,
 * and the page logic surfaces only the live entry on each chain.
 *
 * The append-only ledger contract is preserved: we never UPDATE or DELETE;
 * "hide" is purely a display concern computed from undo_of_entry_id chains.
 */
export async function reverseLedgerEntryAction(formData: FormData): Promise<void> {
  const entryId = String(formData.get('entryId') ?? '');
  if (!entryId) return;

  const admin = await requireAdmin();
  const pool = getPool();

  // Scope to the household via the owning kid so a spoofed id can't reach
  // another family's ledger.
  const { rows } = await pool.query<{
    kid_id: string;
    amount: number;
  }>(
    `SELECT le.kid_id, le.amount
       FROM ledger_entry le
       JOIN kid k ON k.id = le.kid_id
      WHERE le.id = $1 AND k.household_id = $2
      LIMIT 1`,
    [entryId, admin.householdId],
  );
  const e = rows[0];
  if (!e) return;

  const orig = Number(e.amount);
  const reverse = -orig;
  if (reverse === 0) return;

  const hdrs = await headers();
  const requestIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const posted = await ledgerPost(client, {
      kind: 'undo',
      householdId: admin.householdId,
      kidId: e.kid_id,
      amount: reverse,
      undoOfEntryId: entryId,
    });
    // Audit log mirrors the wallet.admin_* path so both parents see who
    // revoked what + when, with the linked entry id in the JSON body for
    // forensics.
    await client.query(
      `INSERT INTO audit_log (
         household_id, actor_user_id, action, target_kind, target_id,
         after_json, request_ip, user_agent
       ) VALUES (
         $1, $2, 'wallet.undo', 'kid', $3, $4, $5, $6
       )`,
      [
        admin.householdId,
        admin.userId,
        e.kid_id,
        JSON.stringify({
          amount: reverse,
          ledger_entry_id: posted.id,
          undo_of_entry_id: entryId,
          balance_after: posted.balanceAfter,
        }),
        requestIp,
        userAgent,
      ],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('reverseLedgerEntryAction failed', err);
    return;
  } finally {
    client.release();
  }

  // No redirect: redirecting to the SAME ledger URL is a no-op for the RSC
  // refresh, which is why the balance looked unchanged after a reverse. A
  // form-invoked server action without a redirect makes Next refresh the
  // current route, and revalidatePath clears the cached data — so the new
  // entry + updated balance show immediately.
  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]', 'layout');
}
