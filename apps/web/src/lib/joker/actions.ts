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
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getPool, adjustWalletOperation } from '@reco/db';
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
 * The reverse is a NEW joker entry (admin_credit / admin_debit) of the opposite
 * sign — the append-only ledger is never mutated. The amount is computed
 * server-side from the looked-up entry, so a client can't forge it, and an
 * auto reason keeps the mandatory-reason contract satisfied + auditable.
 */
export async function reverseLedgerEntryAction(formData: FormData): Promise<void> {
  const entryId = String(formData.get('entryId') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!entryId) return;

  const admin = await requireAdmin();
  const pool = getPool();

  // Scope to the household via the owning kid so a spoofed id can't reach
  // another family's ledger.
  const { rows } = await pool.query<{ kid_id: string; amount: number }>(
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

  const reason =
    (lang === 'he' ? 'ביטול תנועה בספר החשבונות' : 'Reversed a ledger entry') +
    ` (${orig > 0 ? '+' : ''}${orig})`;

  const hdrs = await headers();
  const requestIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await adjustWalletOperation(client, {
      amount: reverse,
      kidId: e.kid_id,
      householdId: admin.householdId,
      adminUserId: admin.userId,
      reason,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      return;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('reverseLedgerEntryAction failed', err);
    return;
  } finally {
    client.release();
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]', 'layout');
  redirect(`/${lang}/admin/kids/${e.kid_id}/ledger`);
}
