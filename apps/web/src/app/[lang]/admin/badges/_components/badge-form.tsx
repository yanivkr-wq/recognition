/**
 * Admin · badge template form (shared by create + edit).
 *
 * Same brandbook input grammar as the reward form (white card, pink CTA,
 * ink-soft labels). The emblem picker is a small grid over the locked em-*
 * set (BADGE_EMBLEMS) — not the task/reward IconPicker, whose families don't
 * include emblems. The live preview is the placeholder Embroidered Patch the
 * kid badge page renders, so the admin sees exactly what kids will see until
 * the family-3 SVGs land.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  createBadgeAction,
  updateBadgeAction,
  type BadgeFormError,
} from '../../../../../lib/admin-badges/actions';
import { BADGE_EMBLEMS } from '../../../../../lib/admin-badges/emblems';

interface Initial {
  id?: string;
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  iconKey: string;
  color: string;
  awardedVia: 'campaign' | 'manual';
  displayOrder: number;
}

interface Props {
  mode: 'create' | 'edit';
  initial: Initial;
  lang: 'he' | 'en';
  t: Dictionary;
}

const ERROR_MESSAGES: Record<BadgeFormError, keyof Dictionary['admin']> = {
  invalid_title: 'invalidBadge',
  invalid_color: 'invalidBadge',
  invalid_icon: 'invalidBadge',
  invalid_awarded_via: 'invalidBadge',
  forbidden: 'invalidBadge',
  not_found: 'invalidBadge',
  internal: 'invalidBadge',
};

export function BadgeForm({ mode, initial, lang, t }: Props) {
  const [state, action, pending] = useActionState<BadgeFormError | undefined, FormData>(
    mode === 'create' ? createBadgeAction : updateBadgeAction,
    undefined,
  );

  const [titleHe, setTitleHe] = useState<string>(initial.titleHe);
  const [titleEn, setTitleEn] = useState<string>(initial.titleEn);
  const [descriptionHe, setDescriptionHe] = useState<string>(initial.descriptionHe ?? '');
  const [descriptionEn, setDescriptionEn] = useState<string>(initial.descriptionEn ?? '');
  const [color, setColor] = useState<string>(initial.color);
  const [iconKey, setIconKey] = useState<string>(initial.iconKey);

  const previewTitle = lang === 'he' ? titleHe : titleEn;

  return (
    <div className="grid md:grid-cols-[1fr_220px] gap-6 max-w-3xl items-start">
      <form action={action} className="space-y-4">
        <input type="hidden" name="lang" value={lang} />
        {initial.id && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="iconKey" value={iconKey} />

        <Field
          label={t.admin.titleHe}
          name="titleHe"
          value={titleHe}
          onChange={setTitleHe}
          required
        />
        <Field
          label={t.admin.titleEn}
          name="titleEn"
          value={titleEn}
          onChange={setTitleEn}
          required
          ltr
        />
        <Field
          label={t.admin.descriptionHe}
          name="descriptionHe"
          value={descriptionHe}
          onChange={setDescriptionHe}
        />
        <Field
          label={t.admin.descriptionEn}
          name="descriptionEn"
          value={descriptionEn}
          onChange={setDescriptionEn}
          ltr
        />

        <div>
          <span className="block text-xs text-ink-soft mb-1">{t.admin.emblem}</span>
          <div
            className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2 bg-bg rounded-2xl border border-rule"
            role="radiogroup"
            aria-label={t.admin.emblem}
          >
            {BADGE_EMBLEMS.map((em) => {
              const selected = iconKey === em.key;
              return (
                <button
                  key={em.key}
                  type="button"
                  onClick={() => setIconKey(em.key)}
                  role="radio"
                  aria-checked={selected}
                  title={lang === 'he' ? em.labelHe : em.labelEn}
                  aria-label={lang === 'he' ? em.labelHe : em.labelEn}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition ${
                    selected
                      ? 'bg-pink-pale text-pink-dark ring-2 ring-pink'
                      : 'bg-card text-ink hover:bg-pink-soft border border-rule'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-card text-sm font-bold"
                    style={{
                      backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#B59FE5',
                    }}
                    aria-hidden="true"
                  >
                    {(lang === 'he' ? em.labelHe : em.labelEn).charAt(0)}
                  </span>
                  <span className="text-[8px] leading-none truncate w-full text-center px-0.5">
                    {lang === 'he' ? em.labelHe : em.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.admin.color}</span>
          <div className="flex items-center gap-2">
            <span
              className="w-9 h-9 rounded-xl border border-rule shrink-0"
              style={{
                backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#B59FE5',
              }}
              aria-hidden="true"
            />
            <input
              name="color"
              type="text"
              value={color}
              onChange={(e) => setColor(e.currentTarget.value)}
              required
              dir="ltr"
              className="flex-1 rounded-xl border border-rule bg-card px-3 py-2 text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
            />
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-ink-soft mb-1">{t.admin.awardedVia}</span>
            <select
              name="awardedVia"
              defaultValue={initial.awardedVia}
              className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
            >
              <option value="campaign">{t.admin.awardedViaCampaign}</option>
              <option value="manual">{t.admin.awardedViaManual}</option>
            </select>
          </label>
          <Field
            label={t.admin.displayOrder}
            name="displayOrder"
            defaultValue={String(initial.displayOrder)}
            ltr
            inputMode="numeric"
          />
        </div>

        {state && (
          <p className="text-xs text-pink-dark" role="alert">
            {t.admin[ERROR_MESSAGES[state]]}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-pink text-card font-bold rounded-full py-2 px-5 text-sm shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
        >
          {pending ? '…' : mode === 'create' ? t.admin.create : t.common.save}
        </button>
      </form>

      {/* Kid-eye live preview — the placeholder Embroidered Patch (BRANDBOOK §5). */}
      <aside className="md:sticky md:top-4">
        <div className="bg-card rounded-2xl shadow-card border border-rule p-5 flex flex-col items-center gap-2">
          <p className="text-xs text-ink-soft self-start">{t.admin.rewardPreviewKidEye}</p>
          <PatchPreview color={color} title={previewTitle} />
          <p className="text-sm font-bold text-ink text-center">
            {previewTitle || (lang === 'he' ? 'תג' : 'Badge')}
          </p>
        </div>
      </aside>
    </div>
  );
}

function PatchPreview({ color, title }: { color: string; title: string }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#B59FE5';
  return (
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center"
      style={{ backgroundColor: safe + '33', border: `2px dashed ${safe}` }}
      aria-hidden="true"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: safe }}
      >
        <span
          className="text-2xl font-bold text-card"
          style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
        >
          {(title || '?').charAt(0)}
        </span>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  required?: boolean;
  ltr?: boolean;
  inputMode?: 'numeric' | 'text';
}) {
  const controlled = props.value !== undefined;
  return (
    <label className="block">
      <span className="block text-xs text-ink-soft mb-1">{props.label}</span>
      <input
        type="text"
        name={props.name}
        {...(controlled
          ? {
              value: props.value,
              onChange: (e) => props.onChange?.(e.currentTarget.value),
            }
          : { defaultValue: props.defaultValue })}
        required={props.required}
        inputMode={props.inputMode}
        dir={props.ltr ? 'ltr' : undefined}
        className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
      />
    </label>
  );
}
