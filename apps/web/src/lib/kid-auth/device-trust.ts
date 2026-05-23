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
  if (row.userAgentFp !== args.userAgentFp) return null;

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
