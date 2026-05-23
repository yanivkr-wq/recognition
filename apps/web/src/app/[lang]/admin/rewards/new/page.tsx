/**
 * Admin · new reward page.
 *
 * Brand-fresh defaults: pink-soft tile, 1 coin cost, unlimited stock + cap.
 * Iconkey defaults to `rw-candy` so the kid shop preview shows something
 * recognizable until the SVG library lands in Phase 9.
 */

import { redirect } from 'next/navigation';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { auth } from '../../../../../auth';
import { RewardForm } from '../_components/reward-form';

export default async function NewRewardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.newReward}</h1>
      <RewardForm
        mode="create"
        lang={lang as 'he' | 'en'}
        t={t}
        initial={{
          titleHe: '',
          titleEn: '',
          descriptionHe: null,
          descriptionEn: null,
          iconKey: 'rw-candy',
          color: '#FFF0F6',
          coinCost: 1,
          stockQuantity: null,
          maxPerKidPerDay: null,
          displayOrder: 50,
          visibleToKids: true,
        }}
      />
    </div>
  );
}
