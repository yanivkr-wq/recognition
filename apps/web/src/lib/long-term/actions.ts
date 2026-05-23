/**
 * Server actions for long-term progress logging + same-day undo.
 *
 * Thin wrappers over the in-tx operations in `packages/db/src/long-term/`.
 * The operations are testable from the @reco/db Vitest harness (16
 * invariant tests cover them); these wrappers add the kid-session auth
 * boundary + react-friendly form contract.
 *
 * Form signature is (prevState, FormData) so the calling client component
 * passes the action straight to useActionState (locked feedback memory:
 * never wrap a server action in a client async fn).
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  getPool,
  logProgressOperation,
  undoLongTermProgressOperation,
} from '@reco/db';
import { requireKid, UnauthorizedError } from '../auth/guards';

const HOUSEHOLD_TZ = 'Asia/Jerusalem';

export type LogProgressState =
  | {
      ok: true;
      progressId: string;
      balanceAfter: number;
      perUnitCoinsAdded: number;
      bonusAdded: number;
      newTotal: number;
      goalReached: boolean;
    }
  | {
      ok: false;
      error:
        | 'invalid_quantity'
        | 'forbidden'
        | 'not_found'
        | 'wrong_kind'
        | 'already_done'
        | 'disabled'
        | 'internal';
    };

export async function logProgressAction(
  _prev: LogProgressState | undefined,
  formData: FormData,
): Promise<LogProgressState> {
  const assignmentId = String(formData.get('assignmentId') ?? '');
  const quantityRaw = String(formData.get('quantity') ?? '');
  const quantity = Number.parseInt(quantityRaw, 10);
  if (!assignmentId) return { ok: false, error: 'not_found' };

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await logProgressOperation(client, {
      householdId: kid.householdId,
      kidId: kid.kidId,
      assignmentId,
      quantity,
      tz: HOUSEHOLD_TZ,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      return { ok: false, error: result.error };
    }

    await client.query('COMMIT');
    revalidatePath('/[lang]', 'layout');

    const balanceAfter = result.bonusEarn?.balanceAfter ?? result.perUnitEarn.balanceAfter;
    return {
      ok: true,
      progressId: result.progressId,
      balanceAfter: Math.max(0, balanceAfter),
      perUnitCoinsAdded: result.perUnitEarn.amount,
      bonusAdded: result.bonusEarn?.amount ?? 0,
      newTotal: result.newTotal,
      goalReached: result.goalReached,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('logProgressAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

export type UndoProgressState =
  | {
      ok: true;
      balanceAfter: number;
      perUnitCoinsRemoved: number;
      bonusRemoved: number;
      newTotal: number;
      assignmentReopened: boolean;
    }
  | {
      ok: false;
      error: 'not_found' | 'not_same_day' | 'already_undone' | 'forbidden' | 'internal';
    };

export async function undoLongTermProgressAction(
  _prev: UndoProgressState | undefined,
  formData: FormData,
): Promise<UndoProgressState> {
  const progressId = String(formData.get('progressId') ?? '');
  if (!progressId) return { ok: false, error: 'not_found' };

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await undoLongTermProgressOperation(client, {
      householdId: kid.householdId,
      kidId: kid.kidId,
      progressId,
      tz: HOUSEHOLD_TZ,
    });
    if (!result.ok) {
      await client.query('ROLLBACK');
      return { ok: false, error: result.error };
    }

    await client.query('COMMIT');
    revalidatePath('/[lang]', 'layout');

    // Compute the current balance — the undo path may post one OR two undo
    // entries; whichever fires last carries the up-to-date balance_after.
    // If neither posted (kid undoes a pending-evidence row, no ledger
    // credit), fall back to a sum query.
    let balanceAfter: number;
    if (result.bonusUndo) {
      balanceAfter = result.bonusUndo.balanceAfter;
    } else if (result.perUnitUndo) {
      balanceAfter = result.perUnitUndo.balanceAfter;
    } else {
      const sumRes = await getPool().query<{ sum: string | null }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entry WHERE kid_id = $1`,
        [kid.kidId],
      );
      balanceAfter = Number(sumRes.rows[0]?.sum ?? 0);
    }
    return {
      ok: true,
      balanceAfter: Math.max(0, balanceAfter),
      perUnitCoinsRemoved: result.perUnitUndo ? -result.perUnitUndo.amount : 0,
      bonusRemoved: result.bonusUndo ? -result.bonusUndo.amount : 0,
      newTotal: result.newTotal,
      assignmentReopened: result.assignmentReopened,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('undoLongTermProgressAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}
