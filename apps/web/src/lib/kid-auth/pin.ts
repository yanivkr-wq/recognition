/**
 * PIN verification — Argon2id + lockout enforcement.
 *
 * Node-runtime only (imports `@node-rs/argon2` + the pg-backed `getDb()`).
 * Rate-limit policy: 5 wrong attempts → 15-min lockout per kid (ARCHITECTURE.md
 * §7 specifies "per (kid, device)" but the v1 schema columns are per-kid only;
 * upgrading to per-(kid, device) is a v2 refinement). On success the failed
 * counter + lockout are reset atomically.
 *
 * Sentinel placeholders from 0002_seed_household.sql (all-zero salt + hash)
 * verify-false for every PIN, which is the intended "no PIN set yet" state
 * until an admin uses /admin/kids/<id>/pin to set a real one.
 */

import 'server-only';
import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { getDb, kid as kidTable } from '@reco/db';
import { PIN_LOCKOUT_DURATION_MS, PIN_LOCKOUT_THRESHOLD } from './constants';

export type VerifyPinReason = 'invalid_format' | 'unknown' | 'locked' | 'wrong';

export interface VerifyPinSuccess {
  ok: true;
  kid: {
    id: string;
    householdId: string;
    name: string;
    slug: string;
    color: string;
    locale: 'he' | 'en';
  };
}

export interface VerifyPinFailure {
  ok: false;
  reason: VerifyPinReason;
}

export type VerifyPinResult = VerifyPinSuccess | VerifyPinFailure;

export async function verifyKidPin(kidId: string, pin: string): Promise<VerifyPinResult> {
  if (!/^\d{4}$/.test(pin)) return { ok: false, reason: 'invalid_format' };

  const db = getDb();
  const rows = await db.select().from(kidTable).where(eq(kidTable.id, kidId)).limit(1);
  const k = rows[0];
  if (!k || k.archivedAt !== null) return { ok: false, reason: 'unknown' };

  const now = new Date();
  if (k.pinLockedUntil && k.pinLockedUntil > now) {
    return { ok: false, reason: 'locked' };
  }

  let valid = false;
  try {
    valid = await verify(k.pinHash, pin);
  } catch {
    valid = false;
  }

  if (!valid) {
    const nextCount = k.pinFailedCount + 1;
    const lockUntil =
      nextCount >= PIN_LOCKOUT_THRESHOLD
        ? new Date(now.getTime() + PIN_LOCKOUT_DURATION_MS)
        : null;
    await db
      .update(kidTable)
      .set({ pinFailedCount: nextCount, pinLockedUntil: lockUntil, updatedAt: now })
      .where(eq(kidTable.id, kidId));
    return { ok: false, reason: lockUntil ? 'locked' : 'wrong' };
  }

  if (k.pinFailedCount > 0 || k.pinLockedUntil) {
    await db
      .update(kidTable)
      .set({ pinFailedCount: 0, pinLockedUntil: null, updatedAt: now })
      .where(eq(kidTable.id, kidId));
  }

  return {
    ok: true,
    kid: {
      id: k.id,
      householdId: k.householdId,
      name: k.name,
      slug: k.slug,
      color: k.color,
      locale: k.locale as 'he' | 'en',
    },
  };
}
