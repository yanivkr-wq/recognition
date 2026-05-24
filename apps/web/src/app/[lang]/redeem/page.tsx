/**
 * Kid reward shop — server component.
 *
 * Queries: visible_to_kids = true AND archived_at IS NULL rewards in
 * display_order. For each one we also need the live availability state:
 *   - usedToday (only when max_per_kid_per_day is set) — count of today's
 *     active redemptions (status IN ('pending_delivery','received')) by this
 *     kid for this reward, IL date.
 *
 * The kid's spendable balance is read once from the ledger via the canonical
 * `GREATEST(0, SUM(amount))` formula. Server actions (Phase 3+) revalidate
 * `/[lang]/redeem` after each coin event so the balance + tile gating stays
 * fresh without manual cache plumbing.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  kid as kidTable,
  rewardItem as rewardItemTable,
} from '@reco/db';
import { Shop, type ShopReward } from './_components/shop';
import { isExternalImageUrl } from '../../../lib/reward-images/paths';

export const dynamic = 'force-dynamic';

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const hdrs = await headers();
  const principal = hdrs.get('x-reco-principal');

  if (principal !== 'kid') {
    // Admins use /admin/rewards (CRUD) — the kid surface is kid-only.
    redirect(`/${lang}/admin/rewards`);
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

  // Visible, non-archived rewards, cheapest first (Lily: shop sorts small →
  // big by coin value). display_order is the tiebreaker for equal-cost items.
  const rewardRows = await db
    .select({
      id: rewardItemTable.id,
      titleHe: rewardItemTable.titleHe,
      titleEn: rewardItemTable.titleEn,
      descriptionHe: rewardItemTable.descriptionHe,
      descriptionEn: rewardItemTable.descriptionEn,
      iconKey: rewardItemTable.iconKey,
      color: rewardItemTable.color,
      imagePath: rewardItemTable.imagePath,
      coinCost: rewardItemTable.coinCost,
      stockQuantity: rewardItemTable.stockQuantity,
      maxPerKidPerDay: rewardItemTable.maxPerKidPerDay,
      displayOrder: rewardItemTable.displayOrder,
    })
    .from(rewardItemTable)
    .where(
      and(
        eq(rewardItemTable.visibleToKids, true),
        isNull(rewardItemTable.archivedAt),
      ),
    )
    .orderBy(asc(rewardItemTable.coinCost), asc(rewardItemTable.displayOrder));

  // Per-day cap usage — only matters for rewards with a non-null cap.
  // Single query for the kid against all reward ids (saves N round-trips).
  const cappedIds = rewardRows
    .filter((r) => r.maxPerKidPerDay !== null)
    .map((r) => r.id);
  const usedTodayByReward = new Map<string, number>();
  if (cappedIds.length > 0) {
    const usedRes = await getPool().query<{ reward_item_id: string; n: string }>(
      `SELECT reward_item_id, count(*)::text AS n
         FROM redemption
        WHERE kid_id = $1
          AND reward_item_id = ANY($2::uuid[])
          AND status IN ('pending_delivery', 'received')
          AND (redeemed_at AT TIME ZONE 'Asia/Jerusalem')::date
            = (now()        AT TIME ZONE 'Asia/Jerusalem')::date
        GROUP BY reward_item_id`,
      [kidId, cappedIds],
    );
    for (const r of usedRes.rows) {
      usedTodayByReward.set(r.reward_item_id, Number(r.n));
    }
  }

  // Spendable balance — derived view, never a stored counter (SCHEMA.md §7).
  const balanceRes = await getPool().query<{ balance: string | null }>(
    `SELECT GREATEST(0, COALESCE(SUM(amount), 0))::text AS balance
       FROM ledger_entry WHERE kid_id = $1`,
    [kidId],
  );
  const balance = Number(balanceRes.rows[0]?.balance ?? 0);

  const rewards: ShopReward[] = rewardRows.map((r) => ({
    id: r.id,
    titleHe: r.titleHe,
    titleEn: r.titleEn,
    descriptionHe: r.descriptionHe,
    descriptionEn: r.descriptionEn,
    iconKey: r.iconKey,
    color: r.color,
    // Resolve image_path → renderable URL. Legacy http URLs (dev demos) pass
    // through; admin-uploaded files route through the session-gated API so
    // the URL stays stable across re-uploads.
    imageUrl: r.imagePath
      ? isExternalImageUrl(r.imagePath)
        ? r.imagePath
        : `/api/reward-images/${r.id}`
      : null,
    coinCost: r.coinCost,
    stockQuantity: r.stockQuantity,
    maxPerKidPerDay: r.maxPerKidPerDay,
    usedToday: usedTodayByReward.get(r.id) ?? 0,
  }));

  return (
    <Shop
      lang={lang as 'he' | 'en'}
      t={t}
      kidName={k.name}
      kidColor={k.color}
      kidAvatarKey={k.avatarKey}
      initialBalance={balance}
      rewards={rewards}
      homeHref={`/${lang}`}
      historyHref={`/${lang}/redeem/history`}
    />
  );
}
