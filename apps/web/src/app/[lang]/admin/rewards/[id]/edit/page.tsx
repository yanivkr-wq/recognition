/**
 * Admin · edit reward page.
 *
 * Same form as new, prefilled. The archive / unarchive button posts to
 * toggleArchiveRewardAction directly via a one-off form action — no
 * useActionState needed because we don't render an inline error.
 */

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, rewardItem } from '@reco/db';
import { auth } from '../../../../../../auth';
import { RewardForm } from '../../_components/reward-form';
import { toggleArchiveRewardAction } from '../../../../../../lib/admin-rewards/actions';
import { isExternalImageUrl } from '../../../../../../lib/reward-images/paths';

export const dynamic = 'force-dynamic';

export default async function EditRewardPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const rows = await getDb()
    .select()
    .from(rewardItem)
    .where(and(eq(rewardItem.id, id), eq(rewardItem.householdId, session.user.householdId)))
    .limit(1);
  const r = rows[0];
  if (!r) redirect(`/${lang}/admin/rewards`);

  // Legacy demo URLs (Unsplash) stay direct; uploaded files resolve through
  // the session-gated API route so the URL stays stable even if the file is
  // replaced. NULL stays NULL.
  const currentImageUrl = r.imagePath
    ? isExternalImageUrl(r.imagePath)
      ? r.imagePath
      : `/api/reward-images/${r.id}`
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.editReward}</h1>
      <RewardForm
        mode="edit"
        lang={lang as 'he' | 'en'}
        t={t}
        initial={{
          id: r.id,
          titleHe: r.titleHe,
          titleEn: r.titleEn,
          descriptionHe: r.descriptionHe,
          descriptionEn: r.descriptionEn,
          iconKey: r.iconKey,
          color: r.color,
          coinCost: r.coinCost,
          stockQuantity: r.stockQuantity,
          maxPerKidPerDay: r.maxPerKidPerDay,
          displayOrder: r.displayOrder,
          visibleToKids: r.visibleToKids,
          currentImageUrl,
        }}
      />
      <form action={toggleArchiveRewardAction}>
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="lang" value={lang} />
        <button
          type="submit"
          className="text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {r.archivedAt ? t.admin.unarchive : t.admin.archive}
        </button>
      </form>
    </div>
  );
}
