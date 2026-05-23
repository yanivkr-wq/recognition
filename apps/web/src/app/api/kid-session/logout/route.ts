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
  const res = NextResponse.redirect(new URL(`/${locale}/pick`, req.url), { status: 303 });
  res.headers.append('Set-Cookie', clearKidSessionCookieHeader());
  return res;
}
