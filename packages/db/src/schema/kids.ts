/**
 * Drizzle definitions for kid identity + per-device trust.
 *
 * Kids have no email/password — just a 4-digit PIN (Argon2). The device_trust
 * row + cookie pair lets a kid skip PIN on a trusted browser; revocation just
 * sets revoked_at. UNIQUE(household_id, slug) makes the profile-picker URL
 * routing safe (e.g. /pick/lia).
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  unique,
} from 'drizzle-orm/pg-core';
import { household } from './tenancy';

export const kid = pgTable(
  'kid',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color').notNull(),
    avatarImagePath: text('avatar_image_path'),
    /** Phase 7.5: optional preset avatar from the kid bank ('av-fox' etc.).
     *  Kid-editable via /[lang]/avatar. Renderer prefers this when set. */
    avatarKey: text('avatar_key'),
    /** App-wide theme the player picked for their surfaces. One of
     *  'bubblegum' | 'ocean' | 'sunset' (see lib/theme.ts). Recolors surfaces
     *  + the action accent; semantic colors (mint/yellow/lavender) stay fixed. */
    theme: text('theme').notNull().default('bubblegum'),
    locale: text('locale').notNull().default('he'),
    pinHash: text('pin_hash').notNull(),
    pinFailedCount: integer('pin_failed_count').notNull().default(0),
    pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
    birthdate: date('birthdate'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    householdSlugUnq: unique('kid_household_id_slug_key').on(table.householdId, table.slug),
  }),
);

export const deviceTrust = pgTable(
  'device_trust',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'restrict' }),
    kidId: uuid('kid_id')
      .notNull()
      .references(() => kid.id, { onDelete: 'cascade' }),
    deviceLabel: text('device_label').notNull(),
    trustTokenHash: text('trust_token_hash').notNull(),
    userAgentFp: text('user_agent_fp').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    kidTokenUnq: unique('device_trust_kid_id_trust_token_hash_key').on(
      table.kidId,
      table.trustTokenHash,
    ),
  }),
);

export type Kid = typeof kid.$inferSelect;
export type KidInsert = typeof kid.$inferInsert;
export type DeviceTrust = typeof deviceTrust.$inferSelect;
export type DeviceTrustInsert = typeof deviceTrust.$inferInsert;
