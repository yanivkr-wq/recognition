/**
 * Kid-side redemption server actions.
 *
 * `redeemAction` debits coins atomically with the redemption INSERT — the
 * deferred FK (migration 0004) lets the ledger entry reference a redemption
 * row that physically lands later in the same transaction.
 *
 * `markRedemptionReceivedAction` is the kid's "tap when you've got it" path
 * for `pending_delivery` redemptions. Admin can do the same from
 * `/admin/redemptions` — the underlying op accepts either principal.
 *
 * Both actions use the React 19 `(prevState, FormData)` signature so
 * `useActionState` invokes them directly without a wrapper async fn (locked
 * memory: client wrappers strip the server-action transport).
 */

'use server';

import 'server-only';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  getPool,
  redeemOperation,
  markRedemptionReceivedOperation,
} from '@reco/db';
import { requireKid, UnauthorizedError } from '../auth/guards';

export type RedeemState =
  | {
      ok: true;
      redemptionId: string;
      coinCost: number;
      titleHe: string;
      titleEn: string;
    }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'not_found'
        | 'unavailable'
        | 'out_of_stock'
        | 'per_day_cap_exceeded'
        | 'insufficient_funds'
        | 'internal';
      // Surfaced to render kid-friendly copy ("you have 12, this costs 15").
      meta?: {
        coinCost?: number;
        spendable?: number;
        capLimit?: number;
        capUsedToday?: number;
      };
    };

export async function redeemAction(
  _prev: RedeemState | undefined,
  formData: FormData,
): Promise<RedeemState> {
  const rewardItemId = String(formData.get('rewardItemId') ?? '');
  if (!rewardItemId) return { ok: false, error: 'not_found' };

  let kid;
  try {
    kid = await requireKid();
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
    const result = await redeemOperation(client, {
      rewardItemId,
      kidId: kid.kidId,
      householdId: kid.householdId,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      if (result.error === 'wrong_household') {
        // Defense-in-depth — a cross-household reward id should be 404 to the kid.
        return { ok: false, error: 'not_found' };
      }
      return { ok: false, error: result.error, meta: result.meta };
    }
    await client.query('COMMIT');
    revalidatePath('/[lang]/redeem', 'page');
    revalidatePath('/[lang]/redeem/history', 'page');
    revalidatePath('/[lang]/wallet', 'page');
    revalidatePath('/[lang]', 'page');
    return {
      ok: true,
      redemptionId: result.redemptionId,
      coinCost: result.coinCost,
      titleHe: result.snapshotTitleHe,
      titleEn: result.snapshotTitleEn,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('redeemAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

export type MarkReceivedState =
  | { ok: true; redemptionId: string }
  | {
      ok: false;
      error: 'forbidden' | 'not_found' | 'wrong_kid' | 'already_resolved' | 'internal';
    };

export async function kidMarkReceivedAction(
  _prev: MarkReceivedState | undefined,
  formData: FormData,
): Promise<MarkReceivedState> {
  const redemptionId = String(formData.get('redemptionId') ?? '');
  if (!redemptionId) return { ok: false, error: 'not_found' };

  let kid;
  try {
    kid = await requireKid();
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
      householdId: kid.householdId,
      actorKidId: kid.kidId,
      requestIp,
      userAgent,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      if (result.error === 'wrong_household') return { ok: false, error: 'not_found' };
      return { ok: false, error: result.error };
    }
    await client.query('COMMIT');
    revalidatePath('/[lang]/redeem/history', 'page');
    return { ok: true, redemptionId: result.redemptionId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('kidMarkReceivedAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}
