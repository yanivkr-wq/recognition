/**
 * Admin · per-kid ledger view.
 *
 * Same data model as the kid wallet history page but with two differences
 * for parents:
 *   - Shows the kid's name + current display balance at the top.
 *   - Surfaces `clamped_amount` prominently (per BUILD-PLAN.md §6 acceptance
 *     test — "both parents see the audit").
 *
 * Phase 6 will add the "joker" wallet-adjust button + audit-log mini-feed
 * at the top of this page. For Phase 3 it's a read-only view.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  ledgerEntry,
  taskCompletion,
  taskAssignment,
  taskTemplate,
  kid as kidTable,
} from '@reco/db';
import { auth } from '../../../../../../auth';
import { Coin } from '../../../../../../components/coin';
import { adminCompleteForKidFormAction } from '../../../../../../lib/admin-tasks/actions';
import { arrowBack } from '../../../../../../lib/rtl';
import { JokerForm } from '../wallet/adjust/_components/joker-form';
import { LedgerList, type LedgerRow } from './_components/ledger-list';

/** Ledger kinds whose point movement can be reversed one-click (earned →
 *  revoke, or revoked → add back). Redemptions/refunds/undo have their own
 *  flows, so they don't get a quick-reverse button. */
const REVERSIBLE_KINDS = new Set(['earn', 'admin_credit', 'admin_debit', 'campaign_bonus']);

export const dynamic = 'force-dynamic';

const KIND_LABEL_KEYS = {
  earn: 'entryEarn',
  undo: 'entryUndo',
  admin_credit: 'entryAdminCredit',
  admin_debit: 'entryAdminDebit',
  redeem: 'entryRedeem',
  campaign_bonus: 'entryCampaignBonus',
  redemption_refund: 'entryRedemptionRefund',
} as const;

export default async function AdminKidLedgerPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const db = getDb();
  const kRows = await db
    .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
    .from(kidTable)
    .where(
      and(
        eq(kidTable.id, id),
        eq(kidTable.householdId, session.user.householdId),
        isNull(kidTable.archivedAt),
      ),
    )
    .limit(1);
  const k = kRows[0];
  if (!k) notFound();

  const balanceRes = await getPool().query<{ balance: string | null }>(
    `SELECT GREATEST(0, COALESCE(SUM(amount), 0))::text AS balance
     FROM ledger_entry WHERE kid_id = $1`,
    [id],
  );
  const balance = Number(balanceRes.rows[0]?.balance ?? 0);

  // Phase 7.5: list today's deadline-locked daily tasks for this kid so
  // the admin can reopen them with one click. A task is "missed" when
  // (a) it has a deadline_time, (b) the IL clock is past that deadline,
  // (c) the kid has no active task_completion for today.
  const missedRes = await getPool().query<{
    assignment_id: string;
    title_he: string;
    title_en: string;
    deadline_time: string;
    coin_value: number;
  }>(
    `SELECT ta.id AS assignment_id,
            tt.title_he, tt.title_en,
            to_char(tt.deadline_time, 'HH24:MI') AS deadline_time,
            tt.coin_value
       FROM task_assignment ta
       JOIN task_template tt ON tt.id = ta.template_id
      WHERE ta.kid_id = $1
        AND ta.enabled = TRUE
        AND ta.archived_at IS NULL
        AND tt.archived_at IS NULL
        AND tt.kind = 'daily'
        AND tt.deadline_time IS NOT NULL
        AND (now() AT TIME ZONE 'Asia/Jerusalem')::time > tt.deadline_time
        AND NOT EXISTS (
          SELECT 1 FROM task_completion tc
           WHERE tc.assignment_id = ta.id
             AND tc.undone_at IS NULL
             AND tc.completion_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
        )
      ORDER BY tt.display_order`,
    [id],
  );

  const rows = await db
    .select({
      id: ledgerEntry.id,
      kind: ledgerEntry.kind,
      amount: ledgerEntry.amount,
      clampedAmount: ledgerEntry.clampedAmount,
      balanceAfter: ledgerEntry.balanceAfter,
      note: ledgerEntry.note,
      createdAt: ledgerEntry.createdAt,
      taskTitleHe: taskTemplate.titleHe,
      taskTitleEn: taskTemplate.titleEn,
    })
    .from(ledgerEntry)
    .leftJoin(taskCompletion, eq(taskCompletion.id, ledgerEntry.taskCompletionId))
    .leftJoin(taskAssignment, eq(taskAssignment.id, taskCompletion.assignmentId))
    .leftJoin(taskTemplate, eq(taskTemplate.id, taskAssignment.templateId))
    .where(eq(ledgerEntry.kidId, id))
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(200);

  // IL-tz formatters: a stable date key for grouping, a friendly date header,
  // and a per-row time. Grouping by day is what makes "which task on which
  // date" obvious (Lily's request).
  const locale = lang === 'he' ? 'he-IL' : 'en-IL';
  const keyFmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });
  const dayFmt = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jerusalem',
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });

  const ledgerRows: LedgerRow[] = rows.map((r) => {
    const d = new Date(r.createdAt);
    return {
      id: r.id,
      kind: r.kind,
      amount: r.amount,
      clampedAmount: r.clampedAmount,
      balanceAfter: r.balanceAfter,
      note: r.note,
      taskTitle: lang === 'he' ? r.taskTitleHe : r.taskTitleEn,
      label: t.wallet[KIND_LABEL_KEYS[r.kind as keyof typeof KIND_LABEL_KEYS] ?? 'entryEarn'],
      dateKey: keyFmt.format(d),
      dateLabel: dayFmt.format(d),
      timeLabel: timeFmt.format(d),
      reversible: REVERSIBLE_KINDS.has(r.kind) && r.amount !== 0,
    };
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/${lang}/admin/kids`}
        className="text-sm text-ink-soft underline-offset-4 hover:underline"
      >
        {arrowBack(lang as 'he' | 'en')} {t.admin.kids}
      </Link>

      <header className="bg-card rounded-3xl shadow-card border border-rule p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: k.color }}
          aria-hidden="true"
        >
          <span
            className="text-2xl font-bold text-card"
            style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          >
            {k.name.charAt(0)}
          </span>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">
            {t.admin.ledgerFor}
            {k.name}
          </h1>
          <p className="text-sm text-ink-soft">{t.admin.walletBalance}</p>
        </div>
        <div className="flex items-center gap-2 num text-3xl font-extrabold text-ink" dir="ltr">
          <Coin size={24} />
          <span>{balance}</span>
        </div>
      </header>

      {/* Joker — credit / debit straight from the ledger page. Collapsed by
          default so the page stays a clean history until the admin needs it. */}
      <details className="bg-card rounded-2xl border border-rule shadow-card overflow-hidden group">
        <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between text-sm font-bold text-ink select-none">
          <span className="inline-flex items-center gap-2">
            <Coin size={16} />
            {t.admin.ledgerAdjust}
          </span>
          <span className="text-ink-faded group-open:rotate-180 transition" aria-hidden="true">⌄</span>
        </summary>
        <div className="px-5 pb-5 pt-1 border-t border-rule">
          <JokerForm
            kidId={k.id}
            kidName={k.name}
            kidColor={k.color}
            balance={balance}
            lang={lang as 'he' | 'en'}
            t={t}
          />
        </div>
      </details>

      {/* Missed-today widget — only renders when at least one daily task
          with a deadline is locked-out for this kid today (Fix 12a). */}
      {missedRes.rows.length > 0 && (
        <section className="bg-pink-soft rounded-2xl border border-pink-pale p-4 space-y-3">
          <h2 className="text-sm font-bold text-pink-dark">
            ⏰ {missedRes.rows.length} {lang === 'he' ? 'משימות שלא הושלמו היום' : 'tasks missed today'}
          </h2>
          <ul className="space-y-2">
            {missedRes.rows.map((m) => (
              <li
                key={m.assignment_id}
                className="bg-card rounded-xl border border-rule p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-sm truncate">
                    {lang === 'he' ? m.title_he : m.title_en}
                  </p>
                  <p className="text-[11px] text-ink-soft num" dir="ltr">
                    {t.admin.deadlineTime}: {m.deadline_time} · +{m.coin_value}
                  </p>
                </div>
                <form action={adminCompleteForKidFormAction}>
                  <input type="hidden" name="assignmentId" value={m.assignment_id} />
                  <button
                    type="submit"
                    className="bg-pink text-card font-bold rounded-full py-2 px-4 text-xs shadow-cta-pink transition hover:-translate-y-px active:translate-y-0"
                  >
                    {t.admin.reopenForToday}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LedgerList rows={ledgerRows} lang={lang} t={t} />
    </div>
  );
}
