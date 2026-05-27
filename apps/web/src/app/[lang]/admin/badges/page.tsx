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

  const active = rows.filter((b) => b.archivedAt == null);
  const archived = rows.filter((b) => b.archivedAt != null);

  const renderRow = (b: (typeof rows)[number]) => {
    const title = lang === 'he' ? b.titleHe : b.titleEn;
    const description = lang === 'he' ? b.descriptionHe : b.descriptionEn;
    const isArchived = b.archivedAt != null;
    return (
      <li
        key={b.id}
        className={`bg-card rounded-2xl shadow-card border border-rule p-4 flex items-start gap-3 ${
          isArchived ? 'opacity-50' : ''
        }`}
      >
        <div className="shrink-0">
          <BadgeEmblem
            iconKey={b.iconKey}
            color={b.color}
            title={title}
            imageUrl={
              b.imagePath
                ? `/api/badge-images/${b.id}?v=${(b.imagePath.split('/').pop() ?? '').split('.')[0]}`
                : null
            }
            size={52}
          />
        </div>
        {/* Full title + description wrap instead of truncating, so the whole
            award text is readable on a phone. */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink leading-snug break-words">{title}</p>
          {description && (
            <p className="text-xs text-ink-soft break-words mt-0.5">{description}</p>
          )}
        </div>
        <Link
          href={`/${lang}/admin/badges/${b.id}/edit`}
          className="text-xs text-pink-dark underline-offset-2 hover:underline font-bold shrink-0 py-1"
        >
          {t.common.edit}
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t.admin.badgesHeading}</h1>
        <Link
          href={`/${lang}/admin/badges/new`}
          className="btn-admin shrink-0"
        >
          + {t.admin.newBadge}
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-6 text-center">
          <p className="font-bold text-ink">{t.admin.noBadges}</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={t.admin.sectionActive} count={active.length} />
              <ul className="space-y-3">{active.map(renderRow)}</ul>
            </section>
          )}
          {archived.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={t.admin.sectionArchived} count={archived.length} />
              <ul className="space-y-3">{archived.map(renderRow)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Small divider label between the active + archived groups on admin lists. */
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
      {label}{' '}
      <span className="num text-ink-faded" dir="ltr">
        ({count})
      </span>
    </h2>
  );
}
