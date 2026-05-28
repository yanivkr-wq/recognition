/**
 * Admin theme picker — same three-swatch UI as the kid picker on /avatar,
 * but writes to a device-scoped cookie via setAdminThemeAction instead of the
 * kid row.
 *
 * Each card submits the theme immediately (button's own name/value); the local
 * state mirror flips the swatch ring instantly + previews the picked theme
 * across this whole component via the `data-theme` on the wrapping section, so
 * the admin can compare side-by-side without waiting for the round-trip.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  setAdminThemeAction,
  type SetAdminThemeState,
} from '../../../../../lib/admin-theme/actions';
import { asTheme, THEMES, type ThemeId } from '../../../../../lib/theme';

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  initialTheme: string;
}

export function AdminThemePicker({ lang, t, initialTheme }: Props) {
  const [selected, setSelected] = useState<ThemeId>(asTheme(initialTheme));
  const [state, action, pending] = useActionState<
    SetAdminThemeState | undefined,
    FormData
  >(setAdminThemeAction, undefined);

  return (
    <section className="space-y-3" data-theme={selected}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
        {t.admin.themePickTitle}
      </h2>
      <div className="bg-card rounded-2xl shadow-card border border-rule p-4">
        <form action={action}>
          <ul
            className="grid grid-cols-3 gap-3"
            role="radiogroup"
            aria-label={t.admin.themePickTitle}
          >
            {THEMES.map((th) => {
              const isPicked = selected === th.id;
              return (
                <li key={th.id}>
                  <button
                    type="submit"
                    name="theme"
                    value={th.id}
                    role="radio"
                    aria-checked={isPicked}
                    disabled={pending}
                    onClick={() => setSelected(th.id)}
                    className={`w-full rounded-2xl p-3 flex flex-col items-center gap-2 transition disabled:opacity-60 ${
                      isPicked
                        ? 'bg-pink-pale ring-2 ring-pink'
                        : 'bg-card border border-rule hover:border-pink-pale'
                    }`}
                  >
                    <span className="flex -space-x-1" aria-hidden="true">
                      {th.swatch.map((c, i) => (
                        <span
                          key={i}
                          className="w-5 h-5 rounded-full border-2 border-card"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    <span className="text-xs font-bold text-ink">
                      {lang === 'he' ? th.labelHe : th.labelEn}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </form>
        {state?.ok === true && (
          <p className="mt-3 text-xs text-mint-dark font-bold" role="status">
            {t.home.avatarSaved}
          </p>
        )}
        <p className="mt-3 text-[11px] text-ink-faded">
          {t.admin.themePickHint}
        </p>
      </div>
    </section>
  );
}
