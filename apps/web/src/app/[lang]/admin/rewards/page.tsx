/**
 * Admin · reward catalog list.
 *
 * Lists every reward (active + archived) in the household. The interactive
 * parts — filter chips, bulk actions, image thumbnails — live in the client
 * RewardsAdmin component; this server page just fetches the rows and computes
 * the per-row image URL (uploaded files resolve via the session-gated route;
 * legacy external URLs stay direct).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, rewardItem } from '@reco/db';
import { auth } from '../../../../auth';
import { isExternalImageUrl } from '../../../../lib/reward-images/paths';
import { RewardsAdmin, type RewardRow } from './_components/rewards-admin';

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

  const mapped: RewardRow[] = rows.map((r) => ({
    id: r.id,
    title: lang === 'he' ? r.titleHe : r.titleEn,
    coinCost: r.coinCost,
    stockQuantity: r.stockQuantity,
    maxPerKidPerDay: r.maxPerKidPerDay,
    visibleToKids: r.visibleToKids,
    archived: r.archivedAt != null,
    iconKey: r.iconKey,
    color: r.color,
    imageUrl: r.imagePath
      ? isExternalImageUrl(r.imagePath)
        ? r.imagePath
        : `/api/reward-images/${r.id}`
      : null,
    hasDescription: Boolean(
      (lang === 'he' ? r.descriptionHe : r.descriptionEn)?.trim(),
    ),
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t.admin.rewardsHeading}</h1>
        <Link
          href={`/${lang}/admin/rewards/new`}
          className="btn-admin"
        >
          + {t.admin.newReward}
        </Link>
      </header>

      {mapped.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">—</p>
        </div>
      ) : (
        <RewardsAdmin lang={lang} t={t} rows={mapped} />
      )}
    </div>
  );
}
