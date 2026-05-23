/**
 * Drizzle definitions for the badge catalog + per-kid earned badges.
 *
 * `kid_badge.awarded_for_year` is NULL for one-shot badges and the calendar
 * year (e.g. 2026) for recurring badges like Birthday. The UNIQUE constraint
 * uses NULLS NOT DISTINCT (Postgres 15+) so non-yearly badges still enforce
 * earn-once semantics — see 0001_init.sql §9.
 */

import { pgTable, uuid, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { household, user } from './tenancy';
import { kid } from './kids';
// NB: source_campaign_id refers to campaign(id); imported lazily where needed
// to avoid forming a cycle here.

export type BadgeAwardedVia = 'campaign' | 'manual';

export const badge = pgTable('badge', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  titleHe: text('title_he').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionHe: text('description_he'),
  descriptionEn: text('description_en'),
  iconKey: text('icon_key').notNull(),
  color: text('color').notNull(),
  awardedVia: text('awarded_via').$type<BadgeAwardedVia>().notNull().default('campaign'),
  displayOrder: integer('display_order').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kidBadge = pgTable(
  'kid_badge',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kidId: uuid('kid_id')
      .notNull()
      .references(() => kid.id, { onDelete: 'cascade' }),
    badgeId: uuid('badge_id')
      .notNull()
      .references(() => badge.id, { onDelete: 'restrict' }),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
    awardedForYear: integer('awarded_for_year'),
    sourceCampaignId: uuid('source_campaign_id'),
    awardedByUserId: uuid('awarded_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    // NULLS NOT DISTINCT is declared in raw SQL only; Drizzle's `unique()`
    // helper in 0.36 emits the standard DISTINCT semantics. The runtime
    // constraint comes from the migration, not from here.
    kidBadgeYearUnq: unique('kid_badge_kid_id_badge_id_awarded_for_year_key').on(
      table.kidId,
      table.badgeId,
      table.awardedForYear,
    ),
  }),
);

export type Badge = typeof badge.$inferSelect;
export type BadgeInsert = typeof badge.$inferInsert;
export type KidBadge = typeof kidBadge.$inferSelect;
export type KidBadgeInsert = typeof kidBadge.$inferInsert;
