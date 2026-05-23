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
