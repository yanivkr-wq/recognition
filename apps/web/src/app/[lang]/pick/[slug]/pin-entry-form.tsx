/**
 * PIN entry keypad (client component).
 *
 * 3-column grid of digit buttons + backspace. Tapping a digit appends to the
 * buffer; reaching 4 auto-submits via the server action. Web Vibration API
 * fires on each tap when supported (BRANDBOOK §9.3 "tap on button" → brief
 * tactile feedback). The buffer is reset to '' on any error so the kid can
 * retry without backspacing through stale digits.
 *
 * Locked-out and wrong-pin errors come back from the server action as typed
 * keys that map to the i18n dictionary's `pin.*` strings.
 */

'use client';

import { useState, useTransition } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { submitPin, type PinSubmitError } from './actions';

interface Props {
  kidId: string;
  kidName: string;
  lang: string;
  t: Dictionary;
}

const PAD = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'back'] as const;
type PadKey = (typeof PAD)[number];

function errorString(t: Dictionary, key: PinSubmitError): string {
  switch (key) {
    case 'wrong':
      return t.pin.wrongPin;
    case 'locked':
      return t.pin.askParentToReset;
    default:
      return t.common.error;
  }
}

export function PinEntryForm({ kidId, lang, t }: Props) {
  const [buf, setBuf] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  function send(pin: string): void {
    startTransition(async () => {
      // On success the server action throws Next's redirect signal; React's
      // useTransition handles the navigation. Do NOT wrap in try/catch — that
      // swallows the signal and leaves the user stuck on a "client error" page.
      const r = await submitPin({ kidId, pin, rememberDevice, lang });
      if (r && r.ok === false) {
        setError(errorString(t, r.error));
        setBuf('');
      }
    });
  }

  function tap(key: PadKey): void {
    if (key === null || isPending) return;
    setError(null);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(40);
      }
    } catch {
      /* vibrate failures are silent */
    }
    if (key === 'back') {
      setBuf((b) => b.slice(0, -1));
      return;
    }
    // Compute next outside the state updater so we can fire the server
    // action (startTransition) cleanly — React 19 forbids triggering a
    // transition from inside a setState reducer.
    if (buf.length >= 4) return;
    const next = buf + String(key);
    setBuf(next);
    if (next.length === 4) send(next);
  }

  return (
    <div className="w-full max-w-xs">
      {/* Dot indicator */}
      <div className="flex justify-center gap-3 mb-6" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition ${
              i < buf.length ? 'bg-pink' : 'bg-rule'
            }`}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-pink-dark mb-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3" dir="ltr">
        {PAD.map((key, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => tap(key)}
            disabled={key === null || isPending}
            aria-label={key === 'back' ? 'Backspace' : key === null ? undefined : String(key)}
            className={`aspect-square rounded-2xl bg-card shadow-hairline text-3xl font-bold text-ink active:bg-pink-soft active:scale-95 transition disabled:opacity-30 ${
              key === null ? 'invisible' : ''
            }`}
            style={{ fontFamily: 'var(--font-heebo), system-ui, sans-serif' }}
          >
            {key === 'back' ? '⌫' : key}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-center gap-2 mt-6 text-sm text-ink-soft cursor-pointer">
        <input
          type="checkbox"
          checked={rememberDevice}
          onChange={(e) => setRememberDevice(e.target.checked)}
          className="accent-pink"
        />
        {t.pin.rememberDevice}
      </label>
    </div>
  );
}
