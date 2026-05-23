/**
 * Drizzle definition for the unified notification event log.
 *
 * One row per (recipient, channel, event) — recipient is XOR(kid, user). All
 * inserts MUST use ON CONFLICT (dedup_key, channel) DO NOTHING so cron ticks
 * are idempotent (docs/NOTIFICATIONS.md). state machine: pending → sent |
 * failed | skipped | deferred | rate_limited.
 */

import { pgTable, uuid, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { household, user } from './tenancy';
import { kid } from './kids';

export type NotificationEventKind =
  | 'task_reminder'
  | 'submission_pending'
  | 'submission_approved'
  | 'submission_denied'
  | 'new_redeem_item'
  | 'campaign_nudge'
  | 'campaign_completed'
  | 'streak_freeze_used'
  | 'streak_broken'
  | 'redemption_received'
  | 'redemption_refunded'
  | 'admin_wallet_adjustment'
  | 'sibling_badge_earned';

export type NotificationChannel = 'whatsapp' | 'bell';

export type NotificationState =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'deferred'
  | 'rate_limited';

export const notificationEvent = pgTable(
  'notification_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    eventKind: text('event_kind').$type<NotificationEventKind>().notNull(),
    recipientKidId: uuid('recipient_kid_id').references(() => kid.id, { onDelete: 'cascade' }),
    recipientUserId: uuid('recipient_user_id').references(() => user.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<NotificationChannel>().notNull(),
    state: text('state').$type<NotificationState>().notNull().default('pending'),
    deferredUntil: timestamp('deferred_until', { withTimezone: true }),
    fireAt: timestamp('fire_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    errorMsg: text('error_msg'),
    dedupKey: text('dedup_key').notNull(),
    providerId: text('provider_id'),
    payloadJson: jsonb('payload_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dedupChannelUnq: unique('notification_event_dedup_key_channel_key').on(
      table.dedupKey,
      table.channel,
    ),
  }),
);

export type NotificationEvent = typeof notificationEvent.$inferSelect;
export type NotificationEventInsert = typeof notificationEvent.$inferInsert;
