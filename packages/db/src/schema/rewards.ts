/**
 * Drizzle definitions for reward catalog + redemptions.
 *
 * `redemption` snapshots reward fields at redeem time so a later rename of
 * the underlying reward_item does NOT rewrite history. ledger_debit_id is
 * NOT NULL but the FK is added post-CREATE (circular with ledger_entry —
 * see 0001_init.sql §16). Status transitions are app-enforced; the DB just
 * constrains the enum.
 */

import { pgTable, uuid, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { household } from './tenancy';
import { kid } from './kids';
import { user } from './tenancy';

export type RedemptionStatus = 'pending_delivery' | 'received' | 'cancelled' | 'refunded';

export const rewardItem = pgTable('reward_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  titleHe: text('title_he').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionHe: text('description_he'),
  descriptionEn: text('description_en'),
  iconKey: text('icon_key').notNull(),
  imagePath: text('image_path'),
  color: text('color').notNull().default('#94a3b8'),
  coinCost: integer('coin_cost').notNull(),
  stockQuantity: integer('stock_quantity'),
  maxPerKidPerDay: integer('max_per_kid_per_day'),
  displayOrder: integer('display_order').notNull().default(0),
  visibleToKids: boolean('visible_to_kids').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const redemption = pgTable('redemption', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  kidId: uuid('kid_id')
    .notNull()
    .references(() => kid.id, { onDelete: 'cascade' }),
  rewardItemId: uuid('reward_item_id')
    .notNull()
    .references(() => rewardItem.id, { onDelete: 'restrict' }),
  snapshotTitleHe: text('snapshot_title_he').notNull(),
  snapshotTitleEn: text('snapshot_title_en').notNull(),
  snapshotCoinCost: integer('snapshot_coin_cost').notNull(),
  status: text('status').$type<RedemptionStatus>().notNull().default('pending_delivery'),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  receivedByUserId: uuid('received_by_user_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  receivedByKidId: uuid('received_by_kid_id').references(() => kid.id, {
    onDelete: 'set null',
  }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledByUserId: uuid('cancelled_by_user_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  cancelReason: text('cancel_reason'),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  refundedByUserId: uuid('refunded_by_user_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  refundReason: text('refund_reason'),
  // Circular FKs — added in 0001_init.sql §16.
  ledgerDebitId: uuid('ledger_debit_id').notNull(),
  ledgerRefundCreditId: uuid('ledger_refund_credit_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RewardItem = typeof rewardItem.$inferSelect;
export type RewardItemInsert = typeof rewardItem.$inferInsert;
export type Redemption = typeof redemption.$inferSelect;
export type RedemptionInsert = typeof redemption.$inferInsert;
