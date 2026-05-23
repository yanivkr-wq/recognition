/**
 * Kid · active campaigns view.
 *
 * Reads from campaign_enrollment + campaign for the logged-in kid; renders
 * a card per active (completed_at IS NULL) enrollment with progress in
 * the natural unit (streak chain X/N days, total quantity X/N units).
 * Below: a separate section for recently completed campaigns.
 *
 * The progress numbers come from the engine cache fields (current_streak,
 * current_total, freezes_used) — the on-completion hook + daily-reset cron
 * keep them fresh. For a truly up-to-the-second view we could re-derive
 * via evaluateStreak/Total per render, but the cache is consistent enough
 * for the kid surface (it lags by at most one completion event).
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  kid as kidTable,
  campaign as campaignTable,
  campaignEnrollment,
  badge as badgeTable,
} from '@reco/db';
import { KidCampaigns, type KidCampaign } from './_components/kid-campaigns';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const hdrs = await headers();
  const principal = hdrs.get('x-reco-principal');

  if (principal !== 'kid') {
    redirect(`/${lang}/admin/campaigns`);
  }
  const kidId = hdrs.get('x-reco-kid-id');
  if (!kidId) redirect(`/${lang}/pick`);

  const db = getDb();
  const kRows = await db
    .select({ name: kidTable.name, color: kidTable.color, avatarKey: kidTable.avatarKey })
    .from(kidTable)
    .where(and(eq(kidTable.id, kidId), isNull(kidTable.archivedAt)))
    .limit(1);
  const k = kRows[0];
  if (!k) redirect(`/${lang}/pick`);

  const rows = await db
    .select({
      enrollmentId: campaignEnrollment.id,
      campaignId: campaignTable.id,
      titleHe: campaignTable.titleHe,
      titleEn: campaignTable.titleEn,
      kind: campaignTable.kind,
      startDate: campaignTable.startDate,
      endDate: campaignTable.endDate,
      bonusCoins: campaignTable.bonusCoins,
      streakTargetDays: campaignTable.streakTargetDays,
      streakFreezesAllowed: campaignTable.streakFreezesAllowed,
      totalTargetQuantity: campaignTable.totalTargetQuantity,
      currentStreak: campaignEnrollment.currentStreak,
      freezesUsed: campaignEnrollment.freezesUsed,
      currentTotal: campaignEnrollment.currentTotal,
      completedAt: campaignEnrollment.completedAt,
      completedKind: campaignEnrollment.completedKind,
      // Phase 7 polish: show the kid the badge they're working toward.
      // LEFT JOIN — campaigns without a badge_id stay in the result.
      badgeId: badgeTable.id,
      badgeTitleHe: badgeTable.titleHe,
      badgeTitleEn: badgeTable.titleEn,
      badgeIconKey: badgeTable.iconKey,
      badgeColor: badgeTable.color,
    })
    .from(campaignEnrollment)
    .innerJoin(campaignTable, eq(campaignTable.id, campaignEnrollment.campaignId))
    .leftJoin(badgeTable, eq(badgeTable.id, campaignTable.badgeId))
    .where(
      and(eq(campaignEnrollment.kidId, kidId), isNull(campaignTable.archivedAt)),
    )
    .orderBy(desc(campaignTable.startDate));

  const campaigns: KidCampaign[] = rows.map((r) => ({
    enrollmentId: r.enrollmentId,
    campaignId: r.campaignId,
    titleHe: r.titleHe,
    titleEn: r.titleEn,
    kind: r.kind,
    startDate: r.startDate,
    endDate: r.endDate,
    bonusCoins: r.bonusCoins,
    streakTargetDays: r.streakTargetDays,
    streakFreezesAllowed: r.streakFreezesAllowed,
    totalTargetQuantity: r.totalTargetQuantity,
    currentStreak: r.currentStreak,
    freezesUsed: r.freezesUsed,
    currentTotal: r.currentTotal,
    completedAt: r.completedAt?.toISOString() ?? null,
    completedKind: r.completedKind,
    badgeId: r.badgeId,
    badgeTitleHe: r.badgeTitleHe,
    badgeTitleEn: r.badgeTitleEn,
    badgeIconKey: r.badgeIconKey,
    badgeColor: r.badgeColor,
  }));

  return (
    <KidCampaigns
      lang={lang as 'he' | 'en'}
      t={t}
      kidName={k.name}
      kidColor={k.color}
      kidAvatarKey={k.avatarKey}
      campaigns={campaigns}
      homeHref={`/${lang}`}
      badgesHref={`/${lang}/badges`}
    />
  );
}
