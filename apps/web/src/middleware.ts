/**
 * Edge-runtime middleware: locale negotiation + dual-principal auth.
 *
 * Two authenticated principals (ARCHITECTURE.md §8):
 *   - Admin (parent) — Auth.js v5 session, resolved via NextAuth(authConfig).
 *   - Kid           — custom HMAC-signed JWT in the `reco-kid-session` cookie,
 *                     verified inline here so we don't need a DB round-trip
 *                     per request.
 *
 * Edge-safe imports only: ./auth.config, ./lib/kid-auth/session, ./lib/kid-auth/constants.
 * The Node-only `./lib/kid-auth/{pin,device-trust}` modules are deliberately NOT
 * imported — when a kid-trust cookie is present but the JWT is missing/expired
 * we redirect to /api/kid-session/refresh (Node) which does the DB lookup.
 *
 * Routing:
 *   /[lang]/login           — parent login (anonymous-only; redirects parents to /admin)
 *   /[lang]/pick            — profile picker (anonymous + kid; redirects parents to /admin)
 *   /[lang]/pick/:slug      — PIN entry (same gate as /pick)
 *   /[lang]/admin/*         — parent-only
 *   /[lang]/* (everything)  — kid OR parent
 */

import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { match as matchLocale } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import { authConfig } from './auth.config';
import { verifyKidSession } from './lib/kid-auth/session';
import { KID_SESSION_COOKIE, KID_TRUST_COOKIE } from './lib/kid-auth/constants';

const LOCALES = ['he', 'en'] as const;
const DEFAULT_LOCALE = 'he' as const;
type Locale = (typeof LOCALES)[number];

function negotiateLocale(req: NextRequest): Locale {
  const al = req.headers.get('accept-language') ?? '';
  try {
    const langs = new Negotiator({ headers: { 'accept-language': al } }).languages();
    return matchLocale(langs, [...LOCALES], DEFAULT_LOCALE) as Locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // 0) Skip Next internals, public assets, all /api/* (routes self-gate).
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 1) Locale negotiation.
  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (!hasLocale) {
    const locale = negotiateLocale(req);
    const tail = pathname === '/' ? '' : pathname;
    return NextResponse.redirect(new URL(`/${locale}${tail}${nextUrl.search}`, nextUrl));
  }

  const segments = pathname.split('/');
  const locale = (segments[1] ?? DEFAULT_LOCALE) as Locale;
  const restPath = '/' + segments.slice(2).join('/');

  // 2) Principal resolution.
  const hasParent = req.auth != null;
  const kidJwt = req.cookies.get(KID_SESSION_COOKIE)?.value;
  const kidSession = kidJwt ? await verifyKidSession(kidJwt) : null;
  const hasKid = kidSession != null;
  const hasKidTrust = req.cookies.get(KID_TRUST_COOKIE)?.value != null;

  // 3) Route classification.
  const isLogin = restPath === '/login' || restPath === '/login/';
  const isPick = restPath === '/pick' || restPath.startsWith('/pick/');
  const isAdmin = restPath === '/admin' || restPath.startsWith('/admin/');

  // 4) Cross-principal redirects.
  if (hasParent && (isLogin || isPick)) {
    return NextResponse.redirect(new URL(`/${locale}/admin`, nextUrl));
  }
  if (hasKid && (isLogin || isPick)) {
    return NextResponse.redirect(new URL(`/${locale}/`, nextUrl));
  }

  // 5) Public surfaces.
  if (isLogin || isPick) {
    return passThrough(req, locale);
  }

  // 6) Parent-only surfaces.
  if (isAdmin) {
    if (!hasParent) {
      return NextResponse.redirect(new URL(`/${locale}/login`, nextUrl));
    }
    return passThrough(req, locale, { principal: 'admin' });
  }

  // 7) Kid-or-parent surfaces — everything else under /[lang].
  if (!hasKid && !hasParent) {
    if (hasKidTrust) {
      // Try to silently refresh via the Node route.
      const refreshUrl = new URL('/api/kid-session/refresh', nextUrl);
      refreshUrl.searchParams.set('to', `${pathname}${nextUrl.search}`);
      return NextResponse.redirect(refreshUrl);
    }
    return NextResponse.redirect(new URL(`/${locale}/pick`, nextUrl));
  }

  return passThrough(req, locale, {
    principal: hasKid ? 'kid' : 'admin',
    kidId: kidSession?.kid_id,
    householdId: kidSession?.household_id,
  });
});

function passThrough(
  req: NextRequest,
  locale: Locale,
  ctx?: { principal?: 'admin' | 'kid'; kidId?: string; householdId?: string },
): NextResponse {
  const headers = new Headers(req.headers);
  headers.set('x-reco-locale', locale);
  if (ctx?.principal) headers.set('x-reco-principal', ctx.principal);
  if (ctx?.kidId) headers.set('x-reco-kid-id', ctx.kidId);
  if (ctx?.householdId) headers.set('x-reco-household-id', ctx.householdId);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip locale routing for PWA / icon files at the app root. Without
  // these exclusions the middleware redirects /icon1 → /he/icon1 (404
  // there — Next 16 auto-emits those files at root, not per-lang).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon0|icon1|apple-icon).*)',
  ],
};
