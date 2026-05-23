/**
 * Cookie attribute helpers used by both the API routes (Node) and the
 * middleware (edge).
 *
 * All kid cookies are HttpOnly + SameSite=Lax + Secure-in-prod. The
 * intentional choice of SameSite=Lax (not Strict) is so the kid can land
 * on a Reco URL from a parent's WhatsApp message and still carry the
 * session forward.
 */

import {
  KID_SESSION_COOKIE,
  KID_SESSION_MAX_AGE_S,
  KID_TRUST_COOKIE,
  KID_TRUST_MAX_AGE_S,
} from './constants';

interface CookieOpts {
  name: string;
  value: string;
  maxAgeS: number;
  path?: string;
}

function cookieFlags(secure: boolean): string {
  return `HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function buildSetCookie(opts: CookieOpts, secure: boolean): string {
  const path = opts.path ?? '/';
  return `${opts.name}=${opts.value}; Max-Age=${opts.maxAgeS}; Path=${path}; ${cookieFlags(secure)}`;
}

function buildClearCookie(name: string, secure: boolean): string {
  return `${name}=; Max-Age=0; Path=/; ${cookieFlags(secure)}`;
}

const isProd = (): boolean => process.env.NODE_ENV === 'production';

export function setKidSessionCookieHeader(token: string): string {
  return buildSetCookie(
    { name: KID_SESSION_COOKIE, value: token, maxAgeS: KID_SESSION_MAX_AGE_S },
    isProd(),
  );
}

export function setKidTrustCookieHeader(rawToken: string): string {
  return buildSetCookie(
    { name: KID_TRUST_COOKIE, value: rawToken, maxAgeS: KID_TRUST_MAX_AGE_S },
    isProd(),
  );
}

export function clearKidSessionCookieHeader(): string {
  return buildClearCookie(KID_SESSION_COOKIE, isProd());
}

export function clearKidTrustCookieHeader(): string {
  return buildClearCookie(KID_TRUST_COOKIE, isProd());
}
