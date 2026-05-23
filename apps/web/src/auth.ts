/**
 * Auth.js v5 — full Node-runtime config for parent (admin) login.
 *
 * Credentials provider: email + Argon2id password verified against the
 * `user` table. Session strategy is JWT (Credentials providers don't compose
 * with Auth.js's DB session table). Failed attempts increment
 * user.failed_login_count; ≥5 within the lockout window sets locked_until
 * 15 min in the future. The lockout is rejected silently from authorize() so
 * the UI shows the same "invalid credentials" message either way (don't leak
 * lockout state to an attacker).
 *
 * Kid auth is a separate custom JWT flow handled in Phase 2 — kids never
 * touch this file.
 */

import 'server-only';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, user as userTable } from '@reco/db';
import { authConfig } from './auth.config';
import { verifyPassword } from './lib/auth/password';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_S },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const db = getDb();
        const rows = await db
          .select()
          .from(userTable)
          .where(eq(userTable.email, email))
          .limit(1);
        const u = rows[0];
        if (!u) return null;

        const now = new Date();
        if (u.lockedUntil && u.lockedUntil > now) return null;

        const ok = await verifyPassword(u.passwordHash, parsed.data.password);
        if (!ok) {
          const nextFailedCount = u.failedLoginCount + 1;
          const lockUntil =
            nextFailedCount >= LOCKOUT_THRESHOLD
              ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
              : null;
          await db
            .update(userTable)
            .set({
              failedLoginCount: nextFailedCount,
              lockedUntil: lockUntil,
              updatedAt: now,
            })
            .where(eq(userTable.id, u.id));
          return null;
        }

        if (u.failedLoginCount > 0 || u.lockedUntil) {
          await db
            .update(userTable)
            .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: now })
            .where(eq(userTable.id, u.id));
        }

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          householdId: u.householdId,
          role: u.role,
        };
      },
    }),
  ],
});
