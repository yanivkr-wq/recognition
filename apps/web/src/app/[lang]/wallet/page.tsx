/**
 * Kid wallet history — Phase 7 polish (Lily's Fix 13 + 14 + 15):
 *   - Current balance card at top (same wallet-hero grammar as kid-home).
 *   - Avatar pip in the header (Fix 10).
 *   - Entries grouped by IL calendar date (Fix 15a); today + yesterday
 *     auto-expand, older days collapsed by default. Native <details>
 *     drives the expand/collapse — zero JS, zero state.
 *   - Each row carries the originating task / reward icon (Fix 13)
 *     via a 4-way LEFT JOIN: ledger → task_completion → task_assignment
 *     → task_template (for earn/undo on daily); ledger → long_term_progress
 *     → task_assignment → task_template (for earn/undo on long-term);
 *     ledger → redemption → reward_item (for redeem/refund).
 *   - Date column under the coin chip, left-aligned even in Hebrew RTL
 *     (Fix 14) — the chip + date stack together at the row end via
 *     flex column.
 *
 * The label key still drives the headline ("הרווחת" / "מימוש פרס" / …);
 * the title joined from task / reward sits as the subtitle. Joins return
 * null for kinds that don't reference that side (e.g. admin_credit has
 * no task), which the renderer collapses cleanly.
 */

import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  ledgerEntry,
  taskCompletion,
  taskAssignment,
  taskTemplate,
  longTermProgress,
  redemption,
  rewardItem,
} from '@reco/db';
import { requireKid, UnauthorizedError } from '../../../lib/auth/guards';
import { Coin } from '../../../components/coin';
import { TaskIcon } from '../../../components/task-icon';
import { RewardIcon } from '../../../components/reward-icon';
import { BottomNav } from '../_components/bottom-nav';
import { Avatar } from '../../../components/avatar';
import { arrowBack } from '../../../lib/rtl';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  kind: string;
  amount: number;
  clampedAmount: number | null;
  balanceAfter: number;
  note: string | null;
  createdAt: Date;
  ilDate: string;
  ilTime: string;
  taskTitleHe: string | null;
  taskTitleEn: string | null;
  taskIconKey: string | null;
  taskColor: string | null;
  rewardTitleHe: string | null;
  rewardTitleEn: string | null;
  rewardIconKey: string | null;
  rewardColor: string | null;
}

const KIND_LABEL_KEYS: Record<string, keyof ReturnType<typeof getDictionary>['wallet']> = {
  earn: 'entryEarn',
  undo: 'entryUndo',
  admin_credit: 'entryAdminCredit',
  admin_debit: 'entryAdminDebit',
  redeem: 'entryRedeem',
  campaign_bonus: 'entryCampaignBonus',
  redemption_refund: 'entryRedemptionRefund',
};

export default async function WalletPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect(`/${lang}/pick`);
    throw err;
  }

  const db = getDb();

  // Two long-term-progress aliases so we can also reach the template when
  // an earn was posted with long_term_progress_id (Phase 4 path).
  const tcAssignment = alias(taskAssignment, 'tc_ta');
  const tcTemplate = alias(taskTemplate, 'tc_tt');
  const lpAssignment = alias(taskAssignment, 'lp_ta');
  const lpTemplate = alias(taskTemplate, 'lp_tt');

  const rows = await db
    .select({
      id: ledgerEntry.id,
      kind: ledgerEntry.kind,
      amount: ledgerEntry.amount,
      clampedAmount: ledgerEntry.clampedAmount,
      balanceAfter: ledgerEntry.balanceAfter,
      note: ledgerEntry.note,
      createdAt: ledgerEntry.createdAt,
      ilDate: sql<string>`(${ledgerEntry.createdAt} AT TIME ZONE 'Asia/Jerusalem')::date::text`,
      ilTime: sql<string>`to_char(${ledgerEntry.createdAt} AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI')`,
      // Daily task path.
      tcTitleHe: tcTemplate.titleHe,
      tcTitleEn: tcTemplate.titleEn,
      tcIconKey: tcTemplate.iconKey,
      tcColor: tcTemplate.color,
      // Long-term task path.
      lpTitleHe: lpTemplate.titleHe,
      lpTitleEn: lpTemplate.titleEn,
      lpIconKey: lpTemplate.iconKey,
      lpColor: lpTemplate.color,
      // Reward path (redeem + redemption_refund).
      rewardTitleHe: rewardItem.titleHe,
      rewardTitleEn: rewardItem.titleEn,
      rewardIconKey: rewardItem.iconKey,
      rewardColor: rewardItem.color,
    })
    .from(ledgerEntry)
    .leftJoin(taskCompletion, eq(taskCompletion.id, ledgerEntry.taskCompletionId))
    .leftJoin(tcAssignment, eq(tcAssignment.id, taskCompletion.assignmentId))
    .leftJoin(tcTemplate, eq(tcTemplate.id, tcAssignment.templateId))
    .leftJoin(longTermProgress, eq(longTermProgress.id, ledgerEntry.longTermProgressId))
    .leftJoin(lpAssignment, eq(lpAssignment.id, longTermProgress.assignmentId))
    .leftJoin(lpTemplate, eq(lpTemplate.id, lpAssignment.templateId))
    .leftJoin(redemption, eq(redemption.id, ledgerEntry.redemptionId))
    .leftJoin(rewardItem, eq(rewardItem.id, redemption.rewardItemId))
    .where(eq(ledgerEntry.kidId, kid.kidId))
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(200);

  // Current display balance — single ledger sum, clamped to zero.
  const balanceRes = await getPool().query<{ balance: string | null }>(
    `SELECT GREATEST(0, COALESCE(SUM(amount), 0))::text AS balance
       FROM ledger_entry WHERE kid_id = $1`,
    [kid.kidId],
  );
  const balance = Number(balanceRes.rows[0]?.balance ?? 0);

  // Today + yesterday (IL) for the auto-expand rule.
  const dRes = await getPool().query<{ today: string; yesterday: string }>(
    `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text AS today,
            ((now() AT TIME ZONE 'Asia/Jerusalem')::date - 1)::text AS yesterday`,
  );
  const today = dRes.rows[0]!.today;
  const yesterday = dRes.rows[0]!.yesterday;

  // Group by ilDate preserving order (rows came in DESC createdAt).
  const byDate: { date: string; entries: Row[] }[] = [];
  for (const r of rows) {
    const norm: Row = {
      id: r.id,
      kind: r.kind,
      amount: r.amount,
      clampedAmount: r.clampedAmount,
      balanceAfter: r.balanceAfter,
      note: r.note,
      createdAt: r.createdAt,
      ilDate: r.ilDate,
      ilTime: r.ilTime,
      taskTitleHe: r.tcTitleHe ?? r.lpTitleHe,
      taskTitleEn: r.tcTitleEn ?? r.lpTitleEn,
      taskIconKey: r.tcIconKey ?? r.lpIconKey,
      taskColor: r.tcColor ?? r.lpColor,
      rewardTitleHe: r.rewardTitleHe,
      rewardTitleEn: r.rewardTitleEn,
      rewardIconKey: r.rewardIconKey,
      rewardColor: r.rewardColor,
    };
    const last = byDate[byDate.length - 1];
    if (last && last.date === norm.ilDate) {
      last.entries.push(norm);
    } else {
      byDate.push({ date: norm.ilDate, entries: [norm] });
    }
  }

  const dayHeading = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  });

  return (
    <>
    <main className="min-h-screen bg-bg pb-28">
      <header className="px-5 pt-10 pb-3 flex items-center justify-between">
        <a
          href={`/${lang}/`}
          className="text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {arrowBack(lang as 'he' | 'en')} {t.common.back}
        </a>
        <div className="flex items-center gap-2">
          <Avatar name={kid.name} color={kid.color} avatarKey={kid.avatarKey} size={32} />
          <h1 className="text-base font-bold text-ink">{t.wallet.historyTitle}</h1>
        </div>
        <span className="w-12" aria-hidden />
      </header>

      {/* Current balance card — same wallet-hero grammar as kid-home. */}
      <section className="mx-5 mt-2">
        <div className="bg-card rounded-3xl shadow-card p-5">
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            {t.wallet.myBalance}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <Coin size={36} />
            <span
              className="text-5xl font-extrabold text-ink num"
              dir="ltr"
            >
              {balance}
            </span>
            <span className="text-sm text-ink-soft self-end pb-2">
              {t.wallet.coins}
            </span>
          </div>
        </div>
      </section>

      {byDate.length === 0 ? (
        <div className="mx-5 mt-8 bg-card rounded-2xl border border-rule p-8 text-center">
          <Coin size={36} />
          <p className="mt-3 font-bold text-ink">{t.wallet.noHistory}</p>
        </div>
      ) : (
        <div className="mx-5 mt-6 space-y-3">
          {byDate.map((group) => {
            const isToday = group.date === today;
            const isYesterday = group.date === yesterday;
            // Fix 5: only today auto-expands; yesterday + older start
            // collapsed and the kid can tap to open.
            const open = isToday;
            const dayLabel = isToday
              ? lang === 'he'
                ? 'היום'
                : 'Today'
              : isYesterday
                ? lang === 'he'
                  ? 'אתמול'
                  : 'Yesterday'
                : dayHeading.format(new Date(group.date + 'T12:00:00'));
            const dayTotal = group.entries.reduce((sum, r) => sum + r.amount, 0);
            return (
              <details
                key={group.date}
                open={open}
                className="bg-card rounded-2xl border border-rule overflow-hidden"
              >
                <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-3 hover:bg-bg transition">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-ink-soft text-xs">▾</span>
                    <span className="text-sm font-bold text-ink">{dayLabel}</span>
                    <span className="text-[11px] text-ink-faded">
                      ({group.entries.length})
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold num ${
                      dayTotal >= 0 ? 'text-mint-dark' : 'text-pink-dark'
                    }`}
                  >
                    <Coin size={12} />
                    <span dir="ltr">
                      {dayTotal > 0 ? '+' : ''}
                      {dayTotal}
                    </span>
                  </span>
                </summary>
                <ul className="border-t border-rule divide-y divide-rule">
                  {group.entries.map((r) => (
                    <Entry key={r.id} row={r} lang={lang as Locale} t={t} />
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </main>
    <BottomNav lang={lang as 'he' | 'en'} t={t} />
    </>
  );
}

function Entry({
  row,
  lang,
  t,
}: {
  row: Row;
  lang: Locale;
  t: ReturnType<typeof getDictionary>;
}) {
  const labelKey = KIND_LABEL_KEYS[row.kind] ?? 'entryEarn';
  const label = t.wallet[labelKey];
  const taskTitle = lang === 'he' ? row.taskTitleHe : row.taskTitleEn;
  const rewardTitle = lang === 'he' ? row.rewardTitleHe : row.rewardTitleEn;
  const positive = row.amount > 0;
  const isUndo = row.kind === 'undo';
  const isAdminDebit = row.kind === 'admin_debit';
  const isRedeem = row.kind === 'redeem';

  const pillClass =
    positive && !isUndo
      ? 'bg-mint-pale text-mint-dark'
      : isRedeem || isAdminDebit
        ? 'bg-rule text-ink-soft'
        : 'bg-rule text-ink-soft';

  // Pick the icon to show on the left of the row. Daily / long-term task →
  // TaskIcon; redeem / refund → RewardIcon; anything else (admin, campaign,
  // pure undo with no associated task) → coin.
  const iconEl =
    row.taskIconKey && row.taskColor && taskTitle ? (
      <TaskIcon iconKey={row.taskIconKey} color={row.taskColor} title={taskTitle} size={36} />
    ) : row.rewardIconKey && row.rewardColor && rewardTitle ? (
      <RewardIcon
        iconKey={row.rewardIconKey}
        color={row.rewardColor}
        title={rewardTitle}
        size={36}
      />
    ) : (
      <div
        className="w-9 h-9 rounded-2xl bg-bg flex items-center justify-center"
        aria-hidden="true"
      >
        <Coin size={20} />
      </div>
    );

  const subtitle = taskTitle ?? rewardTitle ?? row.note ?? null;

  return (
    <li className="px-4 py-3 flex items-center gap-3">
      {iconEl}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-[14px] truncate">{label}</p>
        {subtitle && (
          <p className="text-xs text-ink-soft truncate" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex flex-col items-start shrink-0">
        {/* Coin pill at the top. */}
        <p
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold num ${pillClass}`}
        >
          <Coin size={14} />
          <span dir="ltr">
            {positive ? '+' : ''}
            {row.amount}
          </span>
        </p>
        {/* Time below, left-aligned per Fix 14 — `flex-col items-start`
            stacks them so the time naturally aligns under the coin chip's
            leading edge in both LTR and RTL document directions. */}
        <p className="mt-1 text-[10px] text-ink-faded num leading-none" dir="ltr">
          {row.ilTime}
        </p>
        {row.clampedAmount !== null && (
          <p className="mt-1 text-[10px] text-ink-faded num" dir="ltr">
            (clamped {row.clampedAmount})
          </p>
        )}
      </div>
    </li>
  );
}
