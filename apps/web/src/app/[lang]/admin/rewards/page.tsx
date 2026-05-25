/**
 * Admin · reward catalog list.
 *
 * Lists every reward (active + archived) in the household. Each row links
 * to edit. Archived rows visually muted; hiding from kids is a separate
 * toggle (`visible_to_kids`) — surfaced as a small pill so the admin can
 * stage a reward before letting kids see it.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, rewardItem } from '@reco/db';
import { auth } from '../../../../auth';
import { Coin } from '../../../../components/coin';
import { RewardIcon } from '../../../../components/reward-icon';

export const dynamic = 'force-dynamic';

export default async function AdminRewardsPage({
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
    .from(rewardItem)
    .where(eq(rewardItem.householdId, session.user.householdId))
    .orderBy(rewardItem.displayOrder, desc(rewardItem.createdAt));

  const active = rows.filter((r) => r.archivedAt == null);
  const archived = rows.filter((r) => r.archivedAt != null);

  const renderRow = (r: (typeof rows)[number]) => {
    const title = lang === 'he' ? r.titleHe : r.titleEn;
    const isArchived = r.archivedAt != null;
    return (
      <li
        key={r.id}
        className={`bg-card rounded-2xl shadow-card border border-rule p-4 flex items-center gap-3 ${
          isArchived ? 'opacity-50' : ''
        }`}
      >
        <RewardIcon iconKey={r.iconKey} color={r.color} title={title} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink truncate">{title}</p>
          <p className="text-xs text-ink-soft truncate">
            {r.stockQuantity === null
              ? t.admin.stockUnlimited
              : `${t.admin.stockQuantity.split(' (')[0]}: ${r.stockQuantity}`}
            {r.maxPerKidPerDay !== null && (
              <span> · {r.maxPerKidPerDay} {t.redeem.perDayLimit}</span>
            )}
            {!r.visibleToKids && (
              <span className="ms-2 inline-block text-[10px] uppercase tracking-wider text-pink-dark">
                hidden
              </span>
            )}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-xs font-bold num">
          <Coin size={14} />
          <span dir="ltr">{r.coinCost}</span>
        </span>
        <Link
          href={`/${lang}/admin/rewards/${r.id}/edit`}
          className="text-xs text-pink-dark underline-offset-2 hover:underline font-bold"
        >
          {t.common.edit}
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t.admin.rewardsHeading}</h1>
        <Link
          href={`/${lang}/admin/rewards/new`}
          className="bg-pink text-card font-bold rounded-full py-2 px-4 text-sm shadow-cta-pink hover:-translate-y-px transition"
        >
          + {t.admin.newReward}
        </Link>
      </header>

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
