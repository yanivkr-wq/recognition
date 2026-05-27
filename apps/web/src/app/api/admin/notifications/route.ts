/**
 * GET /api/admin/notifications — live counts for the admin bell.
 *
 * Returns the household's pending approvals + redemptions + new feedback so
 * the bell badge can refresh by polling, without a full page reload. Gated to
 * the admin session (auth()); no kid principal can read it. Always dynamic +
 * no-store so the count is never stale-cached.
 */

import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getAdminNotificationCounts } from '../../../../lib/admin/notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const counts = await getAdminNotificationCounts(session.user.householdId);
  return NextResponse.json(counts, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
