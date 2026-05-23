/**
 * Drizzle definitions for tenancy tables (household + user/admin).
 *
 * The household table is single-row in v1 but shaped for multi-tenant later
 * (every domain row carries household_id). The "user" table is parents only
 * — kids live in ./kids.ts. role is a text-enum with the only legal value
 * 'admin' in v1 (RLS-equivalent is enforced at the app boundary, not in DB).
 */

import { pgTable, uuid, text, timestamp, integer, time } from 'drizzle-orm/pg-core';

export const household = pgTable('household', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tz: text('tz').notNull().default('Asia/Jerusalem'),
  localeDefault: text('locale_default').notNull().default('he'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => household.id, { onDelete: 'restrict' }),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phoneE164: text('phone_e164'),
  locale: text('locale').notNull().default('he'),
  role: text('role').$type<'admin'>().notNull(),
  quietHoursStart: time('quiet_hours_start').notNull().default('21:00'),
  quietHoursEnd: time('quiet_hours_end').notNull().default('07:00'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Household = typeof household.$inferSelect;
export type HouseholdInsert = typeof household.$inferInsert;
export type User = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;
