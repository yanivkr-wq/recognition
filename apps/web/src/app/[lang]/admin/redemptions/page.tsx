/**
 * Admin · redemption queue.
 *
 * Two lists (BUILD-PLAN Phase 6 §8):
 *   - "Pending delivery" — newest first, drives the parent's "give it to the
 *     kid + tap received" workflow. Each card surfaces mark-received +
 *     cancel actions.
 *   - "Recent resolved" — last 20 received / cancelled / refunded items, so
 *     the parent can see what just happened + refund a received item if
 *     needed (rare, but the operation exists).
 *
 * Snapshot fields are the source of truth for title + cost — the underlying
 * reward_item might have been renamed or archived since redemption.
 */

import { redirect } from 'next/navigation';
import { and, desc, eq, ne } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  redemption,
  kid as kidTable,
  user as userTable,
} from '@reco/db';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '../../../../auth';
import { RedemptionCard } from './_components/redemption-card';

export const dynamic = 'force-dynamic';

export default async function AdminRedemptionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const db = getDb();

  // Separate aliases for actor users so we can join three separate columns
  // (received_by_user_id, cancelled_by_user_id, refunded_by_user_id) and
  // surface "by Mom"/"by Dad" in the resolved list.
  const receivedBy = alias(userTable, 'received_by_user');
  const cancelledBy = alias(userTable, 'cancelled_by_user');
  const refundedBy = alias(userTable, 'refunded_by_user');

  const pendingRows = await db
    .select({
      id: redemption.id,
      kidId: redemption.kidId,
      kidName: kidTable.name,
      kidColor: kidTable.color,
      snapshotTitleHe: redemption.snapshotTitleHe,
      snapshotTitleEn: redemption.snapshotTitleEn,
      snapshotCoinCost: redemption.snapshotCoinCost,
      redeemedAt: redemption.redeemedAt,
    })
    .from(redemption)
    .innerJoin(kidTable, eq(kidTable.id, redemption.kidId))
    .where(
      and(
        eq(redemption.householdId, session.user.householdId),
        eq(redemption.status, 'pending_delivery'),
      ),
    )
    .orderBy(desc(redemption.redeemedAt));

  const resolvedRows = await db
    .select({
      id: redemption.id,
      kidId: redemption.kidId,
      kidName: kidTable.name,
      kidColor: kidTable.color,
      snapshotTitleHe: redemption.snapshotTitleHe,
      snapshotTitleEn: redemption.snapshotTitleEn,
      snapshotCoinCost: redemption.snapshotCoinCost,
      status: redemption.status,
      redeemedAt: redemption.redeemedAt,
      receivedAt: redemption.receivedAt,
      receivedByName: receivedBy.name,
      cancelledAt: redemption.cancelledAt,
      cancelReason: redemption.cancelReason,
      cancelledByName: cancelledBy.name,
      refundedAt: redemption.refundedAt,
      refundReason: redemption.refundReason,
      refundedByName: refundedBy.name,
    })
    .from(redemption)
    .innerJoin(kidTable, eq(kidTable.id, redemption.kidId))
    .leftJoin(receivedBy, eq(receivedBy.id, redemption.receivedByUserId))
    .leftJoin(cancelledBy, eq(cancelledBy.id, redemption.cancelledByUserId))
    .leftJoin(refundedBy, eq(refundedBy.id, redemption.refundedByUserId))
    .where(
      and(
        eq(redemption.householdId, session.user.householdId),
        ne(redemption.status, 'pending_delivery'),
      ),
    )
    .orderBy(desc(redemption.redeemedAt))
    .limit(20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.redemptionsHeading}</h1>

      <section className="space-y-3">
        {pendingRows.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-8 text-center">
            <p className="text-ink-soft">{t.admin.noPendingRedemptions}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pendingRows.map((r) => (
              <RedemptionCard
                key={r.id}
                mode="pending"
                redemptionId={r.id}
                kidName={r.kidName}
                kidColor={r.kidColor}
                titleHe={r.snapshotTitleHe}
                titleEn={r.snapshotTitleEn}
                coinCost={r.snapshotCoinCost}
                redeemedAt={r.redeemedAt.toISOString()}
                lang={lang as 'he' | 'en'}
                t={t}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-ink mb-3">{t.admin.recentRedemptions}</h2>
        {resolvedRows.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.admin.noPendingRedemptions}</p>
        ) : (
          <ul className="space-y-3">
            {resolvedRows.map((r) => (
              <RedemptionCard
                key={r.id}
                mode={r.status === 'received' ? 'received' : 'closed'}
                redemptionId={r.id}
                kidName={r.kidName}
                kidColor={r.kidColor}
                titleHe={r.snapshotTitleHe}
                titleEn={r.snapshotTitleEn}
                coinCost={r.snapshotCoinCost}
                redeemedAt={r.redeemedAt.toISOString()}
                receivedAt={r.receivedAt?.toISOString() ?? null}
                receivedByName={r.receivedByName}
                cancelledAt={r.cancelledAt?.toISOString() ?? null}
                cancelReason={r.cancelReason}
                cancelledByName={r.cancelledByName}
                refundedAt={r.refundedAt?.toISOString() ?? null}
                refundReason={r.refundReason}
                refundedByName={r.refundedByName}
                status={r.status}
                lang={lang as 'he' | 'en'}
                t={t}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
