/**
 * Admin · edit badge page.
 *
 * Same form as new, prefilled. The archive / unarchive button posts to
 * toggleArchiveBadgeAction directly — archiving hides the badge from new
 * campaigns while preserving any earned kid_badge history (FK restrict).
 */

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, badge } from '@reco/db';
import { auth } from '../../../../../../auth';
import { BadgeForm } from '../../_components/badge-form';
import { toggleArchiveBadgeAction } from '../../../../../../lib/admin-badges/actions';

export const dynamic = 'force-dynamic';

export default async function EditBadgePage({
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
    .from(badge)
    .where(and(eq(badge.id, id), eq(badge.householdId, session.user.householdId)))
    .limit(1);
  const b = rows[0];
  if (!b) redirect(`/${lang}/admin/badges`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.editBadge}</h1>
      <BadgeForm
        mode="edit"
        lang={lang as 'he' | 'en'}
        t={t}
        initial={{
          id: b.id,
          titleHe: b.titleHe,
          titleEn: b.titleEn,
          descriptionHe: b.descriptionHe,
          descriptionEn: b.descriptionEn,
          iconKey: b.iconKey,
          color: b.color,
          awardedVia: b.awardedVia,
          displayOrder: b.displayOrder,
        }}
      />
      <form action={toggleArchiveBadgeAction}>
        <input type="hidden" name="id" value={b.id} />
        <input type="hidden" name="lang" value={lang} />
        <button
          type="submit"
          className="text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {b.archivedAt ? t.admin.unarchive : t.admin.archive}
        </button>
      </form>
    </div>
  );
}
