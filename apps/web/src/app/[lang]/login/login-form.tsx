/**
 * Parent login form (client component).
 *
 * Uses React 19's useActionState hook to track the server action's error
 * return value + pending state. All styling consumes brandbook tokens:
 * pink primary CTA + rule-color borders + ink text. RTL/LTR-aware via the
 * logical `ps-1` padding utility (BRANDBOOK §8.1).
 */

'use client';

import { useActionState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { login, type LoginErrorKey } from './actions';

interface Props {
  lang: string;
  t: Dictionary;
}

export function LoginForm({ lang, t }: Props) {
  const [errorKey, formAction, isPending] = useActionState<LoginErrorKey, FormData>(
    login,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="lang" value={lang} />

      <div>
        <label htmlFor="email" className="block text-xs text-ink-soft mb-1 ps-1">
          {t.auth.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className="w-full rounded-xl border border-rule bg-card px-4 py-3 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs text-ink-soft mb-1 ps-1">
          {t.auth.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-rule bg-card px-4 py-3 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
      </div>

      {errorKey === 'invalidCredentials' && (
        <p role="alert" className="text-xs text-pink-dark text-center">
          {t.auth.invalidCredentials}
        </p>
      )}
      {errorKey === 'error' && (
        <p role="alert" className="text-xs text-pink-dark text-center">
          {t.common.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-pink text-white font-bold rounded-full py-3 shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {isPending ? t.common.loading : t.auth.signIn}
      </button>
    </form>
  );
}
