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

  // Color is mirrored as state so the IconPicker preview tile reflects
  // exactly what the kid will see in the shop.
  const [color, setColor] = useState<string>(initial.color);

  return (
    <div className="space-y-4 max-w-xl">
    <form action={action} className="space-y-4">
      <input type="hidden" name="lang" value={lang} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <Field
        label={t.admin.titleHe}
        name="titleHe"
        defaultValue={initial.titleHe}
        required
      />
      <Field
        label={t.admin.titleEn}
        name="titleEn"
        defaultValue={initial.titleEn}
        required
        ltr
      />
      <Field
        label={t.admin.descriptionHe}
        name="descriptionHe"
        defaultValue={initial.descriptionHe ?? ''}
      />
      <Field
        label={t.admin.descriptionEn}
        name="descriptionEn"
        defaultValue={initial.descriptionEn ?? ''}
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
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field
          label={t.admin.coinCost}
          name="coinCost"
          defaultValue={String(initial.coinCost)}
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
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  ltr?: boolean;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-soft mb-1">{props.label}</span>
      <input
        type="text"
        name={props.name}
        defaultValue={props.defaultValue}
        required={props.required}
        inputMode={props.inputMode}
        dir={props.ltr ? 'ltr' : undefined}
        className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
      />
    </label>
  );
}
