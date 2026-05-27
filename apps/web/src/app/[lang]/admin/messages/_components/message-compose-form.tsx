/**
 * Admin · compose a player popup message (client).
 *
 * Target select (all players / a specific player), optional title, body
 * (dir=auto), and a [from, until] date window. Posts createPlayerMessageAction
 * via useActionState. Mirrors the brandbook form grammar.
 */

'use client';

import { useActionState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  createPlayerMessageAction,
  type PlayerMessageError,
} from '../../../../../lib/player-messages/actions';

interface KidOpt {
  id: string;
  name: string;
  color: string;
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  kids: KidOpt[];
  defaultStart: string;
  defaultEnd: string;
}

export function MessageComposeForm({ lang, t, kids, defaultStart, defaultEnd }: Props) {
  const [state, action, pending] = useActionState<PlayerMessageError | undefined, FormData>(
    createPlayerMessageAction,
    undefined,
  );

  return (
    <form
      action={action}
      className="bg-card rounded-2xl shadow-card border border-rule p-5 space-y-4"
    >
      <input type="hidden" name="lang" value={lang} />
      <h2 className="text-base font-bold text-ink">{t.playerMsg.compose}</h2>

      <label className="block">
        <span className="block text-xs text-ink-soft mb-1">{t.playerMsg.target}</span>
        <select
          name="kidId"
          defaultValue="all"
          className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        >
          <option value="all">{t.playerMsg.targetAll}</option>
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-xs text-ink-soft mb-1">{t.playerMsg.titleLabel}</span>
        <input
          type="text"
          name="title"
          dir="auto"
          className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
      </label>

      <label className="block">
        <span className="block text-xs text-ink-soft mb-1">{t.playerMsg.bodyLabel}</span>
        <textarea
          name="body"
          required
          dir="auto"
          rows={3}
          placeholder={t.playerMsg.bodyPlaceholder}
          className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition resize-y"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.playerMsg.startDate}</span>
          <input
            type="date"
            name="startDate"
            defaultValue={defaultStart}
            required
            dir="ltr"
            className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.playerMsg.endDate}</span>
          <input
            type="date"
            name="endDate"
            defaultValue={defaultEnd}
            required
            dir="ltr"
            className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          />
        </label>
      </div>

      {state && (
        <p className="text-xs text-pink-dark" role="alert">
          {t.playerMsg.invalid}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-pink text-card font-bold rounded-full py-2 px-5 text-sm shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
      >
        {pending ? t.playerMsg.sending : t.playerMsg.send}
      </button>
    </form>
  );
}
