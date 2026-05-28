/**
 * Ledger list — date-grouped, filterable client view (Lily's request:
 * "arrange the ledger by days/date so it's clear which task belongs to which
 * date, and let the admin filter the page").
 *
 * Entries arrive newest-first with a server-computed IL `dateKey` + `dateLabel`
 * + `timeLabel`. We group consecutive entries under a date header and offer
 * category filter chips (All / Earned / Spent / Adjustments). Each reversible
 * entry keeps its one-click Revoke / Add-back form (reverseLedgerEntryAction is
 * a server action — usable directly as a form action from this client file).
 */

'use client';

import { useMemo, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { reverseLedgerEntryAction } from '../../../../../../../lib/joker/actions';

export interface LedgerRow {
  id: string;
  kind: string;
  amount: number;
  clampedAmount: number | null;
  balanceAfter: number;
  note: string | null;
  taskTitle: string | null;
  label: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  reversible: boolean;
}

type Category = 'all' | 'earned' | 'spent' | 'adjusted';

/** Map a ledger kind to a parent-facing filter category. */
function categoryOf(kind: string): Exclude<Category, 'all'> {
  if (kind === 'earn' || kind === 'campaign_bonus') return 'earned';
  if (kind === 'redeem') return 'spent';
  return 'adjusted'; // admin_credit, admin_debit, undo, redemption_refund
}

/** Visual identity for a row, driven by amount sign FIRST (the brain reads
 *  green vs raspberry instantly) and kind only for the few cases where sign
 *  alone is ambiguous. Returns CSS colour strings used inline on the left
 *  edge, the tinted card background, and the amount text — all three move
 *  together so the row reads as one coloured block.
 *
 *  Theme-independence note: the bubblegum-pink-dark hex is hardcoded for the
 *  revoke variant (rather than var(--pink-dark)) because the ocean + sunset
 *  themes override --pink-dark to a teal / coral that blends into the rest
 *  of the chrome. Brandbook §5 reserves pink-dark as the denial colour, but
 *  denial is a semantic role that must stay stable across themes — Lily on
 *  ocean reported "I can't tell what was revoked, everything's the same teal."
 *  So we use the bubblegum value (#E94B7F + #FFE0EB) regardless of theme. */
const DENY = '#E94B7F';
const DENY_SOFT = '#FFE0EB';

function visualFor(kind: string, amount: number): {
  edge: string;
  bg: string;
  amount: string;
  buttonBg: string;
} {
  // Redeem is its own thing — a kid spending coins. Pink family, neutral.
  if (kind === 'redeem') {
    return { edge: 'var(--pink)', bg: 'var(--card)', amount: DENY, buttonBg: DENY };
  }
  // Refunds always credit the kid back — read as positive even though the
  // semantic kind is different from a normal earn.
  if (kind === 'redemption_refund') {
    return {
      edge: 'var(--sky-dark)',
      bg: 'var(--sky-soft)',
      amount: 'var(--sky-dark)',
      buttonBg: 'var(--mint-dark)',
    };
  }
  // Net-positive (earn / un-revoke): green. Mint isn't themed so it's stable
  // and reads as "earned" in every theme.
  if (amount > 0) {
    return {
      edge: 'var(--mint-dark)',
      bg: 'var(--mint-soft)',
      amount: 'var(--mint-dark)',
      buttonBg: DENY, // clicking revoke moves to denial
    };
  }
  // Net-negative (revoke / debit): theme-independent raspberry-pink for the
  // strongest "this was taken away" signal we can ship without breaking the
  // brandbook's "never red" rule.
  return { edge: DENY, bg: DENY_SOFT, amount: DENY, buttonBg: 'var(--mint-dark)' };
}

export function LedgerList({
  rows,
  lang,
  t,
}: {
  rows: LedgerRow[];
  lang: string;
  t: Dictionary;
}) {
  const [cat, setCat] = useState<Category>('all');

  const filtered = useMemo(
    () => (cat === 'all' ? rows : rows.filter((r) => categoryOf(r.kind) === cat)),
    [rows, cat],
  );

  // Group consecutive rows (already date-desc) under their date header.
  const groups = useMemo(() => {
    const out: { dateKey: string; dateLabel: string; items: LedgerRow[] }[] = [];
    for (const r of filtered) {
      const last = out[out.length - 1];
      if (last && last.dateKey === r.dateKey) last.items.push(r);
      else out.push({ dateKey: r.dateKey, dateLabel: r.dateLabel, items: [r] });
    }
    return out;
  }, [filtered]);

  const chips: { key: Category; label: string }[] = [
    { key: 'all', label: t.admin.filterAll },
    { key: 'earned', label: t.admin.ledgerFilterEarned },
    { key: 'spent', label: t.admin.ledgerFilterSpent },
    { key: 'adjusted', label: t.admin.ledgerFilterAdjusted },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = cat === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              data-on={on}
              className="chip-admin"
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">{t.admin.noLedger}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.dateKey} className="space-y-2">
            <h2 className="sticky top-0 z-[1] bg-bg/90 backdrop-blur-sm py-1 text-xs font-bold uppercase tracking-wider text-ink-soft">
              {g.dateLabel}
            </h2>
            <ul className="space-y-2">
              {g.items.map((r) => {
                const v = visualFor(r.kind, r.amount);
                // The task title is what the admin scans for ("what did the
                // kid do?"), so it gets the prominent slot. The kind label
                // ("Earned" / "Undo") is metadata — smaller, beside the time.
                // If there's no task (joker / refund), the kind label is
                // promoted to fill the prominent slot instead.
                const primary = r.taskTitle ?? r.label;
                const showMetaLabel = Boolean(r.taskTitle);
                return (
                  <li
                    key={r.id}
                    className="rounded-2xl shadow-hairline border border-rule p-3.5 flex items-center gap-3"
                    style={{
                      backgroundColor: v.bg,
                      borderInlineStartWidth: 4,
                      borderInlineStartColor: v.edge,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ink text-base leading-snug break-words">
                        {primary}
                      </p>
                      <p className="text-[11px] text-ink-soft mt-1 num" dir="ltr">
                        {showMetaLabel && (
                          <>
                            <span className="font-semibold">{r.label}</span>
                            <span className="mx-1.5" aria-hidden>·</span>
                          </>
                        )}
                        <span>{r.timeLabel}</span>
                      </p>
                      {r.note && (
                        <p
                          className="text-xs text-ink-soft break-words mt-1"
                          title={r.note}
                        >
                          “{r.note}”
                        </p>
                      )}
                    </div>
                    <div className="text-end shrink-0 num">
                      <p
                        className="font-extrabold text-lg leading-none"
                        style={{ color: v.amount }}
                        dir="ltr"
                      >
                        {r.amount > 0 ? '+' : ''}
                        {r.amount}
                      </p>
                      <p className="text-[10px] text-ink-faded mt-1" dir="ltr">
                        bal {r.balanceAfter}
                      </p>
                      {r.clampedAmount !== null && (
                        <p
                          className="text-[10px]"
                          style={{ color: DENY }}
                          dir="ltr"
                        >
                          clamped {r.clampedAmount}
                        </p>
                      )}
                    </div>
                    {r.reversible && (
                      <form action={reverseLedgerEntryAction} className="shrink-0">
                        <input type="hidden" name="entryId" value={r.id} />
                        <input type="hidden" name="lang" value={lang} />
                        <button
                          type="submit"
                          className="text-xs font-bold rounded-lg py-1.5 px-3 text-card transition hover:brightness-105"
                          style={{ backgroundColor: v.buttonBg }}
                        >
                          {r.amount > 0 ? t.admin.ledgerRevoke : t.admin.ledgerAddBack}
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
