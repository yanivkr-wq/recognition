/**
 * Kid avatar picker UI — Phase 7 polish + Lily's color-picker extension.
 *
 * The kid picks two things on this page and saves them independently:
 *   1. Avatar face (SVG from the bank)
 *   2. Accent color (one of the brandbook palette swatches)
 *
 * Live preview at the top mirrors what every avatar pip across the kid
 * surfaces will look like. Both selections write to `kid.color` /
 * `kid.avatar_key` via dedicated server actions, then `revalidatePath`
 * propagates the change to every header on next navigation.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  setKidAvatarAction,
  setKidColorAction,
  setKidThemeAction,
  type SetAvatarState,
  type SetColorState,
  type SetThemeState,
} from '../../../../lib/avatar/actions';
import { AVATAR_LIBRARY } from '../../../../components/avatar-library';
import { Avatar } from '../../../../components/avatar';
import { BottomNav } from '../../_components/bottom-nav';
import { arrowBack } from '../../../../lib/rtl';
import { THEMES, asTheme, type ThemeId } from '../../../../lib/theme';

/** Brandbook palette the kid can pick from. Mirrors the whitelist in
 *  `lib/avatar/actions.ts` so the server validates against the same set. */
const COLOR_PALETTE: { value: string; labelHe: string; labelEn: string }[] = [
  { value: '#FF6B9D', labelHe: 'ורוד',    labelEn: 'Pink' },
  { value: '#FF9F7A', labelHe: 'אפרסק',  labelEn: 'Peach' },
  { value: '#FFD75E', labelHe: 'צהוב',   labelEn: 'Yellow' },
  { value: '#7CE0B5', labelHe: 'מנטה',   labelEn: 'Mint' },
  { value: '#6EC9F4', labelHe: 'שמיים',  labelEn: 'Sky' },
  { value: '#B59FE5', labelHe: 'סגול',   labelEn: 'Lavender' },
  { value: '#FF8AAB', labelHe: 'רוז',    labelEn: 'Rose' },
  { value: '#A8D67F', labelHe: 'ירוק',   labelEn: 'Apple' },
];

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  kidName: string;
  kidColor: string;
  initialKey: string | null;
  initialTheme: string;
  backHref: string;
}

export function AvatarPickerView(props: Props) {
  const { lang, t, kidName, kidColor, initialKey, initialTheme, backHref } = props;
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(initialKey);
  const [selectedColor, setSelectedColor] = useState<string>(
    kidColor.toUpperCase(),
  );
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(asTheme(initialTheme));

  const [avatarState, avatarAction, avatarPending] = useActionState<
    SetAvatarState | undefined,
    FormData
  >(setKidAvatarAction, undefined);
  const [colorState, colorAction, colorPending] = useActionState<
    SetColorState | undefined,
    FormData
  >(setKidColorAction, undefined);
  const [themeState, themeAction, themePending] = useActionState<
    SetThemeState | undefined,
    FormData
  >(setKidThemeAction, undefined);

  const savedAny =
    avatarState?.ok === true || colorState?.ok === true || themeState?.ok === true;

  return (
    <>
      {/* `data-theme` here previews the picked theme across this whole page
          live, overriding the layout's theme until the change is saved. */}
      <main className="min-h-screen bg-bg pb-28" data-theme={selectedTheme}>
        <header className="px-5 pt-10 pb-3 flex items-center justify-between">
          <a
            href={backHref}
            className="text-sm text-ink-soft underline-offset-4 hover:underline"
          >
            {arrowBack(lang)} {t.common.back}
          </a>
          <h1 className="text-base font-bold text-ink">{t.home.avatarTitle}</h1>
          <span className="w-12" aria-hidden />
        </header>

        {/* Live preview — both the selected color AND the selected avatar
            drive what the kid sees here. */}
        <section className="mx-5 mt-2 bg-card rounded-3xl shadow-card p-5 flex flex-col items-center gap-2">
          <Avatar
            name={kidName}
            color={selectedColor}
            avatarKey={selectedAvatar}
            size={96}
          />
          <p className="text-xl font-extrabold text-ink mt-2">{kidName}</p>
          <p className="text-sm text-ink-soft">{t.home.avatarSubtitle}</p>
          {savedAny && (
            <p className="text-xs text-mint-dark font-bold" role="status">
              {t.home.avatarSaved}
            </p>
          )}
        </section>

        {/* Color swatches */}
        <section className="mx-5 mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">
            {t.home.colorPickTitle}
          </h2>
          <ul className="flex flex-wrap gap-3" role="radiogroup" aria-label={t.home.colorPickTitle}>
            {COLOR_PALETTE.map((c) => {
              const isPicked = selectedColor.toUpperCase() === c.value.toUpperCase();
              return (
                <li key={c.value}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isPicked}
                    onClick={() => setSelectedColor(c.value)}
                    title={lang === 'he' ? c.labelHe : c.labelEn}
                    className={`w-11 h-11 rounded-full transition flex items-center justify-center ${
                      isPicked
                        ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg'
                        : 'hover:ring-2 hover:ring-ink-soft hover:ring-offset-2 hover:ring-offset-bg'
                    }`}
                    style={{ backgroundColor: c.value }}
                  >
                    {isPicked && (
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="M5 10.5l3.5 3.5L15 7"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Hidden form that posts the color change directly when picked. */}
          <form action={colorAction} className="hidden">
            <input type="hidden" name="color" value={selectedColor} />
            <button type="submit" id="color-submit-helper" disabled={colorPending} />
          </form>
        </section>

        {/* Theme picker — recolors the whole app. Each card submits the theme
            immediately (own button name/value) and previews live via the
            data-theme on <main>. */}
        <section className="mx-5 mt-6">
          <h2 className="text-sm font-bold text-ink mb-2">{t.home.themePickTitle}</h2>
          <form action={themeAction}>
            <ul
              className="grid grid-cols-3 gap-3"
              role="radiogroup"
              aria-label={t.home.themePickTitle}
            >
              {THEMES.map((th) => {
                const isPicked = selectedTheme === th.id;
                return (
                  <li key={th.id}>
                    <button
                      type="submit"
                      name="theme"
                      value={th.id}
                      role="radio"
                      aria-checked={isPicked}
                      disabled={themePending}
                      onClick={() => setSelectedTheme(th.id)}
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
        </section>

        {/* Avatar grid */}
        <section className="mx-5 mt-6">
          <ul
            className="grid grid-cols-4 sm:grid-cols-5 gap-3"
            role="radiogroup"
            aria-label={t.home.avatarTitle}
          >
            {AVATAR_LIBRARY.map((entry) => {
              const isPicked = selectedAvatar === entry.key;
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isPicked}
                    onClick={() => setSelectedAvatar(entry.key)}
                    className={`w-full aspect-square rounded-2xl flex items-center justify-center transition ${
                      isPicked
                        ? 'bg-pink-pale ring-2 ring-pink'
                        : 'bg-card border border-rule hover:border-pink-pale'
                    }`}
                    title={lang === 'he' ? entry.labelHe : entry.labelEn}
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: selectedColor }}
                    >
                      <entry.Component size={50} />
                    </div>
                  </button>
                  <p className="text-[11px] text-center text-ink-soft mt-1 truncate">
                    {lang === 'he' ? entry.labelHe : entry.labelEn}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Single save button — submits BOTH the avatar AND the color
            independently. Each form posts its own field; both server
            actions revalidate the same `/[lang]` layout. */}
        <section className="mx-5 mt-6">
          <form action={avatarAction} className="flex items-center gap-3">
            <input type="hidden" name="avatarKey" value={selectedAvatar ?? ''} />
            <button
              type="submit"
              disabled={
                avatarPending ||
                colorPending ||
                (selectedAvatar === initialKey &&
                  selectedColor.toUpperCase() === kidColor.toUpperCase())
              }
              onClick={() => {
                // Also fire the color save if the kid changed it. The hidden
                // form picks up the latest selectedColor value via its
                // controlled hidden input.
                if (selectedColor.toUpperCase() !== kidColor.toUpperCase()) {
                  document.getElementById('color-submit-helper')?.click();
                }
              }}
              className="flex-1 bg-pink text-card font-bold rounded-full py-3 text-sm shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
            >
              {avatarPending || colorPending ? '…' : t.home.avatarSave}
            </button>
            {selectedAvatar && (
              <button
                type="button"
                onClick={() => setSelectedAvatar(null)}
                disabled={avatarPending}
                className="text-xs text-ink-soft underline-offset-4 hover:underline"
              >
                {t.home.avatarClear}
              </button>
            )}
          </form>
          {(avatarState?.ok === false || colorState?.ok === false) && (
            <p className="text-xs text-pink-dark mt-2" role="alert">
              {t.home.errorTryAgain}
            </p>
          )}
        </section>
      </main>
      <BottomNav lang={lang} t={t} />
    </>
  );
}
