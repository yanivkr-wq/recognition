/**
 * Kid · badge collection.
 *
 * Two sections:
 *   1. Earned (kid_badge rows for this kid, newest first).
 *   2. Locked-but-visible — badges associated with the kid's ACTIVE
 *      campaign enrollments that aren't earned yet. The kid sees what
 *      they're working toward.
 *
 * Brandbook §5 Embroidered Patch is the visual idiom. The placeholder
 * here renders a pastel-tile + emoji-stand-in until the family-3 SVG
 * library lands (Phase 9). The dashed-border + count-chip details from
 * §5.1 will follow.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, desc, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  kid as kidTable,
  badge as badgeTable,
  kidBadge,
  campaign as campaignTable,
  campaignEnrollment,
} from '@reco/db';
import { KidBadges, type EarnedBadge, type LockedBadge } from './_components/kid-badges';

export const dynamic = 'force-dynamic';

export default async function BadgesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const hdrs = await headers();
  const principal = hdrs.get('x-reco-principal');
  if (principal !== 'kid') redirect(`/${lang}`);
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

  const earnedRows = await db
    .select({
      id: kidBadge.id,
      awardedAt: kidBadge.awardedAt,
      awardedForYear: kidBadge.awardedForYear,
      badgeId: badgeTable.id,
      titleHe: badgeTable.titleHe,
      titleEn: badgeTable.titleEn,
      iconKey: badgeTable.iconKey,
      color: badgeTable.color,
    })
    .from(kidBadge)
    .innerJoin(badgeTable, eq(badgeTable.id, kidBadge.badgeId))
    .where(eq(kidBadge.kidId, kidId))
    .orderBy(desc(kidBadge.awardedAt));

  // Locked-but-visible: badges attached to the kid's active enrollments
  // that aren't yet in their kid_badge collection.
  const activeBadgeIdsRows = await db
    .select({ badgeId: campaignTable.badgeId })
    .from(campaignEnrollment)
    .innerJoin(campaignTable, eq(campaignTable.id, campaignEnrollment.campaignId))
    .where(
      and(
        eq(campaignEnrollment.kidId, kidId),
        isNull(campaignEnrollment.completedAt),
        isNull(campaignTable.archivedAt),
      ),
    );
  const activeBadgeIds = activeBadgeIdsRows
    .map((r) => r.badgeId)
    .filter((b): b is string => b != null);
  const earnedBadgeIds = earnedRows.map((r) => r.badgeId);
  const lockedIds = activeBadgeIds.filter((id) => !earnedBadgeIds.includes(id));

  const lockedRows =
    lockedIds.length > 0
      ? await db
          .select({
            id: badgeTable.id,
            titleHe: badgeTable.titleHe,
            titleEn: badgeTable.titleEn,
            iconKey: badgeTable.iconKey,
            color: badgeTable.color,
          })
          .from(badgeTable)
          .where(
            and(inArray(badgeTable.id, lockedIds), isNull(badgeTable.archivedAt)),
          )
          .orderBy(asc(badgeTable.displayOrder))
      : [];

  const earned: EarnedBadge[] = earnedRows.map((r) => ({
    id: r.id,
    badgeId: r.badgeId,
    titleHe: r.titleHe,
    titleEn: r.titleEn,
    iconKey: r.iconKey,
    color: r.color,
    awardedAt: r.awardedAt.toISOString(),
    awardedForYear: r.awardedForYear,
  }));
  const locked: LockedBadge[] = lockedRows.map((r) => ({
    id: r.id,
    titleHe: r.titleHe,
    titleEn: r.titleEn,
    iconKey: r.iconKey,
    color: r.color,
  }));

  return (
    <KidBadges
      lang={lang as 'he' | 'en'}
      t={t}
      kidName={k.name}
      kidColor={k.color}
      kidAvatarKey={k.avatarKey}
      earned={earned}
      locked={locked}
      homeHref={`/${lang}`}
      campaignsHref={`/${lang}/campaigns`}
    />
  );
}

void notInArray;
