/**
 * Server action — revoke a trusted device.
 *
 * Idempotent: setting revoked_at on an already-revoked row is a no-op. We
 * verify the device row belongs to the parent's household before touching
 * it. Logs to audit_log so the other parent sees the revoke.
 */

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDb, deviceTrust, auditLog } from '@reco/db';
import { auth } from '../../../../../../auth';

export async function revokeDeviceForm(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect('/');

  const deviceTrustId = String(formData.get('deviceTrustId') ?? '');
  const kidId = String(formData.get('kidId') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!deviceTrustId || !kidId) redirect(`/${lang}/admin/kids`);

  const db = getDb();
  const rows = await db
    .select({ id: deviceTrust.id, householdId: deviceTrust.householdId })
    .from(deviceTrust)
    .where(
      and(
        eq(deviceTrust.id, deviceTrustId),
        eq(deviceTrust.householdId, session.user.householdId),
      ),
    )
    .limit(1);
  if (!rows[0]) redirect(`/${lang}/admin/kids/${kidId}/devices`);

  await db
    .update(deviceTrust)
    .set({ revokedAt: new Date() })
    .where(eq(deviceTrust.id, deviceTrustId));

  const hdrs = await headers();
  await db.insert(auditLog).values({
    householdId: session.user.householdId,
    actorUserId: session.user.id,
    action: 'device_trust.revoke',
    targetKind: 'device_trust',
    targetId: deviceTrustId,
    requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: hdrs.get('user-agent') ?? null,
  });

  redirect(`/${lang}/admin/kids/${kidId}/devices`);
}
