/**
 * Drizzle definition for the append-only wallet ledger.
 *
 * APPEND-ONLY: callers must never UPDATE or DELETE rows here. Every change is
 * a new entry. The single legitimate writer is `apps/worker/src/ledger/post.ts`
 * (Phase 3); a grep test in CI guards against direct INSERTs. `balance_after`
 * is denormalized for fast wallet reads and MUST equal SUM(amount) over the
 * kid's prior entries (invariant tested in `packages/db/src/ledger/INVARIANTS.md`).
 */

import { pgTable, uuid, text, timestamp, integer, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { household, user } from './tenancy';
import { kid } from './kids';
import { taskCompletion, longTermProgress } from './completions';
import { redemption } from './rewards';
import { campaign } from './campaigns';

export type LedgerKind =
  | 'earn'
  | 'campaign_bonus'
  | 'redeem'
  | 'redemption_refund'
  | 'admin_credit'
  | 'admin_debit'
  | 'undo';

export const ledgerEntry = pgTable('ledger_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  kidId: uuid('kid_id')
    .notNull()
    .references(() => kid.id, { onDelete: 'restrict' }),
  kind: text('kind').$type<LedgerKind>().notNull(),
  amount: integer('amount').notNull(),
  clampedAmount: integer('clamped_amount'),
  balanceAfter: integer('balance_after').notNull(),
  taskCompletionId: uuid('task_completion_id').references(() => taskCompletion.id, {
    onDelete: 'restrict',
  }),
  longTermProgressId: uuid('long_term_progress_id').references(() => longTermProgress.id, {
    onDelete: 'restrict',
  }),
  redemptionId: uuid('redemption_id').references(() => redemption.id, { onDelete: 'restrict' }),
  campaignId: uuid('campaign_id').references(() => campaign.id, { onDelete: 'restrict' }),
  adminUserId: uuid('admin_user_id').references(() => user.id, { onDelete: 'restrict' }),
  undoOfEntryId: uuid('undo_of_entry_id').references((): AnyPgColumn => ledgerEntry.id, {
    onDelete: 'restrict',
  }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LedgerEntry = typeof ledgerEntry.$inferSelect;
export type LedgerEntryInsert = typeof ledgerEntry.$inferInsert;
