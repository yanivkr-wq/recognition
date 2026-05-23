/**
 * POST /api/kid-session/logout
 *
 * Clears the kid-session cookie but PRESERVES the kid-trust cookie — so a
 * "switch user" tap drops the kid back to /[lang]/pick where their face-card
 * is still tappable without re-entering PIN (BUILD-PLAN.md Phase 2 task 9).
 * To fully forget a device an admin revokes the trust row from
 * /admin/kids/<id>/devices.
 *
 * Node-runtime: simpler than route-handler edge here, and revocation is rare.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { clearKidSessionCookieHeader } from '../../../../lib/kid-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const locale = req.headers.get('x-reco-locale') ?? 'he';
  // Use a relative Location so the browser resolves against the public URL
  // it is currently on. NextResponse.redirect(new URL(..., req.url)) would
  // serialize an absolute URL using req.url's origin, and behind the Caddy
  // reverse proxy req.url's origin is `http://0.0.0.0:3030` (Node's bind
  // address) — landing the kid on an unreachable URL. Relative path avoids
  // having to trust forwarded headers.
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: `/${locale}/pick` },
  });
  res.headers.append('Set-Cookie', clearKidSessionCookieHeader());
  return res;
}
