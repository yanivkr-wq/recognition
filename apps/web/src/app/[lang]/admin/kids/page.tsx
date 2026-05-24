/**
 * Kids list — Phase 2 admin surface.
 *
 * Lists every non-archived kid in the household with two action links: set/
 * reset PIN and manage trusted devices. Both links land on per-kid pages
 * that hash + UPDATE through server actions.
 */

import Link from 'next/link';
import { eq, isNull, and } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable } from '@reco/db';
import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminKidsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const kids = await getDb()
    .select({
      id: kidTable.id,
      name: kidTable.name,
      slug: kidTable.slug,
      color: kidTable.color,
    })
    .from(kidTable)
    .where(
      and(eq(kidTable.householdId, session.user.householdId), isNull(kidTable.archivedAt)),
    )
    .orderBy(kidTable.createdAt);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.kids}</h1>

      <ul className="space-y-3">
        {kids.map((k) => (
          <li
            key={k.id}
            className="bg-card rounded-2xl shadow-card p-4 space-y-3"
          >
            {/* Identity row */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
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
              <span className="font-bold text-ink text-lg flex-1 min-w-0 truncate">{k.name}</span>
            </div>

            {/* Actions — responsive grid so the chips never overflow on a
                phone: 2 per row on mobile, more as the viewport widens. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              <Link
                href={`/${lang}/admin/kids/${k.id}/tasks`}
                className="text-center px-3 py-2.5 rounded-xl bg-lavender-pale text-lavender-dark font-bold hover:opacity-80 transition"
              >
                {t.admin.tasks}
              </Link>
              <Link
                href={`/${lang}/admin/kids/${k.id}/pin`}
                className="text-center px-3 py-2.5 rounded-xl bg-pink-pale text-pink-dark font-bold hover:bg-pink-soft transition"
              >
                {t.admin.setPin}
              </Link>
              <Link
                href={`/${lang}/admin/kids/${k.id}/devices`}
                className="text-center px-3 py-2.5 rounded-xl bg-sky-pale text-sky-dark font-bold hover:bg-sky-soft transition"
              >
                {t.admin.devices}
              </Link>
              <Link
                href={`/${lang}/admin/kids/${k.id}/ledger`}
                className="text-center px-3 py-2.5 rounded-xl bg-mint-pale text-mint-dark font-bold hover:bg-mint-soft transition"
              >
                {t.admin.ledger}
              </Link>
              <Link
                href={`/${lang}/admin/kids/${k.id}/wallet/adjust`}
                className="text-center px-3 py-2.5 rounded-xl bg-yellow-pale text-[#7A5D10] font-bold hover:opacity-80 transition"
              >
                {t.admin.joker}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
