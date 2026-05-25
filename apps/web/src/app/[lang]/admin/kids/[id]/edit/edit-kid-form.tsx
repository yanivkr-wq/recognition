/**
 * Admin · edit-kid form (name + accent color + birthday).
 *
 * Controlled name + color so the live avatar preview reflects edits as the
 * admin types. The color palette mirrors the kid's own avatar page so the two
 * surfaces stay visually consistent. Birthday is an optional native date
 * input. Submits through updateKidAction via useActionState (server-action
 * signature passed straight through — never wrapped, per the locked memory).
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { Avatar } from '../../../../../../components/avatar';
import { updateKidAction, type EditKidError } from './actions';

// Same palette the kid sees on /[lang]/avatar — keep the two in sync.
const COLOR_PALETTE: { value: string; labelHe: string; labelEn: string }[] = [
  { value: '#FF6B9D', labelHe: 'ורוד', labelEn: 'Pink' },
  { value: '#FF9F7A', labelHe: 'אפרסק', labelEn: 'Peach' },
  { value: '#FFD75E', labelHe: 'צהוב', labelEn: 'Yellow' },
  { value: '#7CE0B5', labelHe: 'מנטה', labelEn: 'Mint' },
  { value: '#6EC9F4', labelHe: 'שמיים', labelEn: 'Sky' },
  { value: '#B59FE5', labelHe: 'סגול', labelEn: 'Lavender' },
  { value: '#FF8AAB', labelHe: 'רוז', labelEn: 'Rose' },
  { value: '#A8D67F', labelHe: 'ירוק', labelEn: 'Apple' },
];

interface Props {
  kidId: string;
  lang: 'he' | 'en';
  t: Dictionary;
  initialName: string;
  initialColor: string;
  initialBirthday: string | null;
  avatarKey: string | null;
}

function errorString(t: Dictionary, key: EditKidError): string {
  switch (key) {
    case 'invalid_name':
      return t.admin.kidNameLabel;
    case 'invalid_color':
      return t.admin.accentColor;
    case 'invalid_birthday':
      return t.admin.birthday;
    case 'not_found':
    case 'forbidden':
      return t.common.error;
  }
}

export function EditKidForm({
  kidId,
  lang,
  t,
  initialName,
  initialColor,
  initialBirthday,
  avatarKey,
}: Props) {
  const [err, formAction, isPending] = useActionState<EditKidError | undefined, FormData>(
    updateKidAction,
    undefined,
  );

  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor.toUpperCase());

  return (
    <form action={formAction} className="space-y-5 max-w-md">
      <input type="hidden" name="kidId" value={kidId} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="color" value={color} />

      {/* Live preview — avatar face is kid-owned, but color + name update here. */}
      <div className="flex items-center gap-4 bg-card rounded-2xl shadow-card border border-rule p-4">
        <Avatar name={name} color={color} avatarKey={avatarKey} size={64} />
        <p className="text-xl font-extrabold text-ink truncate">
          {name || t.admin.kidNameLabel}
        </p>
      </div>

      <label className="block">
        <span className="block text-sm text-ink-soft mb-1">{t.admin.kidNameLabel}</span>
        <input
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          maxLength={40}
          className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
      </label>

      <div>
        <span className="block text-sm text-ink-soft mb-2">{t.admin.accentColor}</span>
        <ul className="flex flex-wrap gap-3" role="radiogroup" aria-label={t.admin.accentColor}>
          {COLOR_PALETTE.map((c) => {
            const picked = color.toUpperCase() === c.value.toUpperCase();
            return (
              <li key={c.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  aria-label={lang === 'he' ? c.labelHe : c.labelEn}
                  onClick={() => setColor(c.value)}
                  className={`w-10 h-10 rounded-full transition flex items-center justify-center ${
                    picked
                      ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg'
                      : 'hover:ring-2 hover:ring-ink-soft hover:ring-offset-2 hover:ring-offset-bg'
                  }`}
                  style={{ backgroundColor: c.value }}
                >
                  {picked && (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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
      </div>

      <label className="block">
        <span className="block text-sm text-ink-soft mb-1">{t.admin.birthday}</span>
        <input
          name="birthday"
          type="date"
          defaultValue={initialBirthday ?? ''}
          dir="ltr"
          className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
        <span className="block mt-1 text-[11px] text-ink-faded">{t.admin.birthdayHint}</span>
      </label>

      {err && (
        <p role="alert" className="text-sm text-pink-dark">
          {errorString(t, err)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-pink text-card font-bold rounded-full py-3 px-6 shadow-cta-pink hover:-translate-y-px transition disabled:opacity-60"
      >
        {isPending ? t.common.loading : t.common.save}
      </button>
    </form>
  );
}
