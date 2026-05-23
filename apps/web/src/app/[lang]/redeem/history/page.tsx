/**
 * Kid redemption tracker — server component.
 *
 * Two sections (BUILD-PLAN Phase 6 §4):
 *   1. "Waiting for delivery" — status='pending_delivery', newest first, each
 *      row has a "got it!" button that flips status → received via
 *      kidMarkReceivedAction.
 *   2. "History" — everything else (received / cancelled / refunded), newest
 *      first. Cancelled + refunded rows surface the parent's reason inline.
 *
 * The snapshot fields on `redemption` (snapshot_title_he/en, snapshot_coin_cost)
 * are the source of truth here — never join back to `reward_item`, since the
 * reward might have been renamed or archived since the redemption.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  kid as kidTable,
  redemption as redemptionTable,
} from '@reco/db';
import { and, isNull } from 'drizzle-orm';
import { History, type HistoryRedemption } from './_components/history';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const hdrs = await headers();
  const principal = hdrs.get('x-reco-principal');

  if (principal !== 'kid') {
    // Admins land here from the admin redemption queue (Phase 6 sub-6e).
    redirect(`/${lang}/admin/redemptions`);
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
      id: redemptionTable.id,
      snapshotTitleHe: redemptionTable.snapshotTitleHe,
      snapshotTitleEn: redemptionTable.snapshotTitleEn,
      snapshotCoinCost: redemptionTable.snapshotCoinCost,
      status: redemptionTable.status,
      redeemedAt: redemptionTable.redeemedAt,
      receivedAt: redemptionTable.receivedAt,
      cancelledAt: redemptionTable.cancelledAt,
      cancelReason: redemptionTable.cancelReason,
      refundedAt: redemptionTable.refundedAt,
      refundReason: redemptionTable.refundReason,
    })
    .from(redemptionTable)
    .where(eq(redemptionTable.kidId, kidId))
    .orderBy(desc(redemptionTable.redeemedAt));

  const items: HistoryRedemption[] = rows.map((r) => ({
    id: r.id,
    titleHe: r.snapshotTitleHe,
    titleEn: r.snapshotTitleEn,
    coinCost: r.snapshotCoinCost,
    status: r.status,
    redeemedAt: r.redeemedAt.toISOString(),
    receivedAt: r.receivedAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    cancelReason: r.cancelReason,
    refundedAt: r.refundedAt?.toISOString() ?? null,
    refundReason: r.refundReason,
  }));

  // Same wallet balance read as the shop, so the kid sees a consistent number
  // when bouncing between /redeem and /redeem/history.
  const balanceRes = await getPool().query<{ balance: string | null }>(
    `SELECT GREATEST(0, COALESCE(SUM(amount), 0))::text AS balance
       FROM ledger_entry WHERE kid_id = $1`,
    [kidId],
  );
  const balance = Number(balanceRes.rows[0]?.balance ?? 0);

  return (
    <History
      lang={lang as 'he' | 'en'}
      t={t}
      kidName={k.name}
      kidColor={k.color}
      kidAvatarKey={k.avatarKey}
      balance={balance}
      items={items}
      shopHref={`/${lang}/redeem`}
    />
  );
}
