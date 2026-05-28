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
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  kid as kidTable,
} from '@reco/db';
import { auth } from '../../../../../../auth';
import { Coin } from '../../../../../../components/coin';
import { adminCompleteForKidFormAction } from '../../../../../../lib/admin-tasks/actions';
import { arrowBack } from '../../../../../../lib/rtl';
import { JokerForm } from '../wallet/adjust/_components/joker-form';
import { LedgerList, type LedgerRow } from './_components/ledger-list';

/** Ledger kinds whose point movement can be reversed one-click. `undo` is
 *  included so admin can un-revoke a previously revoked entry — that lengthens
 *  the chain by 1 and the page render flips visibility back to the original
 *  earn. Redemptions and refunds have their own flows. */
const REVERSIBLE_KINDS = new Set([
  'earn',
  'admin_credit',
  'admin_debit',
  'campaign_bonus',
  'undo',
]);

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

  // Hand-rolled SQL: we need a self-join on ledger_entry to fetch the TARGET
  // entry's task title for `undo` rows (the undo row itself has a null
  // task_completion_id). The target's title is what makes "Revoked: Brush
  // teeth" readable — without it the undo entry would render as a vague
  // "Undo / -10" with no context.
  const rowsRes = await getPool().query<{
    id: string;
    kind: string;
    amount: number;
    clamped_amount: number | null;
    balance_after: number;
    note: string | null;
    created_at: Date;
    undo_of_entry_id: string | null;
    own_title_he: string | null;
    own_title_en: string | null;
    target_title_he: string | null;
    target_title_en: string | null;
  }>(
    `SELECT le.id, le.kind, le.amount, le.clamped_amount, le.balance_after,
            le.note, le.created_at, le.undo_of_entry_id,
            tt.title_he   AS own_title_he,
            tt.title_en   AS own_title_en,
            ttt.title_he  AS target_title_he,
            ttt.title_en  AS target_title_en
       FROM ledger_entry le
       LEFT JOIN task_completion tc  ON tc.id = le.task_completion_id
       LEFT JOIN task_assignment ta  ON ta.id = tc.assignment_id
       LEFT JOIN task_template   tt  ON tt.id = ta.template_id
       LEFT JOIN ledger_entry    tgt ON tgt.id = le.undo_of_entry_id
       LEFT JOIN task_completion ttc ON ttc.id = tgt.task_completion_id
       LEFT JOIN task_assignment tta ON tta.id = ttc.assignment_id
       LEFT JOIN task_template   ttt ON ttt.id = tta.template_id
      WHERE le.kid_id = $1
      ORDER BY le.created_at DESC
      LIMIT 200`,
    [id],
  );
  const rows = rowsRes.rows;

  // Build the undo-chain visibility map. The append-only ledger keeps every
  // entry forever (per SCHEMA.md §7) — including the original earn and the
  // revoke that undid it. Lily's request: only show ONE entry per chain so
  // the feed isn't cluttered with both halves of a cancellation.
  //
  // For each chain (root entry + zero-or-more undos stacking on it):
  //   depth 0 (no undos) → root visible
  //   depth 1 (one undo) → undo visible, root hidden    [revoke replaces earn]
  //   depth 2 (re-revoke) → root visible, both undos hidden [back to original]
  //   ...alternating: odd → leaf visible, even → root visible.
  const rowById = new Map(rows.map((r) => [r.id, r] as const));
  const chains = new Map<string, typeof rows>();
  function chainRoot(id: string): string {
    let current: string | null = id;
    for (let i = 0; i < 100 && current; i++) {
      const r = rowById.get(current);
      if (!r || r.kind !== 'undo' || !r.undo_of_entry_id) return current;
      current = r.undo_of_entry_id;
    }
    return id;
  }
  for (const r of rows) {
    const root = chainRoot(r.id);
    const arr = chains.get(root) ?? [];
    arr.push(r);
    chains.set(root, arr);
  }
  const visibleIds = new Set<string>();
  for (const [rootId, entries] of chains) {
    // Walk down the chain to find the leaf + depth (oldest-undo-first):
    // there's only one undo per target in practice, but pick latest by
    // created_at if multiple ever exist.
    const path: string[] = [rootId];
    let cursor = rootId;
    for (let i = 0; i < 100; i++) {
      const undos = entries.filter((e) => e.undo_of_entry_id === cursor);
      if (undos.length === 0) break;
      const next = undos.reduce((a, b) => (a.created_at > b.created_at ? a : b));
      path.push(next.id);
      cursor = next.id;
    }
    const depth = path.length - 1;
    visibleIds.add(depth % 2 === 0 ? rootId : path[path.length - 1]!);
  }

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

  const ledgerRows: LedgerRow[] = rows
    .filter((r) => visibleIds.has(r.id))
    .map((r) => {
      const d = new Date(r.created_at);
      // For undo entries the row's own task_completion_id is null (undos don't
      // reference a completion directly); fall back to the target entry's
      // task title so the row reads "Undo / Brush teeth / -10" instead of
      // a bare "Undo / -10".
      const ownTitle = lang === 'he' ? r.own_title_he : r.own_title_en;
      const targetTitle = lang === 'he' ? r.target_title_he : r.target_title_en;
      return {
        id: r.id,
        kind: r.kind,
        amount: r.amount,
        clampedAmount: r.clamped_amount,
        balanceAfter: r.balance_after,
        note: r.note,
        taskTitle: ownTitle ?? targetTitle,
        label: t.wallet[KIND_LABEL_KEYS[r.kind as keyof typeof KIND_LABEL_KEYS] ?? 'entryEarn'],
        dateKey: keyFmt.format(d),
        dateLabel: dayFmt.format(d),
        timeLabel: timeFmt.format(d),
        // A visible undo entry IS reversible (clicking it un-undoes — depth
        // 1 → 2, root re-appears via the chain visibility filter). 'undo' is
        // now in REVERSIBLE_KINDS so the button surfaces on those rows.
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
                    className="btn-admin"
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
