/**
 * Icon picker — grid of clickable thumbnails (Lily's Fix 1 + 5).
 *
 * Renders all icons in a family on a 6-column grid. Selected key highlights
 * with a pink ring. The selected value posts via a hidden `<input>` so the
 * picker drops into any existing form action without changing the server
 * shape (the existing iconKey field still arrives in FormData).
 *
 * Bilingual labels under each tile help a parent pick the right one ("מיטה"
 * / "Bed") — the picker UI honors the admin's current locale.
 *
 * AI suggestion is intentionally NOT here (deferred): suggesting by task
 * description needs an LLM round-trip + admin token. Future iteration.
 */

'use client';

import { useState } from 'react';
import { ICON_LIBRARY, getIcon, type IconEntry } from './icon-library';

interface Props {
  name: string;
  defaultValue: string;
  family: 'task' | 'reward';
  lang: 'he' | 'en';
  /** Tile color from the form's color field so the preview matches what the
   *  kid will actually see in the shop / task list. Falls back to the
   *  brandbook neutral pastel if not supplied. */
  previewColor?: string;
  /** Fires when the admin picks a different icon, so a parent form can keep
   *  its own live state for richer previews (e.g. a kid-eye reward tile).
   *  Optional — the hidden input still carries the value into FormData. */
  onChange?: (iconKey: string) => void;
}

export function IconPicker({ name, defaultValue, family, lang, previewColor, onChange }: Props) {
  const [selected, setSelected] = useState<string>(defaultValue);
  const pick = (key: string) => {
    setSelected(key);
    onChange?.(key);
  };
  const family_icons = ICON_LIBRARY.filter((i) => i.family === family);
  const chosen = getIcon(selected);
  const tileColor = previewColor && /^#[0-9a-fA-F]{6}$/.test(previewColor) ? previewColor : '#ECE4F8';

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selected} />

      {/* Selected preview — kid-eye view */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-ink"
          style={{ backgroundColor: tileColor }}
          aria-hidden="true"
        >
          {chosen ? <chosen.Component size={32} /> : <span className="text-xl font-bold">★</span>}
        </div>
        <div className="text-xs text-ink-soft">
          <p className="num" dir="ltr">{selected}</p>
          {chosen && (
            <p>{lang === 'he' ? chosen.labelHe : chosen.labelEn}</p>
          )}
        </div>
      </div>

      {/* 6-col grid of icons. Tap to select. */}
      <div
        className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 bg-bg rounded-2xl border border-rule max-h-72 overflow-y-auto"
        role="radiogroup"
        aria-label="Icon"
      >
        {family_icons.map((entry) => (
          <IconCell
            key={entry.key}
            entry={entry}
            selected={selected === entry.key}
            onSelect={() => pick(entry.key)}
            lang={lang}
          />
        ))}
      </div>
    </div>
  );
}

function IconCell({
  entry,
  selected,
  onSelect,
  lang,
}: {
  entry: IconEntry;
  selected: boolean;
  onSelect: () => void;
  lang: 'he' | 'en';
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={lang === 'he' ? entry.labelHe : entry.labelEn}
      aria-label={lang === 'he' ? entry.labelHe : entry.labelEn}
      role="radio"
      aria-checked={selected}
      className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition ${
        selected
          ? 'bg-pink-pale text-pink-dark ring-2 ring-pink'
          : 'bg-card text-ink hover:bg-pink-soft border border-rule'
      }`}
    >
      <entry.Component size={22} />
      <span className="text-[8px] leading-none truncate w-full text-center px-0.5">
        {lang === 'he' ? entry.labelHe : entry.labelEn}
      </span>
    </button>
  );
}
