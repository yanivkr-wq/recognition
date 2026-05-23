/**
 * Server action for kid PIN entry.
 *
 * Flow:
 *   1. Run verifyKidPin() (Argon2 + lockout) against the kid_id.
 *   2. On success: issue a kid-session JWT and set the `reco-kid-session` cookie;
 *      if the kid checked "remember this device", also issue + set the
 *      `reco-kid-trust` cookie (90-day persistent token with a DB-backed hash).
 *   3. Redirect to /[lang]/ (kid home).
 *
 * On failure return a typed error key the client component maps to a
 * dictionary string. The PIN-as-string never returns to the client — only
 * the verdict.
 */

'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  KID_SESSION_COOKIE,
  KID_SESSION_MAX_AGE_S,
  KID_TRUST_COOKIE,
  KID_TRUST_MAX_AGE_S,
} from '../../../../lib/kid-auth/constants';
import { verifyKidPin } from '../../../../lib/kid-auth/pin';
import { issueKidSession } from '../../../../lib/kid-auth/session';
import { issueDeviceTrust } from '../../../../lib/kid-auth/device-trust';
import { computeDeviceFingerprint } from '../../../../lib/kid-auth/fingerprint';

export type PinSubmitError = 'wrong' | 'locked' | 'unknown';
export type PinSubmitResult = { ok: false; error: PinSubmitError };

export async function submitPin(args: {
  kidId: string;
  pin: string;
  rememberDevice: boolean;
  lang: string;
}): Promise<PinSubmitResult | void> {
  const result = await verifyKidPin(args.kidId, args.pin);
  if (!result.ok) {
    if (result.reason === 'locked') return { ok: false, error: 'locked' };
    if (result.reason === 'wrong') return { ok: false, error: 'wrong' };
    return { ok: false, error: 'unknown' };
  }

  const hdrs = await headers();
  const fp = await computeDeviceFingerprint(hdrs);
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';

  const sessionToken = await issueKidSession({
    id: result.kid.id,
    householdId: result.kid.householdId,
  });
  cookieStore.set({
    name: KID_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: KID_SESSION_MAX_AGE_S,
  });

  if (args.rememberDevice) {
    const ua = hdrs.get('user-agent') ?? 'unknown';
    const label = `${result.kid.name} — ${shortUA(ua)}`;
    const { rawToken } = await issueDeviceTrust({
      kidId: result.kid.id,
      householdId: result.kid.householdId,
      deviceLabel: label,
      userAgentFp: fp,
    });
    cookieStore.set({
      name: KID_TRUST_COOKIE,
      value: rawToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: KID_TRUST_MAX_AGE_S,
    });
  }

  // throws — useTransition on the client handles the navigation
  redirect(`/${args.lang}/`);
}

/** Best-effort short device label from a UA string for the admin devices list. */
function shortUA(ua: string): string {
  const trimmed = ua.slice(0, 80);
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'Mac';
  return trimmed;
}
