/**
 * Kid · active campaigns view.
 *
 * Reads from campaign_enrollment + campaign for the logged-in kid; renders
 * a card per active (completed_at IS NULL) enrollment with progress in
 * the natural unit (streak chain X/N days, total quantity X/N units).
 * Below: a separate section for recently completed campaigns.
 *
 * The progress numbers are re-derived live per render via evaluateStreak /
 * evaluateTotal (ledger- + completion-derived) rather than read from the
 * engine cache fields. The cache (current_streak/current_total) can lag if a
 * completion's campaign fan-out ever fails to land, so for the kid-facing
 * view we recompute from source of truth — the engines only SELECT, so this
 * is a couple of cheap read queries per active enrollment.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  evaluateStreak,
  evaluateTotal,
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
      badgeImagePath: badgeTable.imagePath,
    })
    .from(campaignEnrollment)
    .innerJoin(campaignTable, eq(campaignTable.id, campaignEnrollment.campaignId))
    .leftJoin(badgeTable, eq(badgeTable.id, campaignTable.badgeId))
    .where(
      and(eq(campaignEnrollment.kidId, kidId), isNull(campaignTable.archivedAt)),
    )
    .orderBy(desc(campaignTable.startDate));

  // Re-derive progress for ACTIVE enrollments from source of truth. Completed
  // enrollments keep their cached final numbers (the engine would report the
  // same, and re-running it for done campaigns is wasted work). One pooled
  // client services every enrollment; the engines are read-only SELECTs.
  const client = await getPool().connect();
  let todayIl: string;
  const liveStreak = new Map<string, { currentStreak: number; freezesUsed: number }>();
  const liveTotal = new Map<string, number>();
  try {
    const todayRes = await client.query<{ today: string }>(
      `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text AS today`,
    );
    todayIl = todayRes.rows[0]!.today;
    for (const r of rows) {
      if (r.completedAt != null) continue;
      if (r.kind === 'streak') {
        const res = await evaluateStreak(client, {
          kidId,
          campaignId: r.campaignId,
          asOfDate: todayIl,
        });
        liveStreak.set(r.enrollmentId, {
          currentStreak: res.currentStreak,
          freezesUsed: res.freezesUsed,
        });
      } else {
        const res = await evaluateTotal(client, {
          kidId,
          campaignId: r.campaignId,
          asOfDate: todayIl,
        });
        liveTotal.set(r.enrollmentId, res.currentTotal);
      }
    }
  } finally {
    client.release();
  }

  const campaigns: KidCampaign[] = rows.map((r) => {
    const ls = liveStreak.get(r.enrollmentId);
    const lt = liveTotal.get(r.enrollmentId);
    return {
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
      currentStreak: ls?.currentStreak ?? r.currentStreak,
      freezesUsed: ls?.freezesUsed ?? r.freezesUsed,
      currentTotal: lt ?? r.currentTotal,
      completedAt: r.completedAt?.toISOString() ?? null,
      completedKind: r.completedKind,
      badgeId: r.badgeId,
      badgeTitleHe: r.badgeTitleHe,
      badgeTitleEn: r.badgeTitleEn,
      badgeIconKey: r.badgeIconKey,
      badgeColor: r.badgeColor,
      badgeImageUrl:
        r.badgeId && r.badgeImagePath
          ? `/api/badge-images/${r.badgeId}?v=${(r.badgeImagePath.split('/').pop() ?? '').split('.')[0]}`
          : null,
    };
  });

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
