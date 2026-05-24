/**
 * Admin · reward template form (shared by create + edit).
 *
 * Mirrors the task-template form shape: same brandbook input grammar
 * (white card surface, pink CTA, ink-soft labels). The form is bilingual
 * (titleHe + titleEn) because rewards render in whichever locale the kid
 * is using.
 *
 * Both stock_quantity and max_per_kid_per_day accept an empty string =
 * "unlimited"; the server action treats them as null in that case.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  createRewardAction,
  updateRewardAction,
  type RewardFormError,
} from '../../../../../lib/admin-rewards/actions';
import { IconPicker } from '../../../../../components/icon-picker';
import { RewardImagePicker } from './reward-image-picker';
import { RewardPreview } from './reward-preview';

interface Initial {
  id?: string;
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  iconKey: string;
  color: string;
  coinCost: number;
  stockQuantity: number | null;
  maxPerKidPerDay: number | null;
  displayOrder: number;
  visibleToKids: boolean;
  /** Resolved <img src> for the current photo — either a legacy http URL
   *  or `/api/reward-images/<id>`. Null when no photo is set. */
  currentImageUrl?: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  initial: Initial;
  lang: 'he' | 'en';
  t: Dictionary;
}

const ERROR_MESSAGES: Record<RewardFormError, keyof Dictionary['admin']> = {
  invalid_title: 'invalidReward',
  invalid_coin_cost: 'invalidReward',
  invalid_color: 'invalidReward',
  invalid_stock: 'invalidReward',
  invalid_cap: 'invalidReward',
  invalid_icon: 'invalidReward',
  forbidden: 'invalidReward',
  not_found: 'invalidReward',
  internal: 'invalidReward',
};

export function RewardForm({ mode, initial, lang, t }: Props) {
  const [state, action, pending] = useActionState<
    RewardFormError | undefined,
    FormData
  >(mode === 'create' ? createRewardAction : updateRewardAction, undefined);

  // Live form state — every field that drives the kid-eye preview is
  // mirrored here so the <RewardPreview /> updates as the admin types.
  // The form still posts via FormData (controlled inputs preserve their
  // value attribute), so server-action shape is unchanged.
  const [titleHe, setTitleHe] = useState<string>(initial.titleHe);
  const [titleEn, setTitleEn] = useState<string>(initial.titleEn);
  const [descriptionHe, setDescriptionHe] = useState<string>(initial.descriptionHe ?? '');
  const [descriptionEn, setDescriptionEn] = useState<string>(initial.descriptionEn ?? '');
  const [color, setColor] = useState<string>(initial.color);
  const [iconKey, setIconKey] = useState<string>(initial.iconKey);
  const [coinCost, setCoinCost] = useState<number>(initial.coinCost);

  return (
    <div className="grid md:grid-cols-[1fr_220px] gap-6 max-w-3xl items-start">
    <div className="space-y-4">
    <form action={action} className="space-y-4">
      <input type="hidden" name="lang" value={lang} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

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
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.admin.color}</span>
          <div className="flex items-center gap-2">
            <span
              className="w-9 h-9 rounded-xl border border-rule shrink-0"
              style={{
                backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#FFF0F6',
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
      </div>
      <div>
        <span className="block text-xs text-ink-soft mb-1">{t.admin.iconKey}</span>
        <IconPicker
          name="iconKey"
          defaultValue={initial.iconKey}
          family="reward"
          lang={lang}
          previewColor={color}
          onChange={setIconKey}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field
          label={t.admin.coinCost}
          name="coinCost"
          value={String(coinCost)}
          onChange={(v) => {
            const n = Number.parseInt(v, 10);
            setCoinCost(Number.isFinite(n) ? n : 0);
          }}
          ltr
          required
          inputMode="numeric"
        />
        <Field
          label={t.admin.stockQuantity}
          name="stockQuantity"
          defaultValue={initial.stockQuantity?.toString() ?? ''}
          ltr
          inputMode="numeric"
        />
        <Field
          label={t.admin.maxPerKidPerDay}
          name="maxPerKidPerDay"
          defaultValue={initial.maxPerKidPerDay?.toString() ?? ''}
          ltr
          inputMode="numeric"
        />
      </div>
      <Field
        label={t.admin.displayOrder}
        name="displayOrder"
        defaultValue={String(initial.displayOrder)}
        ltr
        inputMode="numeric"
      />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="visibleToKids"
          defaultChecked={initial.visibleToKids}
          className="w-4 h-4 accent-pink"
        />
        {t.admin.visibleToKids}
      </label>

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

    {/* Image picker lives OUTSIDE the main <form> so its own <form action=…>
        elements aren't nested (invalid HTML). Edit-mode only — needs a
        reward id to target. */}
    {mode === 'edit' && initial.id ? (
      <RewardImagePicker
        rewardId={initial.id}
        currentImageUrl={initial.currentImageUrl ?? null}
        t={t}
      />
    ) : (
      <p className="text-xs text-ink-faded">
        {t.admin.rewardImageCreateFirst}
      </p>
    )}
    </div>

    {/* Kid-eye live preview — sits in the right column on wide screens,
        stacks below on narrow. Reflects every keystroke in the form so the
        admin sees exactly what the kid will see before saving. */}
    <aside className="md:sticky md:top-4">
      <RewardPreview
        titleHe={titleHe}
        titleEn={titleEn}
        descriptionHe={descriptionHe}
        descriptionEn={descriptionEn}
        iconKey={iconKey}
        color={color}
        coinCost={coinCost}
        imageUrl={initial.currentImageUrl ?? null}
        lang={lang}
        t={t}
      />
    </aside>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  /** Controlled value — pair with onChange. Either this or defaultValue. */
  value?: string;
  onChange?: (v: string) => void;
  /** Uncontrolled initial value — for fields the form doesn't need to
   *  mirror into the kid-eye preview (stockQuantity, displayOrder). */
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
