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
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                on
                  ? 'bg-pink text-card shadow-cta-pink'
                  : 'bg-card border border-rule text-ink-soft hover:border-pink-pale'
              }`}
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
              {g.items.map((r) => (
                <li
                  key={r.id}
                  className="bg-card rounded-2xl shadow-hairline border border-rule p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink text-[14px]">{r.label}</p>
                    {r.taskTitle && (
                      <p className="text-xs text-ink-soft break-words">{r.taskTitle}</p>
                    )}
                    {r.note && (
                      <p className="text-xs text-ink-soft break-words" title={r.note}>
                        “{r.note}”
                      </p>
                    )}
                    <p className="text-[11px] text-ink-faded mt-1 num" dir="ltr">
                      {r.timeLabel}
                    </p>
                  </div>
                  <div className="text-end shrink-0 num">
                    <p
                      className={`font-bold text-sm ${
                        r.amount > 0 && r.kind !== 'undo' ? 'text-mint-dark' : 'text-ink-soft'
                      }`}
                      dir="ltr"
                    >
                      {r.amount > 0 ? '+' : ''}
                      {r.amount}
                    </p>
                    <p className="text-[11px] text-ink-faded" dir="ltr">
                      bal {r.balanceAfter}
                    </p>
                    {r.clampedAmount !== null && (
                      <p className="text-[10px] text-pink-dark" dir="ltr">
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
                        className={`text-xs font-bold rounded-full py-1.5 px-3 transition hover:-translate-y-px ${
                          r.amount > 0
                            ? 'bg-pink-pale text-pink-dark'
                            : 'bg-mint-soft text-mint-dark'
                        }`}
                      >
                        {r.amount > 0 ? t.admin.ledgerRevoke : t.admin.ledgerAddBack}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
