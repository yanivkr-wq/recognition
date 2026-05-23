/**
 * Dual-principal guards for server actions and server components.
 *
 * Middleware (apps/web/src/middleware.ts) resolves the principal into
 * request headers (`x-reco-principal`, `x-reco-kid-id`, `x-reco-household-id`)
 * once per request — these helpers read those headers AND verify the kid
 * still exists / isn't archived. Server actions MUST go through one of these
 * before touching domain state; the request-header signal alone is not
 * authoritative because a malicious client could spoof headers if middleware
 * were ever bypassed (defense in depth).
 *
 * Per ARCHITECTURE.md §8: kid-scoped queries always filter by
 * `kid_id = session.kid_id`; admin-scoped queries by `household_id`.
 */

import 'server-only';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, kid as kidTable } from '@reco/db';
import { auth } from '../../auth';

export class UnauthorizedError extends Error {
  override readonly name = 'UnauthorizedError';
  constructor(
    message: string,
    public readonly principal: 'kid' | 'admin' | 'either',
  ) {
    super(message);
  }
}

export interface KidPrincipal {
  kidId: string;
  householdId: string;
  name: string;
  color: string;
  locale: string;
  /** Phase 7.5: preset avatar key picked by the kid. Null = use initial fallback. */
  avatarKey: string | null;
}

export async function requireKid(): Promise<KidPrincipal> {
  const hdrs = await headers();
  if (hdrs.get('x-reco-principal') !== 'kid') {
    throw new UnauthorizedError('kid session required', 'kid');
  }
  const kidId = hdrs.get('x-reco-kid-id');
  const householdId = hdrs.get('x-reco-household-id');
  if (!kidId || !householdId) {
    throw new UnauthorizedError('kid session missing identity', 'kid');
  }

  const rows = await getDb()
    .select({
      id: kidTable.id,
      householdId: kidTable.householdId,
      name: kidTable.name,
      color: kidTable.color,
      locale: kidTable.locale,
      avatarKey: kidTable.avatarKey,
    })
    .from(kidTable)
    .where(and(eq(kidTable.id, kidId), isNull(kidTable.archivedAt)))
    .limit(1);
  const k = rows[0];
  if (!k || k.householdId !== householdId) {
    throw new UnauthorizedError('kid not found or archived', 'kid');
  }
  return {
    kidId: k.id,
    householdId: k.householdId,
    name: k.name,
    color: k.color,
    locale: k.locale,
    avatarKey: k.avatarKey,
  };
}

export interface AdminPrincipal {
  userId: string;
  householdId: string;
  name: string;
  email: string;
}

export async function requireAdmin(): Promise<AdminPrincipal> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError('admin session required', 'admin');
  }
  return {
    userId: session.user.id,
    householdId: session.user.householdId,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
  };
}
