/**
 * Auth.js v5 — edge-runtime-safe partial config.
 *
 * Imported by both `./auth.ts` (full Node-runtime config with the Credentials
 * provider) and `./middleware.ts` (Edge runtime). The middleware can't pull
 * in `@node-rs/argon2` or `pg`, so this file deliberately excludes the
 * `providers` array and the DB-backed `authorize()` callback — both are
 * added in auth.ts.
 *
 * The jwt + session callbacks live here because middleware reads the JWT
 * payload to decide whether a request is authenticated.
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/he/login',
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user.id ?? '') as string;
        token.householdId = user.householdId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.householdId = token.householdId as string;
        session.user.role = token.role as 'admin';
      }
      return session;
    },
  },
};
