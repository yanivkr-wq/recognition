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

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '@reco/shared/i18n';
import {
  createBadgeAction,
  updateBadgeAction,
  type BadgeFormError,
} from '../../../../../lib/admin-badges/actions';
import {
  generateBadgeIconAction,
  removeBadgeImageAction,
} from '../../../../../lib/admin-badges/image-actions';
import { BADGE_EMBLEMS } from '../../../../../lib/admin-badges/emblems';
import { AutofillButton } from '../../../../../components/autofill-button';
import { BadgeEmblem } from '../../../../../components/badge-emblem';
import { BadgeImagePicker } from './badge-image-picker';

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
  /** Resolved <img src> for the current custom image, or null. */
  currentImageUrl?: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  initial: Initial;
  lang: 'he' | 'en';
  t: Dictionary;
}

// On-brand badge swatches (the saturated set the seeded badges + AI use).
// The native picker covers anything else.
const BADGE_COLOR_SWATCHES = [
  '#FF6B9D', // pink
  '#E8B927', // yellow
  '#5FD0A6', // mint
  '#6EC9F4', // sky
  '#3DA8DD', // deep sky
  '#FF9F7A', // peach
  '#B59FE5', // lavender
];

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

  // AI icon generation (edit-only — needs a saved badge id to store onto).
  // `hideImage` lets the preview drop the custom image the instant the admin
  // picks an emblem, before the server clear + refresh lands.
  const router = useRouter();
  const [genPending, startGen] = useTransition();
  const [genErr, setGenErr] = useState<string | null>(null);
  const [hideImage, setHideImage] = useState(false);
  const hasTitle = !!(titleHe.trim() || titleEn.trim());
  const showImage = !hideImage && !!initial.currentImageUrl;

  function generateIcon() {
    if (!initial.id || !hasTitle) return;
    setGenErr(null);
    setHideImage(false);
    const fd = new FormData();
    fd.set('badgeId', initial.id);
    fd.set('titleHe', titleHe);
    fd.set('titleEn', titleEn);
    fd.set('descriptionHe', descriptionHe);
    fd.set('descriptionEn', descriptionEn);
    fd.set('color', color);
    startGen(async () => {
      const res = await generateBadgeIconAction(undefined, fd);
      if (res.ok) router.refresh();
      else setGenErr(res.detail ?? t.admin.badgeGenerateFailed);
    });
  }

  // Clear the custom/AI image so the chosen emblem shows instead.
  function clearCustomImage() {
    if (!initial.id) return;
    setHideImage(true);
    setGenErr(null);
    const fd = new FormData();
    fd.set('badgeId', initial.id);
    startGen(async () => {
      await removeBadgeImageAction(fd);
      router.refresh();
    });
  }

  // Picking an emblem replaces any AI/custom image.
  function pickEmblem(key: string) {
    setIconKey(key);
    if (initial.id && initial.currentImageUrl && !hideImage) clearCustomImage();
  }

  const previewTitle = lang === 'he' ? titleHe : titleEn;

  return (
    <div className="grid md:grid-cols-[1fr_220px] gap-6 max-w-3xl items-start">
      <div className="space-y-4">
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
        {/* LLM autofill — sits under the English title since it fills the EN
            translation + emblem + brand color from the HE fields (admin can
            override anything after). */}
        <AutofillButton
          family="badge"
          getHe={() => ({ titleHe, descriptionHe })}
          onResult={(data) => {
            setTitleEn(data.titleEn);
            setDescriptionEn(data.descriptionEn);
            setIconKey(data.iconKey);
            setColor(data.suggestedColor);
          }}
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
            className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2 bg-bg rounded-2xl border border-rule"
            role="radiogroup"
            aria-label={t.admin.emblem}
          >
            {BADGE_EMBLEMS.map((em) => {
              const selected = iconKey === em.key;
              return (
                <button
                  key={em.key}
                  type="button"
                  onClick={() => pickEmblem(em.key)}
                  role="radio"
                  aria-checked={selected}
                  title={lang === 'he' ? em.labelHe : em.labelEn}
                  aria-label={lang === 'he' ? em.labelHe : em.labelEn}
                  className={`rounded-xl flex flex-col items-center justify-center gap-1 py-2 transition ${
                    selected
                      ? 'bg-pink-pale ring-2 ring-pink'
                      : 'bg-card hover:bg-pink-soft border border-rule'
                  }`}
                >
                  <BadgeEmblem iconKey={em.key} color={color} size={40} />
                  <span className="text-[8px] leading-none truncate w-full text-center px-0.5 text-ink">
                    {lang === 'he' ? em.labelHe : em.labelEn}
                  </span>
                </button>
              );
            })}
          </div>

          {/* AI icon generator — sits with the emblem picker. Edit-only (needs
              a saved badge id); generates an original SVG from the title and
              sets it as the badge image, overriding the chosen emblem. */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {initial.id ? (
              <>
                <button
                  type="button"
                  onClick={generateIcon}
                  disabled={genPending || !hasTitle}
                  className="btn-admin-secondary"
                >
                  {genPending
                    ? t.admin.badgeGeneratingIcon
                    : showImage
                      ? t.admin.badgeRegenerateIcon
                      : t.admin.badgeGenerateIcon}
                </button>
                {showImage && (
                  <button
                    type="button"
                    onClick={clearCustomImage}
                    disabled={genPending}
                    className="text-[11px] text-ink-soft underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    {t.admin.badgeRemoveIcon}
                  </button>
                )}
                {!hasTitle && (
                  <span className="text-[11px] text-ink-faded">{t.admin.badgeGenerateNoTitle}</span>
                )}
                {genErr && (
                  <span className="text-[11px] text-pink-dark num" dir="ltr">
                    {genErr}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-ink-faded">{t.admin.badgeImageCreateFirst}</span>
            )}
          </div>
        </div>

        <div className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.admin.color}</span>
          {/* Brand swatches + a native picker for anything custom. The chosen
              hex posts via the hidden input below. */}
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap items-center gap-2">
            {BADGE_COLOR_SWATCHES.map((c) => {
              const selected = color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={selected}
                  className={`w-8 h-8 rounded-full border-2 transition hover:scale-105 ${
                    selected ? 'border-ink ring-2 ring-pink-pale' : 'border-rule'
                  }`}
                  style={{ backgroundColor: c }}
                />
              );
            })}
            {/* Custom color — native picker behind a rainbow chip. */}
            <label
              className="relative w-8 h-8 rounded-full border-2 border-rule overflow-hidden cursor-pointer shrink-0"
              title={t.admin.color}
              style={{
                background:
                  'conic-gradient(#FF6B9D,#E8B927,#5FD0A6,#6EC9F4,#B59FE5,#FF6B9D)',
              }}
            >
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#B59FE5'}
                onChange={(e) => setColor(e.currentTarget.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label={t.admin.color}
              />
            </label>
            <span className="num text-[11px] text-ink-faded ms-1" dir="ltr">
              {color}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          className="btn-admin"
        >
          {pending ? '…' : mode === 'create' ? t.admin.create : t.common.save}
        </button>
      </form>

      {/* Custom image picker lives OUTSIDE the main <form> (own file POST) and
          is edit-only — needs a badge id to target. */}
      {mode === 'edit' && initial.id ? (
        <BadgeImagePicker
          badgeId={initial.id}
          currentImageUrl={initial.currentImageUrl ?? null}
          t={t}
        />
      ) : (
        <p className="text-xs text-ink-faded">{t.admin.badgeImageCreateFirst}</p>
      )}
      </div>

      {/* Kid-eye live preview — the Embroidered Patch (BRANDBOOK §5). */}
      <aside className="md:sticky md:top-4">
        <div className="bg-card rounded-2xl shadow-card border border-rule p-5 flex flex-col items-center gap-2">
          <p className="text-xs text-ink-soft self-start">{t.admin.rewardPreviewKidEye}</p>
          <BadgeEmblem
            iconKey={iconKey}
            color={color}
            title={previewTitle}
            imageUrl={showImage ? initial.currentImageUrl ?? null : null}
            size={80}
          />
          <p className="text-sm font-bold text-ink text-center">
            {previewTitle || (lang === 'he' ? 'תג' : 'Badge')}
          </p>
        </div>
      </aside>
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
