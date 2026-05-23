/**
 * Trusted-devices list for a kid.
 *
 * Shows every non-revoked, non-expired `device_trust` row for the kid in
 * the parent's household. Each row has a "revoke" form that posts the
 * revoke server action. Revoking is a soft action (sets revoked_at); the
 * row persists in the audit trail.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable, deviceTrust } from '@reco/db';
import { auth } from '../../../../../../auth';
import { revokeDeviceForm } from './actions';

export const dynamic = 'force-dynamic';

function shortDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DevicesPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const kidRows = await getDb()
    .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
    .from(kidTable)
    .where(
      and(
        eq(kidTable.id, id),
        eq(kidTable.householdId, session.user.householdId),
        isNull(kidTable.archivedAt),
      ),
    )
    .limit(1);
  const k = kidRows[0];
  if (!k) redirect(`/${lang}/admin/kids`);

  const now = new Date();
  const devices = await getDb()
    .select({
      id: deviceTrust.id,
      deviceLabel: deviceTrust.deviceLabel,
      createdAt: deviceTrust.createdAt,
      lastSeenAt: deviceTrust.lastSeenAt,
    })
    .from(deviceTrust)
    .where(
      and(
        eq(deviceTrust.kidId, k.id),
        gt(deviceTrust.expiresAt, now),
        isNull(deviceTrust.revokedAt),
      ),
    )
    .orderBy(desc(deviceTrust.lastSeenAt));

  return (
    <div className="max-w-2xl space-y-6">
      <nav className="text-xs text-ink-soft">
        <Link href={`/${lang}/admin/kids`} className="hover:underline">
          {t.admin.kids}
        </Link>
        <span className="mx-2">·</span>
        <span className="text-ink">{k.name}</span>
      </nav>

      <header className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: k.color }}
          aria-hidden="true"
        >
          <span
            className="text-2xl font-bold text-card"
            style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          >
            {k.name.charAt(0)}
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">{t.admin.devices}</h1>
          <p className="text-sm text-ink-soft">{k.name}</p>
        </div>
      </header>

      {devices.length === 0 ? (
        <p className="text-sm text-ink-soft bg-card rounded-2xl shadow-card p-6 text-center">
          {t.admin.noDevices}
        </p>
      ) : (
        <ul className="space-y-3">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-4 bg-card rounded-2xl shadow-card p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink truncate">{d.deviceLabel}</p>
                <p className="text-xs text-ink-soft mt-1">
                  {t.admin.lastSeen}: <span dir="ltr">{shortDate(d.lastSeenAt)}</span>
                  <span className="mx-2">·</span>
                  {t.admin.added}: <span dir="ltr">{shortDate(d.createdAt)}</span>
                </p>
              </div>
              <form action={revokeDeviceForm}>
                <input type="hidden" name="deviceTrustId" value={d.id} />
                <input type="hidden" name="kidId" value={k.id} />
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-bold rounded-full bg-pink-pale text-pink-dark hover:bg-pink-soft transition"
                >
                  {t.admin.revoke}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
