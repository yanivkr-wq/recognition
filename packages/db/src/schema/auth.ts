/**
 * Drizzle definitions for Auth.js v5 (parent/admin only).
 *
 * Standard NextAuth + Drizzle adapter shape. v1 uses Credentials provider
 * (email + Argon2 password) backed by `user` from ./tenancy.ts; OAuth tables
 * are present but unused. Kid auth lives in a separate custom JWT flow (see
 * ./kids.ts + apps/web/src/lib/kid-auth.ts in Phase 2).
 */

import { pgTable, uuid, text, timestamp, bigint, primaryKey, unique } from 'drizzle-orm/pg-core';
import { user } from './tenancy';

export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  sessionToken: text('session_token').notNull().unique(),
});

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: bigint('expires_at', { mode: 'number' }),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (table) => ({
    providerUnq: unique('account_provider_provider_account_id_key').on(
      table.provider,
      table.providerAccountId,
    ),
  }),
);

export const verificationToken = pgTable(
  'verification_token',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

export type Session = typeof session.$inferSelect;
export type SessionInsert = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type AccountInsert = typeof account.$inferInsert;
export type VerificationToken = typeof verificationToken.$inferSelect;
export type VerificationTokenInsert = typeof verificationToken.$inferInsert;
