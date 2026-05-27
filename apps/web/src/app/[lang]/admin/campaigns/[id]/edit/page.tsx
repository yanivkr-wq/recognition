/**
 * Admin · edit campaign page.
 *
 * Prefills the shared CampaignForm in edit mode. Loads the same option lists
 * as /new (kids, non-archived templates, badges) PLUS the campaign's current
 * field values, its feeding-task template ids, and its enrolled kid ids so
 * the form can show what's selected. Kind + enrolled kids are immutable here
 * (see updateCampaignAction); the form renders them read-only.
 */

import { redirect } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  kid as kidTable,
  taskTemplate,
  badge as badgeTable,
  campaign as campaignTable,
  campaignFeedingTask,
  campaignEnrollment,
} from '@reco/db';
import { auth } from '../../../../../../auth';
import { CampaignForm } from '../../_components/campaign-form';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);
  const householdId = session.user.householdId;

  const db = getDb();
  const campRows = await db
    .select()
    .from(campaignTable)
    .where(and(eq(campaignTable.id, id), eq(campaignTable.householdId, householdId)))
    .limit(1);
  const c = campRows[0];
  if (!c) redirect(`/${lang}/admin/campaigns`);

  const [kids, templates, badges, feeding, enrollments] = await Promise.all([
    db
      .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
      .from(kidTable)
      .where(and(eq(kidTable.householdId, householdId), isNull(kidTable.archivedAt)))
      .orderBy(asc(kidTable.name)),
    db
      .select({
        id: taskTemplate.id,
        titleHe: taskTemplate.titleHe,
        titleEn: taskTemplate.titleEn,
        kind: taskTemplate.kind,
      })
      .from(taskTemplate)
      .where(and(eq(taskTemplate.householdId, householdId), isNull(taskTemplate.archivedAt)))
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
      .where(and(eq(badgeTable.householdId, householdId), isNull(badgeTable.archivedAt)))
      .orderBy(asc(badgeTable.displayOrder)),
    db
      .select({ templateId: campaignFeedingTask.templateId })
      .from(campaignFeedingTask)
      .where(eq(campaignFeedingTask.campaignId, id)),
    db
      .select({ kidId: campaignEnrollment.kidId })
      .from(campaignEnrollment)
      .where(eq(campaignEnrollment.campaignId, id)),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.editCampaign}</h1>
      <CampaignForm
        mode="edit"
        lang={lang as 'he' | 'en'}
        t={t}
        defaults={{ startDate: c.startDate, endDate: c.endDate }}
        kids={kids}
        templates={templates}
        badges={badges}
        initial={{
          id: c.id,
          titleHe: c.titleHe,
          titleEn: c.titleEn,
          descriptionHe: c.descriptionHe,
          descriptionEn: c.descriptionEn,
          kind: c.kind,
          startDate: c.startDate,
          endDate: c.endDate,
          bonusCoins: c.bonusCoins,
          badgeId: c.badgeId,
          streakTargetDays: c.streakTargetDays,
          streakFreezesAllowed: c.streakFreezesAllowed,
          streakPerDayThreshold: c.streakPerDayThreshold,
          totalTargetQuantity: c.totalTargetQuantity,
          measureUnit: c.measureUnit,
          feedingTemplateIds: feeding.map((f) => f.templateId),
          enrolledKidIds: enrollments.map((e) => e.kidId),
        }}
      />
    </div>
  );
}
