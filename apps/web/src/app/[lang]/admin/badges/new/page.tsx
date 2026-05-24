/**
 * Admin · new badge page.
 *
 * Brand-fresh defaults: lavender emblem (em-star), lavender color (campaigns /
 * long-term semantic per BRANDBOOK §2), awarded via campaign.
 */

import { redirect } from 'next/navigation';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { auth } from '../../../../../auth';
import { BadgeForm } from '../_components/badge-form';

export default async function NewBadgePage({
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
      <h1 className="text-2xl font-bold text-ink">{t.admin.newBadge}</h1>
      <BadgeForm
        mode="create"
        lang={lang as 'he' | 'en'}
        t={t}
        initial={{
          titleHe: '',
          titleEn: '',
          descriptionHe: null,
          descriptionEn: null,
          iconKey: 'em-star',
          color: '#B59FE5',
          awardedVia: 'campaign',
          displayOrder: 50,
        }}
      />
    </div>
  );
}
