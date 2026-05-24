/**
 * Admin · feedback list (client).
 *
 * Multi-select status filter (client-side over the already-fetched rows),
 * per-row copy-to-clipboard, and a status <select> that posts
 * updateFeedbackStatusAction on change. Each body renders with dir="auto" so
 * Hebrew right-aligns and English left-aligns (Lily's request).
 */

'use client';

import { useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import type { FeedbackStatus } from '@reco/db';
import { updateFeedbackStatusAction } from '../../../../../lib/feedback/actions';

export interface FeedbackRow {
  id: string;
  category: 'bug' | 'ui_ux' | 'feature';
  body: string;
  status: FeedbackStatus;
  submitterLabel: string;
  imageUrl: string | null;
  createdAt: string;
}

const STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'in_validation', 'completed'];

function statusLabel(t: Dictionary, s: FeedbackStatus): string {
  switch (s) {
    case 'new':
      return t.feedback.statusNew;
    case 'in_progress':
      return t.feedback.statusInProgress;
    case 'in_validation':
      return t.feedback.statusInValidation;
    case 'completed':
      return t.feedback.statusCompleted;
  }
}

function categoryLabel(t: Dictionary, c: FeedbackRow['category']): string {
  if (c === 'bug') return t.feedback.categoryBug;
  if (c === 'ui_ux') return t.feedback.categoryUiUx;
  return t.feedback.categoryFeature;
}

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-pink-pale text-pink-dark',
  in_progress: 'bg-yellow-pale text-[#7A5D10]',
  in_validation: 'bg-lavender-pale text-lavender-dark',
  completed: 'bg-mint-pale text-mint-dark',
};

export function FeedbackList({
  lang,
  t,
  items,
}: {
  lang: 'he' | 'en';
  t: Dictionary;
  items: FeedbackRow[];
}) {
  // Empty filter set = show all.
  const [active, setActive] = useState<Set<FeedbackStatus>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggle = (s: FeedbackStatus) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const visible = active.size === 0 ? items : items.filter((i) => active.has(i.status));

  const copy = async (row: FeedbackRow) => {
    try {
      await navigator.clipboard.writeText(row.body);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1400);
    } catch {
      // Clipboard can be unavailable (insecure context); fail silently.
    }
  };

  return (
    <div className="space-y-4">
      {/* Multi-select status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-soft">{t.feedback.filterByStatus}:</span>
        {STATUSES.map((s) => {
          const on = active.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={on}
              className={`rounded-full py-1 px-3 text-xs font-bold border transition ${
                on ? `${STATUS_STYLE[s]} border-transparent` : 'bg-card text-ink-soft border-rule hover:border-pink-pale'
              }`}
            >
              {statusLabel(t, s)}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">{t.feedback.empty}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => (
            <li key={row.id} className="bg-card rounded-2xl shadow-card border border-rule p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-bg text-ink-soft border border-rule">
                    {categoryLabel(t, row.category)}
                  </span>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${STATUS_STYLE[row.status]}`}>
                    {statusLabel(t, row.status)}
                  </span>
                </div>
                <span className="text-[11px] text-ink-faded num" dir="ltr">
                  {fmtDate(row.createdAt, lang)}
                </span>
              </div>

              <p className="text-sm text-ink whitespace-pre-wrap" dir="auto">
                {row.body}
              </p>

              {row.imageUrl && (
                <a href={row.imageUrl} target="_blank" rel="noreferrer" className="inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.imageUrl}
                    alt={t.feedback.attachment}
                    className="max-h-40 rounded-xl border border-rule"
                  />
                </a>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-rule/60">
                <span className="text-xs text-ink-soft">
                  {t.feedback.submittedBy}: <span className="font-bold text-ink">{row.submitterLabel}</span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => copy(row)}
                    className="text-xs text-pink-dark font-bold underline-offset-2 hover:underline"
                  >
                    {copiedId === row.id ? t.feedback.copied : t.feedback.copy}
                  </button>
                  <form action={updateFeedbackStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={row.id} />
                    <span className="sr-only">{t.feedback.statusLabel}</span>
                    <select
                      name="status"
                      defaultValue={row.status}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      className="rounded-xl border border-rule bg-card px-2 py-1 text-xs text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(t, s)}
                        </option>
                      ))}
                    </select>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtDate(iso: string, lang: 'he' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
