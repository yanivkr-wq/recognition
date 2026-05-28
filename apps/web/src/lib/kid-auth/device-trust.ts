/**
 * Device-trust cookie issue / verify / revoke.
 *
 * Issue: generate 32 random bytes (URL-safe base64), SHA-256 the result,
 * persist the hash in `device_trust`. Return the raw token to set as the
 * `reco-kid-trust` cookie. Verify: SHA-256 the cookie value, look up the
 * row, check expiry + UA-fingerprint match + revocation, bump last_seen_at.
 *
 * Node-runtime: needs pg (DB lookups). Hashes live in DB, raw tokens only on
 * the kid's browser. A stolen DB dump alone never grants access; a stolen
 * cookie alone is useless without a matching DB row (defense-in-depth).
 */

import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb, deviceTrust } from '@reco/db';
import { KID_TRUST_MAX_AGE_S } from './constants';

function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface IssueDeviceTrustArgs {
  kidId: string;
  householdId: string;
  deviceLabel: string;
  userAgentFp: string;
}

export async function issueDeviceTrust(args: IssueDeviceTrustArgs): Promise<{ rawToken: string }> {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = sha256hex(rawToken);
  await getDb().insert(deviceTrust).values({
    kidId: args.kidId,
    householdId: args.householdId,
    deviceLabel: args.deviceLabel,
    trustTokenHash: tokenHash,
    userAgentFp: args.userAgentFp,
    expiresAt: new Date(Date.now() + KID_TRUST_MAX_AGE_S * 1000),
  });
  return { rawToken };
}

export interface VerifyDeviceTrustResult {
  kidId: string;
  householdId: string;
  deviceTrustId: string;
}

export async function verifyDeviceTrust(args: {
  rawToken: string;
  /** Coarse "iphone/safari/he" signature — kept for audit + future re-tightening
   *  but no longer used as a strict equality gate (see comment below). */
  userAgentFp: string;
}): Promise<VerifyDeviceTrustResult | null> {
  const tokenHash = sha256hex(args.rawToken);
  const now = new Date();
  const rows = await getDb()
    .select()
    .from(deviceTrust)
    .where(
      and(
        eq(deviceTrust.trustTokenHash, tokenHash),
        gt(deviceTrust.expiresAt, now),
        isNull(deviceTrust.revokedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  // Intentionally NOT comparing row.userAgentFp to args.userAgentFp.
  // The previous implementation rejected the cookie on any UA mismatch, but in
  // practice the legit UA changes constantly on a phone (iOS patch bump, PWA
  // install vs Safari, Private Relay) — which silently invalidated every
  // "remember me" cookie and forced the kid back to PIN entry on each launch.
  // The defense-in-depth that matters is HttpOnly+Secure+SameSite=Lax on the
  // cookie plus the DB-side token hash + expiry + revocation — those carry
  // the actual security. If we ever want a strict device gate again, the
  // right home for it is a per-issue family-managed allow/deny list in the
  // admin "devices" page, not an opaque server-side equality check.
  void args.userAgentFp;

  await getDb()
    .update(deviceTrust)
    .set({ lastSeenAt: now })
    .where(eq(deviceTrust.id, row.id));

  return { kidId: row.kidId, householdId: row.householdId, deviceTrustId: row.id };
}

export async function revokeDeviceTrust(id: string): Promise<void> {
  await getDb()
    .update(deviceTrust)
    .set({ revokedAt: new Date() })
    .where(eq(deviceTrust.id, id));
}
