/**
 * Type augmentation for Auth.js v5.
 *
 * Adds the household-scoping fields Reco needs on every session: the
 * household_id (for filtering domain queries) and the role discriminator
 * (parent admins only in v1). The JWT carries the same fields so the
 * middleware doesn't need a DB round-trip per request.
 */

import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id?: string;
    householdId: string;
    role: 'admin';
  }

  interface Session {
    user: {
      id: string;
      householdId: string;
      role: 'admin';
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser {
    householdId: string;
    role: 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    householdId: string;
    role: 'admin';
  }
}

export {};
