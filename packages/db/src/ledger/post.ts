/**
 * THE ledger writer. Every coin that enters or leaves a kid's wallet
 * funnels through this module.
 *
 * Architectural placement note (deviation from BUILD-PLAN.md):
 * BUILD-PLAN.md §"Phase 3" task 2 names `apps/worker/src/ledger/post.ts`.
 * That doesn't compose: ARCHITECTURE.md §5 makes ledger writes a shared
 * concern (server actions in apps/web call it on every kid completion;
 * worker cron calls it on campaign bonuses + nightly streak completions).
 * Putting the writer here in @reco/db lets both apps import via the
 * workspace package without HTTP-hopping the web→worker boundary on
 * every coin event.
 *
 * Concurrency model:
 *   - The function expects a pg PoolClient that the caller has already
 *     wrapped in `BEGIN`. That way the ledger INSERT and the originating
 *     domain INSERT (task_completion / redemption / ...) commit atomically.
 *   - `pg_advisory_xact_lock(hashtext(kid_id))` serializes all concurrent
 *     ledger writes for the same kid. Released automatically at COMMIT/
 *     ROLLBACK. Doesn't block writes for OTHER kids.
 *   - This pattern is cheaper than SERIALIZABLE isolation (which would
 *     require 40001 retry logic and is more contention-prone).
 *
 * Clamping (admin_debit only):
 *   - `balance_after` is the RAW arithmetic sum (CAN go negative — that's
 *     the audit truth).
 *   - `clamped_amount` records the portion of the debit that wasn't backed
 *     by positive balance.
 *   - The wallet UI displays `GREATEST(0, SUM(amount))` so kids never see
 *     a negative number. Parents see `clamped_amount` in the audit feed.
 *
 * Invariant enforcement:
 *   - This module validates kind-specific input shape (amount signs,
 *     required FKs, required notes) before issuing the INSERT.
 *   - The CHECK constraints in 0001_init.sql §12 are the second line of
 *     defense — a hand-crafted INSERT that bypassed this module would
 *     still fail at the DB.
 *   - A grep test (see ./post.guard.test.ts) ensures no other source file
 *     issues `INSERT INTO ledger_entry`.
 */

import type { Pool, PoolClient } from 'pg';
import type { LedgerKind } from '../schema/ledger';

export type PostInput =
  | {
      kind: 'earn';
      householdId: string;
      kidId: string;
      amount: number;
      taskCompletionId?: string;
      longTermProgressId?: string;
    }
  | {
      kind: 'campaign_bonus';
      householdId: string;
      kidId: string;
      amount: number;
      campaignId: string;
    }
  | {
      kind: 'redeem';
      householdId: string;
      kidId: string;
      amount: number;
      redemptionId: string;
    }
  | {
      kind: 'redemption_refund';
      householdId: string;
      kidId: string;
      amount: number;
      redemptionId: string;
    }
  | {
      kind: 'admin_credit';
      householdId: string;
      kidId: string;
      amount: number;
      adminUserId: string;
      note: string;
    }
  | {
      kind: 'admin_debit';
      householdId: string;
      kidId: string;
      amount: number;
      adminUserId: string;
      note: string;
    }
  | {
      kind: 'undo';
      householdId: string;
      kidId: string;
      amount: number;
      undoOfEntryId: string;
    };

export interface PostedEntry {
  id: string;
  kind: LedgerKind;
  amount: number;
  clampedAmount: number | null;
  balanceAfter: number;
  createdAt: Date;
}

export class LedgerInvariantError extends Error {
  override readonly name = 'LedgerInvariantError';
}

interface InsertRow {
  id: string;
  kind: string;
  amount: number;
  clamped_amount: number | null;
  balance_after: number;
  created_at: Date;
}

interface SumRow {
  sum: string | null;
}

/**
 * Append a ledger entry inside the caller's transaction.
 *
 * @throws {LedgerInvariantError} on malformed input
 * @throws if the DB CHECK constraints reject the row (escape-hatch double-check)
 */
export async function ledgerPost(
  client: PoolClient,
  input: PostInput,
): Promise<PostedEntry> {
  validateInput(input);

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.kidId]);

  const sumResult = await client.query<SumRow>(
    'SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entry WHERE kid_id = $1',
    [input.kidId],
  );
  const currentSum = Number(sumResult.rows[0]?.sum ?? 0);
  const balanceAfter = currentSum + input.amount;

  let clampedAmount: number | null = null;
  if (input.kind === 'admin_debit') {
    const displayBefore = Math.max(0, currentSum);
    const displayAfter = Math.max(0, balanceAfter);
    const actualSubtracted = displayBefore - displayAfter;
    const clamped = -input.amount - actualSubtracted;
    if (clamped > 0) clampedAmount = clamped;
  }

  const taskCompletionId =
    input.kind === 'earn' ? input.taskCompletionId ?? null : null;
  const longTermProgressId =
    input.kind === 'earn' ? input.longTermProgressId ?? null : null;
  const redemptionId =
    input.kind === 'redeem' || input.kind === 'redemption_refund'
      ? input.redemptionId
      : null;
  const campaignId = input.kind === 'campaign_bonus' ? input.campaignId : null;
  const adminUserId =
    input.kind === 'admin_credit' || input.kind === 'admin_debit'
      ? input.adminUserId
      : null;
  const undoOfEntryId = input.kind === 'undo' ? input.undoOfEntryId : null;
  const note =
    input.kind === 'admin_credit' || input.kind === 'admin_debit'
      ? input.note
      : null;

  const result = await client.query<InsertRow>(
    `INSERT INTO ledger_entry (
       household_id, kid_id, kind, amount, clamped_amount, balance_after,
       task_completion_id, long_term_progress_id, redemption_id, campaign_id,
       admin_user_id, undo_of_entry_id, note
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
     )
     RETURNING id, kind, amount, clamped_amount, balance_after, created_at`,
    [
      input.householdId,
      input.kidId,
      input.kind,
      input.amount,
      clampedAmount,
      balanceAfter,
      taskCompletionId,
      longTermProgressId,
      redemptionId,
      campaignId,
      adminUserId,
      undoOfEntryId,
      note,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('ledger.post: INSERT returned no row');

  return {
    id: row.id,
    kind: row.kind as LedgerKind,
    amount: row.amount,
    clampedAmount: row.clamped_amount,
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  };
}

/**
 * Convenience wrapper: opens its own transaction and posts a single entry.
 * Useful from worker cron paths where there's no surrounding state to
 * coordinate (campaign bonus posted purely from a daily-reset evaluation).
 * Server actions that need to atomically post + update a related table
 * should manage their own transaction and call `ledgerPost` directly.
 */
export async function postWithTransaction(
  pool: Pool,
  input: PostInput,
): Promise<PostedEntry> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const entry = await ledgerPost(client, input);
    await client.query('COMMIT');
    return entry;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

function validateInput(input: PostInput): void {
  if (!Number.isInteger(input.amount)) {
    throw new LedgerInvariantError(`amount must be an integer, got ${input.amount}`);
  }
  switch (input.kind) {
    case 'earn':
      if (input.amount <= 0) {
        throw new LedgerInvariantError('earn amount must be > 0');
      }
      if (!input.taskCompletionId && !input.longTermProgressId) {
        throw new LedgerInvariantError(
          'earn requires taskCompletionId or longTermProgressId',
        );
      }
      if (input.taskCompletionId && input.longTermProgressId) {
        throw new LedgerInvariantError(
          'earn cannot reference both taskCompletionId and longTermProgressId',
        );
      }
      break;
    case 'campaign_bonus':
      if (input.amount <= 0) {
        throw new LedgerInvariantError('campaign_bonus amount must be > 0');
      }
      break;
    case 'redeem':
      if (input.amount >= 0) {
        throw new LedgerInvariantError('redeem amount must be < 0');
      }
      break;
    case 'redemption_refund':
      if (input.amount <= 0) {
        throw new LedgerInvariantError('redemption_refund amount must be > 0');
      }
      break;
    case 'admin_credit':
      if (input.amount <= 0) {
        throw new LedgerInvariantError('admin_credit amount must be > 0');
      }
      if (!input.note?.trim()) {
        throw new LedgerInvariantError('admin_credit requires non-empty note');
      }
      break;
    case 'admin_debit':
      if (input.amount >= 0) {
        throw new LedgerInvariantError('admin_debit amount must be < 0');
      }
      if (!input.note?.trim()) {
        throw new LedgerInvariantError('admin_debit requires non-empty note');
      }
      break;
    case 'undo':
      if (input.amount === 0) {
        throw new LedgerInvariantError('undo amount cannot be 0');
      }
      break;
  }
}
