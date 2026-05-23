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
            className="flex items-center gap-4 bg-card rounded-2xl shadow-card p-4"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
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
            <span className="font-bold text-ink flex-1">{k.name}</span>
            <div className="flex gap-2 text-xs">
              <Link
                href={`/${lang}/admin/kids/${k.id}/pin`}
                className="px-3 py-2 rounded-full bg-pink-pale text-pink-dark font-bold hover:bg-pink-soft transition"
              >
                {t.admin.setPin}
              </Link>
              <Link
                href={`/${lang}/admin/kids/${k.id}/devices`}
                className="px-3 py-2 rounded-full bg-sky-pale text-sky-dark font-bold hover:bg-sky-soft transition"
              >
                {t.admin.devices}
              </Link>
              <Link
                href={`/${lang}/admin/kids/${k.id}/ledger`}
                className="px-3 py-2 rounded-full bg-mint-pale text-mint-dark font-bold hover:bg-mint-soft transition"
              >
                {t.admin.ledger}
              </Link>
              <Link
                href={`/${lang}/admin/kids/${k.id}/wallet/adjust`}
                className="px-3 py-2 rounded-full bg-yellow-pale text-[#7A5D10] font-bold hover:opacity-80 transition"
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
