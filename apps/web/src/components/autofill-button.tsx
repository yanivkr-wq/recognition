/**
 * "✨ מלא אוטומטית" button — LLM autofill trigger for admin forms.
 *
 * Reads the current Hebrew title + description from the parent form (via
 * the `getHe` callback the parent provides) and calls the right server
 * action based on `family`. On success, calls `onResult` with the parsed
 * LLM output so the parent can drop the values into its React state
 * (titleEn, descriptionEn, iconKey, suggestedColor).
 *
 * The button stays disabled while no Hebrew title is present (the LLM has
 * nothing to translate). Once it has output, briefly shows a mint-tinted
 * "✓ ניתן לערוך" hint so the admin knows to review + override before save.
 */

'use client';

import { useState, useTransition } from 'react';
import {
  suggestTaskFieldsAction,
  suggestRewardFieldsAction,
  suggestBadgeFieldsAction,
  type SuggestFieldsState,
} from '../lib/llm/actions';

interface Props {
  family: 'task' | 'reward' | 'badge';
  /** Reads the current HE inputs at click time so we don't have to mirror
   *  the parent's React state here. */
  getHe: () => { titleHe: string; descriptionHe?: string };
  /** Fired with the LLM's structured output on success. Parent applies
   *  the values to its own state (form fields + preview tile). */
  onResult: (data: {
    titleEn: string;
    descriptionEn: string;
    iconKey: string;
    suggestedColor: string;
  }) => void;
}

export function AutofillButton({ family, getHe, onResult }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SuggestFieldsState | undefined>(undefined);

  const click = () => {
    setState(undefined);
    const { titleHe, descriptionHe } = getHe();
    if (!titleHe.trim()) {
      setState({ ok: false, error: 'missing_title' });
      return;
    }
    const fd = new FormData();
    fd.set('titleHe', titleHe);
    if (descriptionHe) fd.set('descriptionHe', descriptionHe);

    startTransition(async () => {
      const action =
        family === 'task'
          ? suggestTaskFieldsAction
          : family === 'reward'
            ? suggestRewardFieldsAction
            : suggestBadgeFieldsAction;
      const result = await action(undefined, fd);
      setState(result);
      if (result.ok) onResult(result.data);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={click}
        disabled={pending}
        className="inline-flex items-center gap-1.5 bg-lavender-pale text-lavender-dark font-bold rounded-full py-1.5 px-3 text-xs hover:opacity-80 transition disabled:opacity-60"
      >
        <span aria-hidden="true">✨</span>
        {pending ? 'ממלא…' : 'מלא אוטומטית'}
      </button>
      {state?.ok === true && (
        <span className="text-[11px] text-mint-dark">✓ ניתן לערוך</span>
      )}
      {state?.ok === false && (
        <span className="text-[11px] text-pink-dark">
          {state.error === 'missing_title'
            ? 'יש להזין כותרת תחילה'
            : state.error === 'forbidden'
              ? 'אין הרשאה'
              : 'הניסיון נכשל'}
        </span>
      )}
    </div>
  );
}
