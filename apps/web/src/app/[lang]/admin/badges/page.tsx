/**
 * Admin · badge catalog list.
 *
 * Lists every badge (active + archived) in the household. Each row links to
 * edit and feeds the campaign badge picker. Archived rows are muted. The
 * emblem renders as the placeholder Patch (pastel ring + initial) until the
 * family-3 SVGs land — same as the kid badge page.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, badge } from '@reco/db';
import { auth } from '../../../../auth';
import { BadgeEmblem } from '../../../../components/badge-emblem';

export const dynamic = 'force-dynamic';

export default async function AdminBadgesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const rows = await getDb()
    .select()
    .from(badge)
    .where(eq(badge.householdId, session.user.householdId))
    .orderBy(asc(badge.displayOrder), desc(badge.createdAt));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t.admin.badgesHeading}</h1>
        <Link
          href={`/${lang}/admin/badges/new`}
          className="bg-pink text-card font-bold rounded-full py-2 px-4 text-sm shadow-cta-pink hover:-translate-y-px transition shrink-0"
        >
          + {t.admin.newBadge}
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-6 text-center">
          <p className="font-bold text-ink">{t.admin.noBadges}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => {
            const title = lang === 'he' ? b.titleHe : b.titleEn;
            const description = lang === 'he' ? b.descriptionHe : b.descriptionEn;
            const archived = b.archivedAt != null;
            return (
              <li
                key={b.id}
                className={`bg-card rounded-2xl shadow-card border border-rule p-4 flex items-center gap-3 ${
                  archived ? 'opacity-50' : ''
                }`}
              >
                <div className="shrink-0">
                  <BadgeEmblem
                    iconKey={b.iconKey}
                    color={b.color}
                    title={title}
                    imageUrl={b.imagePath ? `/api/badge-images/${b.id}` : null}
                    size={52}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink truncate">{title}</p>
                  <p className="text-xs text-ink-soft truncate">
                    {description}
                    {archived && (
                      <span className="ms-2 inline-block text-[10px] uppercase tracking-wider text-ink-faded">
                        {t.admin.archived}
                      </span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/${lang}/admin/badges/${b.id}/edit`}
                  className="text-xs text-pink-dark underline-offset-2 hover:underline font-bold shrink-0"
                >
                  {t.common.edit}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
