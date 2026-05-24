/**
 * Admin · new campaign page.
 *
 * Server-fetches the candidate feeding tasks (non-archived templates) + the
 * non-archived kids + the badges so the form can render its multi-selects
 * + dropdown. Defaults: start_date = today (IL), end_date = +7 days,
 * streak target 5 days / 1 freeze, total target 30, bonus 50 coins.
 */

import { redirect } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  kid as kidTable,
  taskTemplate,
  badge as badgeTable,
} from '@reco/db';
import { auth } from '../../../../../auth';
import { CampaignForm } from '../_components/campaign-form';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const db = getDb();
  const [kids, templates, badges] = await Promise.all([
    db
      .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
      .from(kidTable)
      .where(
        and(eq(kidTable.householdId, session.user.householdId), isNull(kidTable.archivedAt)),
      )
      .orderBy(asc(kidTable.name)),
    db
      .select({
        id: taskTemplate.id,
        titleHe: taskTemplate.titleHe,
        titleEn: taskTemplate.titleEn,
        kind: taskTemplate.kind,
      })
      .from(taskTemplate)
      .where(
        and(
          eq(taskTemplate.householdId, session.user.householdId),
          isNull(taskTemplate.archivedAt),
        ),
      )
      .orderBy(asc(taskTemplate.displayOrder)),
    db
      .select({
        id: badgeTable.id,
        titleHe: badgeTable.titleHe,
        titleEn: badgeTable.titleEn,
        iconKey: badgeTable.iconKey,
        color: badgeTable.color,
      })
      .from(badgeTable)
      .where(
        and(eq(badgeTable.householdId, session.user.householdId), isNull(badgeTable.archivedAt)),
      )
      .orderBy(asc(badgeTable.displayOrder)),
  ]);

  // Defaults: today + 7 in IL.
  const dateRes = await getPool().query<{ today: string; week: string }>(
    `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text AS today,
            ((now() AT TIME ZONE 'Asia/Jerusalem')::date + 7)::text AS week`,
  );
  const today = dateRes.rows[0]!.today;
  const week = dateRes.rows[0]!.week;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.newCampaign}</h1>
      <CampaignForm
        mode="create"
        lang={lang as 'he' | 'en'}
        t={t}
        defaults={{
          startDate: today,
          endDate: week,
        }}
        kids={kids}
        templates={templates}
        badges={badges}
      />
    </div>
  );
}
