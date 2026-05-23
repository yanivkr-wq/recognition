/**
 * Admin · household audit feed.
 *
 * Reads every audit_log row for the household, newest first. Each row
 * summarizes the action (with localized label where we have one) + actor
 * (parent or kid) + target + reason. JSON detail blobs (before/after) sit
 * behind a `<details>` so the feed stays scannable.
 *
 * The feed is the parent's accountability surface — every joker wallet
 * change, every approval, every reward CRUD lands here. Both parents see
 * the same view (no per-actor filtering in v1).
 */

import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  auditLog,
  user as userTable,
  kid as kidTable,
} from '@reco/db';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '../../../../auth';

export const dynamic = 'force-dynamic';

// Static map of action codes → display labels. Keeps the page bilingual
// without adding dozens of dictionary keys per action variant. Untranslated
// actions fall back to the raw code (still informative).
const ACTION_LABELS: Record<string, { he: string; en: string }> = {
  'submission.approved': { he: 'אישור הגשה', en: 'Submission approved' },
  'submission.denied': { he: 'דחיית הגשה', en: 'Submission denied' },
  'redemption.created': { he: 'מימוש פרס', en: 'Redemption created' },
  'redemption.received': { he: 'פרס נמסר', en: 'Redemption received' },
  'redemption.cancelled': { he: 'מימוש בוטל', en: 'Redemption cancelled' },
  'redemption.refunded': { he: 'מימוש הוחזר', en: 'Redemption refunded' },
  'wallet.admin_credit': { he: 'זיכוי ארנק', en: 'Wallet credited' },
  'wallet.admin_debit': { he: 'חיוב ארנק', en: 'Wallet debited' },
  'task_template.created': { he: 'משימה נוצרה', en: 'Task created' },
  'task_template.updated': { he: 'משימה עודכנה', en: 'Task updated' },
  'task_template.archived': { he: 'משימה בארכיון', en: 'Task archived' },
  'task_template.unarchived': { he: 'משימה הוחזרה', en: 'Task unarchived' },
  'reward_item.created': { he: 'פרס נוצר', en: 'Reward created' },
  'reward_item.updated': { he: 'פרס עודכן', en: 'Reward updated' },
  'reward_item.archived': { he: 'פרס בארכיון', en: 'Reward archived' },
  'reward_item.unarchived': { he: 'פרס הוחזר', en: 'Reward unarchived' },
  'kid.pin_reset': { he: 'איפוס קוד', en: 'PIN reset' },
  'kid.device_revoked': { he: 'ביטול גישת מכשיר', en: 'Device revoked' },
};

export default async function AuditPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const actorUser = alias(userTable, 'actor_user');
  const actorKid = alias(kidTable, 'actor_kid');

  const rows = await getDb()
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetKind: auditLog.targetKind,
      targetId: auditLog.targetId,
      reason: auditLog.reason,
      beforeJson: auditLog.beforeJson,
      afterJson: auditLog.afterJson,
      createdAt: auditLog.createdAt,
      actorUserName: actorUser.name,
      actorKidName: actorKid.name,
      actorKidColor: actorKid.color,
    })
    .from(auditLog)
    .leftJoin(actorUser, eq(actorUser.id, auditLog.actorUserId))
    .leftJoin(actorKid, eq(actorKid.id, auditLog.actorKidId))
    .where(eq(auditLog.householdId, session.user.householdId))
    .orderBy(desc(auditLog.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.auditHeading}</h1>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">{t.admin.noAuditEvents}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const label = ACTION_LABELS[r.action]?.[lang as 'he' | 'en'] ?? r.action;
            const actor =
              r.actorUserName ?? (r.actorKidName ? r.actorKidName : null);
            const detailJson = r.afterJson ?? r.beforeJson;
            return (
              <li
                key={r.id}
                className="bg-card rounded-2xl border border-rule p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.actorKidColor && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: r.actorKidColor }}
                        aria-hidden="true"
                      />
                    )}
                    <p className="font-bold text-ink truncate">{label}</p>
                  </div>
                  <span className="text-xs text-ink-soft whitespace-nowrap num" dir="ltr">
                    {fmt(r.createdAt.toISOString(), lang as 'he' | 'en')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {actor && (
                    <>
                      <span className="me-1">{t.admin.auditActor}:</span>
                      {actor}
                      {' · '}
                    </>
                  )}
                  <span className="me-1">{t.admin.auditTarget}:</span>
                  {r.targetKind}
                </p>
                {r.reason && (
                  <p className="mt-1 text-xs text-ink leading-snug">
                    <span className="text-ink-soft me-1">{t.admin.auditReason}:</span>
                    {r.reason}
                  </p>
                )}
                {detailJson != null && (
                  <details className="mt-1 text-[11px] text-ink-soft">
                    <summary className="cursor-pointer hover:text-ink-soft">
                      {t.admin.auditDetails}
                    </summary>
                    <pre
                      className="mt-2 bg-bg rounded-xl p-2 overflow-x-auto"
                      dir="ltr"
                    >
                      {JSON.stringify(detailJson, null, 2) ?? ''}
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function fmt(iso: string, lang: 'he' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
