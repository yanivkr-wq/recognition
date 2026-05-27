/**
 * Admin → player popup messages (Drizzle).
 *
 * A message shows as a dismissible popup on a player's home during its
 * [startDate, endDate] window. kidId NULL = broadcast to all players in the
 * household. Dismissal is per-player ("do not show again") via
 * playerMessageDismissal, so a broadcast is dismissed independently by each
 * kid. See migration 0009_player_messages.sql.
 */

import { pgTable, uuid, text, date, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { household, user } from './tenancy';
import { kid } from './kids';

export const playerMessage = pgTable(
  'player_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    kidId: uuid('kid_id').references(() => kid.id, { onDelete: 'cascade' }),
    title: text('title'),
    body: text('body').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    byWindow: index('player_message_household_window_idx').on(
      table.householdId,
      table.startDate,
      table.endDate,
    ),
  }),
);

export const playerMessageDismissal = pgTable(
  'player_message_dismissal',
  {
    messageId: uuid('message_id')
      .notNull()
      .references(() => playerMessage.id, { onDelete: 'cascade' }),
    kidId: uuid('kid_id')
      .notNull()
      .references(() => kid.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.kidId] }),
  }),
);

export type PlayerMessage = typeof playerMessage.$inferSelect;
export type PlayerMessageInsert = typeof playerMessage.$inferInsert;
