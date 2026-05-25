/**
 * Client form for bulk per-kid task assignment.
 *
 * Renders one row per task template with a checkbox. The initial check set
 * comes from the kid's current enabled+non-archived assignments. Save
 * submits all checked templateIds via FormData.getAll('templateId') to
 * bulkAssignTasksAction.
 *
 * Helpers:
 *   - Select all  → check every box
 *   - Clear all   → uncheck every box (submitting an empty list disables
 *                   every existing assignment for the kid)
 *
 * Visual grammar matches the existing admin lists: white card, bordered
 * rows, task icon + title + coin chip + kind pill. The whole row is
 * clickable (label wraps it) so admins can tap-anywhere on phone.
 */

'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  bulkAssignTasksAction,
  type BulkAssignResult,
} from '../../../../../../../lib/admin-tasks/actions';
import { TaskIcon } from '../../../../../../../components/task-icon';
import { Coin } from '../../../../../../../components/coin';

interface Template {
  id: string;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
  coinValue: number;
  kind: 'daily' | 'long_term';
}

interface Props {
  kidId: string;
  lang: 'he' | 'en';
  t: Dictionary;
  templates: Template[];
  initiallyChecked: string[];
}

export function KidTasksForm({ kidId, lang, t, templates, initiallyChecked }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initiallyChecked));
  const [state, action, pending] = useActionState<
    BulkAssignResult | undefined,
    FormData
  >(bulkAssignTasksAction, undefined);

  // After a successful save, bulkAssignTasksAction revalidates this page and a
  // fresh `initiallyChecked` arrives. useState ignores prop changes, so without
  // this the checkboxes reflect the pre-save server truth until a manual
  // refresh (Pattern B). Re-sync only when the actual id set changes — keyed on
  // a stable sorted join so the admin's in-progress toggles aren't clobbered.
  const serverKey = [...initiallyChecked].sort().join(',');
  useEffect(() => {
    setChecked(new Set(initiallyChecked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const toggleOne = (id: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const selectAll = () => setChecked(new Set(templates.map((t) => t.id)));
  const clearAll = () => setChecked(new Set());

  const totalChecked = checked.size;
  const totalAvailable = templates.length;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kidId" value={kidId} />

      {/* Top bar — count + select/clear helpers */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-rule px-4 py-3">
        <p className="text-sm font-bold text-ink num">
          <span dir="ltr">{totalChecked}</span> / <span dir="ltr">{totalAvailable}</span>{' '}
          <span className="text-ink-soft font-medium">{t.admin.bulkAssignSelected}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-bold text-pink-dark hover:underline underline-offset-2"
          >
            {t.admin.bulkAssignSelectAll}
          </button>
          <span className="text-ink-faded" aria-hidden="true">·</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-bold text-ink-soft hover:underline underline-offset-2"
          >
            {t.admin.bulkAssignClearAll}
          </button>
        </div>
      </div>

      {/* Task rows */}
      <ul className="space-y-2">
        {templates.map((tpl) => {
          const isOn = checked.has(tpl.id);
          const title = lang === 'he' ? tpl.titleHe : tpl.titleEn;
          return (
            <li key={tpl.id}>
              <label
                className={`flex items-center gap-3 bg-card rounded-2xl border p-3 cursor-pointer transition ${
                  isOn
                    ? 'border-pink-pale ring-2 ring-pink-pale/40'
                    : 'border-rule hover:border-pink-pale/60'
                }`}
              >
                <input
                  type="checkbox"
                  name="templateId"
                  value={tpl.id}
                  checked={isOn}
                  onChange={(e) => toggleOne(tpl.id, e.currentTarget.checked)}
                  className="w-5 h-5 accent-pink shrink-0"
                />
                <TaskIcon iconKey={tpl.iconKey} color={tpl.color} title={title} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-sm leading-snug">{title}</p>
                  {tpl.kind === 'long_term' && (
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-lavender-dark">
                      {t.admin.kindLongTerm}
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-xs font-bold num shrink-0">
                  <Coin size={14} />
                  <span dir="ltr">{tpl.coinValue}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Result line + sticky save bar */}
      <div className="sticky bottom-3 z-10 bg-card rounded-2xl border border-rule shadow-card p-3 flex items-center justify-between gap-3">
        <div className="text-xs">
          {state?.ok === true && (
            <p className="text-mint-dark font-bold">
              +<span className="num" dir="ltr">{state.added}</span>{' '}
              {t.admin.bulkAssignAddedShort} ·{' '}
              −<span className="num" dir="ltr">{state.removed}</span>{' '}
              {t.admin.bulkAssignRemovedShort}
            </p>
          )}
          {state?.ok === false && (
            <p className="text-pink-dark" role="alert">
              {t.admin.bulkAssignFailed}
            </p>
          )}
          {!state && (
            <p className="text-ink-soft">{t.admin.bulkAssignHint}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-pink text-card font-bold rounded-full py-2 px-5 text-sm shadow-cta-pink hover:-translate-y-px transition disabled:opacity-60 disabled:translate-y-0 shrink-0"
        >
          {pending ? '…' : t.common.save}
        </button>
      </div>
    </form>
  );
}
