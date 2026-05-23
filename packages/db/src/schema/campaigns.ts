/**
 * Drizzle definitions for campaigns + feeding-task M:M + per-kid enrollments +
 * nudge log.
 *
 * `campaign.kind` discriminates streak vs total; either streak_target_days or
 * total_target_quantity is non-null but never both (DB CHECK constraint in
 * 0001_init.sql §9). `campaign_enrollment.bonus_ledger_id` is a circular FK
 * to ledger_entry — added post-CREATE.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';
import { household } from './tenancy';
import { kid } from './kids';
import { taskTemplate } from './tasks';
import { badge, kidBadge } from './badges';

export type CampaignKind = 'streak' | 'total';
export type NudgeCadence = 'standard' | 'aggressive' | 'gentle' | 'silent';
export type CompletedKind = 'success' | 'incomplete' | 'cancelled';

export const campaign = pgTable('campaign', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  titleHe: text('title_he').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionHe: text('description_he'),
  descriptionEn: text('description_en'),
  kind: text('kind').$type<CampaignKind>().notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  bonusCoins: integer('bonus_coins').notNull(),
  badgeId: uuid('badge_id').references(() => badge.id, { onDelete: 'set null' }),
  streakTargetDays: integer('streak_target_days'),
  streakFreezesAllowed: integer('streak_freezes_allowed').notNull().default(1),
  streakPerDayThreshold: integer('streak_per_day_threshold'),
  totalTargetQuantity: integer('total_target_quantity'),
  nudgeCadence: text('nudge_cadence').$type<NudgeCadence>().notNull().default('standard'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const campaignFeedingTask = pgTable(
  'campaign_feeding_task',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => taskTemplate.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.campaignId, table.templateId] }),
  }),
);

export const campaignEnrollment = pgTable(
  'campaign_enrollment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    kidId: uuid('kid_id')
      .notNull()
      .references(() => kid.id, { onDelete: 'cascade' }),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    freezesUsed: integer('freezes_used').notNull().default(0),
    lastStreakAdvanceDate: date('last_streak_advance_date'),
    currentTotal: integer('current_total').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedKind: text('completed_kind').$type<CompletedKind>(),
    // Circular FK to ledger_entry — added in 0001_init.sql §16.
    bonusLedgerId: uuid('bonus_ledger_id'),
    badgeAwardId: uuid('badge_award_id').references(() => kidBadge.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    campaignKidUnq: unique('campaign_enrollment_campaign_id_kid_id_key').on(
      table.campaignId,
      table.kidId,
    ),
  }),
);

export const campaignNudgeLog = pgTable('campaign_nudge_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaign.id, { onDelete: 'cascade' }),
  kidId: uuid('kid_id')
    .notNull()
    .references(() => kid.id, { onDelete: 'cascade' }),
  firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
  channel: text('channel').$type<'whatsapp' | 'bell'>().notNull(),
  messageText: text('message_text'),
  // Set by ./notifications.ts — kept as bare uuid to avoid an import cycle.
  notificationEventId: uuid('notification_event_id'),
});

export type Campaign = typeof campaign.$inferSelect;
export type CampaignInsert = typeof campaign.$inferInsert;
export type CampaignEnrollment = typeof campaignEnrollment.$inferSelect;
export type CampaignEnrollmentInsert = typeof campaignEnrollment.$inferInsert;
export type CampaignFeedingTask = typeof campaignFeedingTask.$inferSelect;
export type CampaignFeedingTaskInsert = typeof campaignFeedingTask.$inferInsert;
export type CampaignNudgeLog = typeof campaignNudgeLog.$inferSelect;
export type CampaignNudgeLogInsert = typeof campaignNudgeLog.$inferInsert;
