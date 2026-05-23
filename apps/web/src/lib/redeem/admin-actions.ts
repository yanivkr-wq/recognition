/**
 * Admin-side redemption actions: mark received / cancel / refund.
 *
 * - `adminMarkReceivedAction` is the parent's equivalent of the kid's "got it"
 *   tap — for redemptions a kid forgot to mark, or for items the parent
 *   physically hands over (movie night).
 * - `cancelRedemptionAction` runs on pending_delivery only; coins refunded
 *   via a `redemption_refund` ledger entry.
 * - `refundRedemptionAction` runs on received only — same ledger shape, but
 *   semantically "I'm clawing this back after delivery" (rare).
 *
 * All three require a parent session. Cancel + refund require a reason
 * (CHECK on the originating ledger entry + UI enforcement). Audit row goes
 * into `audit_log`; both parents see it in `/admin/audit`.
 */

'use server';

import 'server-only';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  getPool,
  markRedemptionReceivedOperation,
  cancelRedemptionOperation,
  refundRedemptionOperation,
} from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';

// ─────────────────────────── mark received (admin) ───────────────────────────

export type AdminMarkReceivedState =
  | { ok: true; redemptionId: string }
  | {
      ok: false;
      error: 'forbidden' | 'not_found' | 'already_resolved' | 'internal';
    };

export async function adminMarkReceivedAction(
  _prev: AdminMarkReceivedState | undefined,
  formData: FormData,
): Promise<AdminMarkReceivedState> {
  const redemptionId = String(formData.get('redemptionId') ?? '');
  if (!redemptionId) return { ok: false, error: 'not_found' };

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
    const result = await markRedemptionReceivedOperation(client, {
      redemptionId,
      householdId: admin.householdId,
      actorAdminUserId: admin.userId,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      if (result.error === 'wrong_household') return { ok: false, error: 'not_found' };
      if (result.error === 'wrong_kid') return { ok: false, error: 'not_found' };
      return { ok: false, error: result.error };
    }
    await client.query('COMMIT');
    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]/redeem/history', 'page');
    return { ok: true, redemptionId: result.redemptionId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('adminMarkReceivedAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────── cancel ───────────────────────────────

export type CancelRedemptionState =
  | { ok: true; redemptionId: string; refundAmount: number }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'not_found'
        | 'already_resolved'
        | 'reason_required'
        | 'invalid_state'
        | 'internal';
    };

export async function cancelRedemptionAction(
  _prev: CancelRedemptionState | undefined,
  formData: FormData,
): Promise<CancelRedemptionState> {
  const redemptionId = String(formData.get('redemptionId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!redemptionId) return { ok: false, error: 'not_found' };
  if (!reason) return { ok: false, error: 'reason_required' };

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
    const result = await cancelRedemptionOperation(client, {
      redemptionId,
      householdId: admin.householdId,
      adminUserId: admin.userId,
      reason,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      if (result.error === 'wrong_household') return { ok: false, error: 'not_found' };
      if (result.error === 'invalid_state_for_cancel') {
        return { ok: false, error: 'invalid_state' };
      }
      if (result.error === 'invalid_state_for_refund') {
        // Shouldn't happen on the cancel path, but typed for completeness.
        return { ok: false, error: 'invalid_state' };
      }
      return { ok: false, error: result.error };
    }
    await client.query('COMMIT');
    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]/redeem/history', 'page');
    revalidatePath('/[lang]/wallet', 'page');
    return {
      ok: true,
      redemptionId: result.redemptionId,
      refundAmount: result.refundLedgerEntry.amount,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('cancelRedemptionAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────── refund ───────────────────────────────

export type RefundRedemptionState =
  | { ok: true; redemptionId: string; refundAmount: number }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'not_found'
        | 'already_resolved'
        | 'reason_required'
        | 'invalid_state'
        | 'internal';
    };

export async function refundRedemptionAction(
  _prev: RefundRedemptionState | undefined,
  formData: FormData,
): Promise<RefundRedemptionState> {
  const redemptionId = String(formData.get('redemptionId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!redemptionId) return { ok: false, error: 'not_found' };
  if (!reason) return { ok: false, error: 'reason_required' };

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
    const result = await refundRedemptionOperation(client, {
      redemptionId,
      householdId: admin.householdId,
      adminUserId: admin.userId,
      reason,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      if (result.error === 'wrong_household') return { ok: false, error: 'not_found' };
      if (
        result.error === 'invalid_state_for_refund' ||
        result.error === 'invalid_state_for_cancel'
      ) {
        return { ok: false, error: 'invalid_state' };
      }
      return { ok: false, error: result.error };
    }
    await client.query('COMMIT');
    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]/redeem/history', 'page');
    revalidatePath('/[lang]/wallet', 'page');
    return {
      ok: true,
      redemptionId: result.redemptionId,
      refundAmount: result.refundLedgerEntry.amount,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('refundRedemptionAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}
