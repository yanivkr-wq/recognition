/**
 * Admin · campaigns list.
 *
 * Active + archived in one list, sorted by start_date DESC. Each row shows
 * kind chip (streak/total), date window, bonus + badge, count of enrolled
 * kids, link to edit/archive. The "+ New" CTA opens the create form.
 *
 * Each row links to the edit form (title/dates/bonus/badge/targets/feeding
 * tasks; kind + enrolled kids are immutable) and has an archive toggle.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  campaign as campaignTable,
  campaignEnrollment,
} from '@reco/db';
import { auth } from '../../../../auth';
import { toggleArchiveCampaignAction } from '../../../../lib/admin-campaigns/actions';

export const dynamic = 'force-dynamic';

export default async function AdminCampaignsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  // List with enrollment count via subquery aggregate.
  const rows = await getDb()
    .select({
      id: campaignTable.id,
      titleHe: campaignTable.titleHe,
      titleEn: campaignTable.titleEn,
      kind: campaignTable.kind,
      startDate: campaignTable.startDate,
      endDate: campaignTable.endDate,
      bonusCoins: campaignTable.bonusCoins,
      streakTargetDays: campaignTable.streakTargetDays,
      totalTargetQuantity: campaignTable.totalTargetQuantity,
      archivedAt: campaignTable.archivedAt,
      enrolledCount: sql<number>`(SELECT count(*)::int FROM ${campaignEnrollment} ce WHERE ce.campaign_id = ${campaignTable.id})`,
    })
    .from(campaignTable)
    .where(eq(campaignTable.householdId, session.user.householdId))
    .orderBy(desc(campaignTable.startDate));

  const active = rows.filter((c) => c.archivedAt == null);
  const archived = rows.filter((c) => c.archivedAt != null);

  const renderRow = (c: (typeof rows)[number]) => {
    const title = lang === 'he' ? c.titleHe : c.titleEn;
    const isArchived = c.archivedAt != null;
    const targetLabel =
      c.kind === 'streak'
        ? `${c.streakTargetDays} ${t.campaign.targetDays}`
        : `${c.totalTargetQuantity} ${t.campaign.targetTotal}`;
    return (
      <li
        key={c.id}
        className={`bg-card rounded-2xl shadow-card border border-rule p-4 ${
          isArchived ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
              c.kind === 'streak'
                ? 'bg-mint-pale text-mint-dark'
                : 'bg-lavender-pale text-lavender-dark'
            }`}
          >
            {c.kind === 'streak'
              ? t.admin.campaignKindStreak
              : t.admin.campaignKindTotal}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-ink break-words leading-snug">{title}</p>
            <p className="text-xs text-ink-soft mt-1 break-words">
              <span dir="ltr" className="num">
                {c.startDate} → {c.endDate}
              </span>
              {' · '}
              {targetLabel}
              {' · '}
              <span className="num" dir="ltr">{c.enrolledCount}</span> {t.admin.enrolledKids}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-xs font-bold num">
            +<span dir="ltr">{c.bonusCoins}</span>
          </span>
        </div>
        <div className="flex justify-end items-center gap-4 mt-3 pt-3 border-t border-rule">
          <Link
            href={`/${lang}/admin/campaigns/${c.id}/edit`}
            className="text-xs text-pink-dark underline-offset-2 hover:underline font-bold"
          >
            {t.common.edit}
          </Link>
          <form action={toggleArchiveCampaignAction}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="lang" value={lang} />
            <button
              type="submit"
              className="text-xs text-ink-soft underline-offset-2 hover:underline font-bold"
            >
              {isArchived ? t.admin.unarchive : t.admin.archive}
            </button>
          </form>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t.admin.campaignsHeading}</h1>
        <Link
          href={`/${lang}/admin/campaigns/new`}
          className="btn-admin"
        >
          + {t.admin.newCampaign}
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">{t.campaign.noActive}</p>
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
