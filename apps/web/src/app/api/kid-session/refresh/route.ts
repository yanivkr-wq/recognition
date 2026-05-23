/**
 * GET /api/kid-session/refresh?to=<dest>
 *
 * Used by middleware when a kid-trust cookie is present but the kid-session
 * JWT is missing or expired. Verifies the trust token against device_trust
 * (DB lookup → can't happen in edge middleware), and on match issues a
 * fresh kid-session JWT and redirects the browser to `?to`. On any failure
 * we clear the trust cookie and bounce to /[lang]/pick so the kid is sent
 * through a real PIN entry.
 *
 * Node-runtime: needs pg + node:crypto.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  KID_TRUST_COOKIE,
  clearKidTrustCookieHeader,
  setKidSessionCookieHeader,
} from '../../../../lib/kid-auth';
import { verifyDeviceTrust } from '../../../../lib/kid-auth/device-trust';
import { computeDeviceFingerprint } from '../../../../lib/kid-auth/fingerprint';
import { issueKidSession } from '../../../../lib/kid-auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeTo(rawTo: string | null, locale: string): string {
  if (!rawTo || !rawTo.startsWith('/')) return `/${locale}/`;
  // Don't bounce back to refresh itself, or to non-app URLs.
  if (rawTo.startsWith('/api/kid-session/refresh')) return `/${locale}/`;
  return rawTo;
}

export async function GET(req: NextRequest): Promise<Response> {
  const locale = req.headers.get('x-reco-locale') ?? 'he';
  const dest = safeTo(req.nextUrl.searchParams.get('to'), locale);
  // Use relative Location strings; browser resolves against the public URL
  // it's currently on. Avoids the `req.url` → `http://0.0.0.0:3030/...`
  // trap when running behind a reverse proxy (Caddy → Docker bind addr).
  const pickPath = `/${locale}/pick`;
  const redirectRel = (location: string): NextResponse =>
    new NextResponse(null, { status: 307, headers: { Location: location } });

  const trustToken = req.cookies.get(KID_TRUST_COOKIE)?.value;
  if (!trustToken) {
    return redirectRel(pickPath);
  }

  const fp = await computeDeviceFingerprint(req.headers);
  const verified = await verifyDeviceTrust({ rawToken: trustToken, userAgentFp: fp });
  if (!verified) {
    const res = redirectRel(pickPath);
    res.headers.append('Set-Cookie', clearKidTrustCookieHeader());
    return res;
  }

  const token = await issueKidSession({
    id: verified.kidId,
    householdId: verified.householdId,
  });
  const res = redirectRel(dest);
  res.headers.append('Set-Cookie', setKidSessionCookieHeader(token));
  return res;
}
