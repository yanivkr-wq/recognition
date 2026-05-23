/**
 * Admin · new campaign form.
 *
 * Kind toggle (streak / total) reveals the kind-specific fields. Feeding
 * tasks + enrolled kids use multi-select via stacked checkboxes (mobile-
 * friendly, no native multi-select). Badge picker is a single dropdown
 * with a "no badge" option.
 *
 * The form posts to createCampaignAction via useActionState; on success
 * the action redirects to /admin/campaigns. Error states render inline.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  createCampaignAction,
  type CampaignFormError,
} from '../../../../../lib/admin-campaigns/actions';

interface KidOpt {
  id: string;
  name: string;
  color: string;
}
interface TemplateOpt {
  id: string;
  titleHe: string;
  titleEn: string;
  kind: 'daily' | 'long_term';
}
interface BadgeOpt {
  id: string;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  defaults: { startDate: string; endDate: string };
  kids: KidOpt[];
  templates: TemplateOpt[];
  badges: BadgeOpt[];
}

const ERROR_MESSAGES: Record<CampaignFormError, keyof Dictionary['admin']> = {
  invalid_title: 'invalidCampaign',
  invalid_dates: 'invalidCampaign',
  invalid_kind: 'invalidCampaign',
  invalid_bonus: 'invalidCampaign',
  invalid_streak_fields: 'invalidCampaign',
  invalid_total_fields: 'invalidCampaign',
  no_feeding_tasks: 'invalidCampaign',
  no_kids: 'invalidCampaign',
  forbidden: 'invalidCampaign',
  not_found: 'invalidCampaign',
  internal: 'invalidCampaign',
};

export function CampaignForm(props: Props) {
  const { lang, t, defaults, kids, templates, badges } = props;
  const [kind, setKind] = useState<'streak' | 'total'>('streak');
  const [state, action, pending] = useActionState<
    CampaignFormError | undefined,
    FormData
  >(createCampaignAction, undefined);

  return (
    <form action={action} className="space-y-5 max-w-2xl">
      <input type="hidden" name="lang" value={lang} />

      {/* Title (bilingual) */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t.admin.titleHe} name="titleHe" required />
        <Field label={t.admin.titleEn} name="titleEn" required ltr />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t.admin.descriptionHe} name="descriptionHe" />
        <Field label={t.admin.descriptionEn} name="descriptionEn" ltr />
      </div>

      {/* Kind toggle */}
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-soft">{t.admin.campaignKind}</legend>
        <div className="flex gap-2">
          <label
            className={`flex-1 rounded-full py-2 px-4 text-sm font-bold text-center cursor-pointer transition ${
              kind === 'streak' ? 'bg-mint text-card shadow-cta-mint' : 'bg-card text-ink border border-rule'
            }`}
          >
            <input
              type="radio"
              name="kind"
              value="streak"
              checked={kind === 'streak'}
              onChange={() => setKind('streak')}
              className="sr-only"
            />
            {t.admin.campaignKindStreak}
          </label>
          <label
            className={`flex-1 rounded-full py-2 px-4 text-sm font-bold text-center cursor-pointer transition ${
              kind === 'total' ? 'bg-lavender text-card' : 'bg-card text-ink border border-rule'
            }`}
            style={kind === 'total' ? { boxShadow: '0 4px 12px rgba(181, 159, 229, 0.35)' } : {}}
          >
            <input
              type="radio"
              name="kind"
              value="total"
              checked={kind === 'total'}
              onChange={() => setKind('total')}
              className="sr-only"
            />
            {t.admin.campaignKindTotal}
          </label>
        </div>
      </fieldset>

      {/* Dates */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label={t.admin.startDate}
          name="startDate"
          type="date"
          defaultValue={defaults.startDate}
          required
          ltr
        />
        <Field
          label={t.admin.endDate}
          name="endDate"
          type="date"
          defaultValue={defaults.endDate}
          required
          ltr
        />
      </div>

      {/* Kind-specific fields */}
      {kind === 'streak' && (
        <fieldset className="border border-rule rounded-2xl p-4 space-y-3 bg-mint-soft">
          <legend className="px-2 text-xs text-mint-dark font-bold">
            {t.admin.campaignKindStreak}
          </legend>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field
              label={t.admin.streakTargetDays}
              name="streakTargetDays"
              type="number"
              defaultValue="5"
              required
              ltr
            />
            <Field
              label={t.admin.streakFreezesAllowed}
              name="streakFreezesAllowed"
              type="number"
              defaultValue="1"
              required
              ltr
            />
            <Field
              label={t.admin.streakPerDayThreshold}
              name="streakPerDayThreshold"
              type="number"
              ltr
            />
          </div>
        </fieldset>
      )}
      {kind === 'total' && (
        <fieldset className="border border-rule rounded-2xl p-4 space-y-3 bg-lavender-soft">
          <legend className="px-2 text-xs text-lavender-dark font-bold">
            {t.admin.campaignKindTotal}
          </legend>
          <Field
            label={t.admin.totalTargetQuantity}
            name="totalTargetQuantity"
            type="number"
            defaultValue="30"
            required
            ltr
          />
        </fieldset>
      )}

      {/* Bonus + badge */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label={t.admin.bonusCoins}
          name="bonusCoins"
          type="number"
          defaultValue="50"
          required
          ltr
        />
        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.admin.pickBadge}</span>
          <select
            name="badgeId"
            defaultValue=""
            className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          >
            <option value="">{t.admin.noBadge}</option>
            {badges.map((b) => (
              <option key={b.id} value={b.id}>
                {lang === 'he' ? b.titleHe : b.titleEn}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Feeding tasks (multi-select via checkboxes) */}
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-soft">{t.admin.feedingTasks}</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          {templates.map((tt) => (
            <label
              key={tt.id}
              className="flex items-center gap-2 bg-card border border-rule rounded-xl px-3 py-2 text-sm cursor-pointer hover:border-pink-pale transition"
            >
              <input
                type="checkbox"
                name="feedingTemplateIds"
                value={tt.id}
                className="w-4 h-4 accent-pink"
              />
              <span className="flex-1 truncate">
                {lang === 'he' ? tt.titleHe : tt.titleEn}
              </span>
              <span className="text-[10px] uppercase text-ink-faded">
                {tt.kind}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Enrolled kids */}
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-soft">{t.admin.enrolledKids}</legend>
        <div className="flex flex-wrap gap-2">
          {kids.map((k) => (
            <label
              key={k.id}
              className="flex items-center gap-2 bg-card border border-rule rounded-xl px-3 py-2 text-sm cursor-pointer hover:border-pink-pale transition"
            >
              <input
                type="checkbox"
                name="kidIds"
                value={k.id}
                className="w-4 h-4 accent-pink"
              />
              <span
                className="w-5 h-5 rounded-full shrink-0"
                style={{ backgroundColor: k.color }}
                aria-hidden="true"
              />
              {k.name}
            </label>
          ))}
        </div>
      </fieldset>

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
        {pending ? '…' : t.admin.create}
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  ltr?: boolean;
  type?: string;
}

function Field(p: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-soft mb-1">{p.label}</span>
      <input
        type={p.type ?? 'text'}
        name={p.name}
        defaultValue={p.defaultValue}
        required={p.required}
        dir={p.ltr ? 'ltr' : undefined}
        className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
      />
    </label>
  );
}
