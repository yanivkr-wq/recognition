/**
 * Set-PIN form (client component).
 *
 * Passes the server action directly to React 19's useActionState — the action
 * has the (prevState, FormData) signature React expects, so React handles
 * the wire dispatching natively. Wrapping the server action in a client
 * function would lose its server-action-ness and just submit the form as a
 * regular browser POST (which is what we hit before — silent no-op).
 *
 * Pattern + maxLength + inputMode enforce 4-digit shape client-side; the
 * server re-validates and is the source of truth.
 */

'use client';

import { useActionState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { setKidPinAction, type SetPinError } from './actions';

interface Props {
  kidId: string;
  lang: string;
  t: Dictionary;
}

function errorString(t: Dictionary, key: SetPinError): string {
  switch (key) {
    case 'invalid_format':
      return t.pin.wrongPin;
    case 'not_found':
    case 'forbidden':
      return t.common.error;
  }
}

export function SetPinForm({ kidId, lang, t }: Props) {
  const [err, formAction, isPending] = useActionState<SetPinError | undefined, FormData>(
    setKidPinAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kidId" value={kidId} />
      <input type="hidden" name="lang" value={lang} />

      <div>
        <label htmlFor="pin" className="block text-sm text-ink-soft mb-2">
          {t.admin.newPinLabel}
        </label>
        <input
          id="pin"
          name="pin"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          minLength={4}
          required
          autoComplete="off"
          dir="ltr"
          className="w-32 rounded-xl border border-rule bg-card px-4 py-3 text-center text-2xl tracking-widest text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
        <p className="mt-2 text-xs text-ink-soft">{t.admin.pinHelp}</p>
      </div>

      {err && (
        <p role="alert" className="text-xs text-pink-dark">
          {errorString(t, err)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-admin"
      >
        {isPending ? t.common.loading : t.common.save}
      </button>
    </form>
  );
}
