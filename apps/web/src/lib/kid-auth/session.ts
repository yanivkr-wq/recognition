/**
 * Kid-session JWT — sign + verify with Web Crypto HMAC-SHA256.
 *
 * Edge-runtime safe (no Node `crypto` import). Tokens carry the household
 * scoping fields so middleware can decide ownership without DB hits. The
 * signing key is derived from AUTH_SECRET (same secret as Auth.js parent
 * sessions) — one rotation invalidates everything atomically.
 *
 * Token shape: `<base64url(JSON payload)>.<base64url(HMAC-SHA256 over payload)>`.
 * Payload: { kid_id, household_id, iat, exp, jti }.
 */

import { KID_SESSION_MAX_AGE_S } from './constants';

export interface KidSessionPayload {
  kid_id: string;
  household_id: string;
  iat: number;
  exp: number;
  jti: string;
}

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required for kid-session signing');
  cachedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return cachedKey;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const buf = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function issueKidSession(kid: {
  id: string;
  householdId: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: KidSessionPayload = {
    kid_id: kid.id,
    household_id: kid.householdId,
    iat: now,
    exp: now + KID_SESSION_MAX_AGE_S,
    jti: crypto.randomUUID(),
  };
  const payloadStr = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey();
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadStr)),
  );
  return `${payloadStr}.${b64urlEncode(sigBytes)}`;
}

export async function verifyKidSession(token: string): Promise<KidSessionPayload | null> {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;
  const payloadStr = token.slice(0, dotIdx);
  const sigStr = token.slice(dotIdx + 1);
  if (!payloadStr || !sigStr) return null;

  const key = await getKey();
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sigStr),
      new TextEncoder().encode(payloadStr),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payloadStr)),
    ) as KidSessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (typeof payload.kid_id !== 'string' || typeof payload.household_id !== 'string') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
