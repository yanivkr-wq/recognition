/**
 * Admin · campaign form (shared by create + edit).
 *
 * Kind toggle (streak / total) reveals the kind-specific fields. Feeding
 * tasks + enrolled kids use multi-select via stacked checkboxes (mobile-
 * friendly, no native multi-select). Badge picker is a single dropdown
 * with a "no badge" option.
 *
 * In EDIT mode two things are immutable (BUILD-PLAN / actions.ts note):
 *   - kind — changing streak ↔ total would invalidate enrollment state, so
 *     it renders as a static chip + hidden input.
 *   - enrolled kids — shown read-only; admins archive + recreate to swap kids.
 * Everything else (title, dates, bonus, badge, targets, feeding tasks) edits.
 *
 * The form posts to create/updateCampaignAction via useActionState; on success
 * the action redirects to /admin/campaigns. Error states render inline.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  createCampaignAction,
  updateCampaignAction,
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

export interface CampaignInitial {
  id: string;
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  kind: 'streak' | 'total';
  startDate: string;
  endDate: string;
  bonusCoins: number;
  badgeId: string | null;
  streakTargetDays: number | null;
  streakFreezesAllowed: number;
  streakPerDayThreshold: number | null;
  totalTargetQuantity: number | null;
  measureUnit?: string | null;
  feedingTemplateIds: string[];
  enrolledKidIds: string[];
}

interface Props {
  mode: 'create' | 'edit';
  lang: 'he' | 'en';
  t: Dictionary;
  defaults: { startDate: string; endDate: string };
  kids: KidOpt[];
  templates: TemplateOpt[];
  badges: BadgeOpt[];
  initial?: CampaignInitial;
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
  const { mode, lang, t, defaults, kids, templates, badges, initial } = props;
  const isEdit = mode === 'edit';
  const [kind, setKind] = useState<'streak' | 'total'>(initial?.kind ?? 'streak');
  const [state, action, pending] = useActionState<CampaignFormError | undefined, FormData>(
    isEdit ? updateCampaignAction : createCampaignAction,
    undefined,
  );

  const enrolledSet = new Set(initial?.enrolledKidIds ?? []);
  const feedingSet = new Set(initial?.feedingTemplateIds ?? []);

  return (
    <form action={action} className="space-y-5 max-w-2xl">
      <input type="hidden" name="lang" value={lang} />
      {isEdit && initial && <input type="hidden" name="id" value={initial.id} />}

      {/* Title (bilingual) */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t.admin.titleHe} name="titleHe" required defaultValue={initial?.titleHe} />
        <Field label={t.admin.titleEn} name="titleEn" required ltr defaultValue={initial?.titleEn} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t.admin.descriptionHe} name="descriptionHe" defaultValue={initial?.descriptionHe ?? ''} />
        <Field label={t.admin.descriptionEn} name="descriptionEn" ltr defaultValue={initial?.descriptionEn ?? ''} />
      </div>

      {/* Kind toggle — locked in edit mode */}
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-soft">{t.admin.campaignKind}</legend>
        {isEdit ? (
          <>
            <input type="hidden" name="kind" value={kind} />
            <span
              className={`inline-block rounded-lg py-2 px-4 text-sm font-bold ${
                kind === 'streak' ? 'bg-mint-pale text-mint-dark' : 'bg-lavender-pale text-lavender-dark'
              }`}
            >
              {kind === 'streak' ? t.admin.campaignKindStreak : t.admin.campaignKindTotal}
            </span>
          </>
        ) : (
          <div className="flex gap-2">
            <label data-on={kind === 'streak'} className="chip-admin flex-1 justify-center cursor-pointer py-2">
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
            <label data-on={kind === 'total'} className="chip-admin flex-1 justify-center cursor-pointer py-2">
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
        )}
      </fieldset>

      {/* Dates */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label={t.admin.startDate}
          name="startDate"
          type="date"
          defaultValue={initial?.startDate ?? defaults.startDate}
          required
          ltr
        />
        <Field
          label={t.admin.endDate}
          name="endDate"
          type="date"
          defaultValue={initial?.endDate ?? defaults.endDate}
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
              defaultValue={initial?.streakTargetDays?.toString() ?? '5'}
              required
              ltr
            />
            <Field
              label={t.admin.streakFreezesAllowed}
              name="streakFreezesAllowed"
              type="number"
              defaultValue={initial?.streakFreezesAllowed?.toString() ?? '1'}
              required
              ltr
            />
            <Field
              label={t.admin.streakPerDayThreshold}
              name="streakPerDayThreshold"
              type="number"
              defaultValue={initial?.streakPerDayThreshold?.toString() ?? ''}
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
            defaultValue={initial?.totalTargetQuantity?.toString() ?? '30'}
            required
            ltr
          />
          <Field
            label={t.admin.measureUnitPlaceholder}
            name="measureUnit"
            defaultValue={initial?.measureUnit ?? ''}
          />
        </fieldset>
      )}

      {/* Bonus + badge */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label={t.admin.bonusCoins}
          name="bonusCoins"
          type="number"
          defaultValue={initial?.bonusCoins?.toString() ?? '50'}
          required
          ltr
        />
        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.admin.pickBadge}</span>
          <select
            name="badgeId"
            defaultValue={initial?.badgeId ?? ''}
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
                defaultChecked={feedingSet.has(tt.id)}
                className="w-4 h-4 accent-pink"
              />
              <span className="flex-1 min-w-0 break-words">
                {lang === 'he' ? tt.titleHe : tt.titleEn}
              </span>
              <span className="shrink-0 text-[10px] uppercase text-ink-faded">
                {tt.kind}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Enrolled kids — editable on create, read-only on edit */}
      <fieldset className="space-y-2">
        <legend className="text-xs text-ink-soft">{t.admin.enrolledKids}</legend>
        <div className="flex flex-wrap gap-2">
          {kids.map((k) => {
            const enrolled = enrolledSet.has(k.id);
            if (isEdit) {
              // Read-only chip; not submitted (kids are immutable post-create).
              return (
                <span
                  key={k.id}
                  className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm ${
                    enrolled
                      ? 'bg-card border-rule text-ink'
                      : 'bg-bg border-rule text-ink-faded opacity-60'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full shrink-0"
                    style={{ backgroundColor: k.color }}
                    aria-hidden="true"
                  />
                  {k.name}
                </span>
              );
            }
            return (
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
            );
          })}
        </div>
        {isEdit && (
          <p className="text-[11px] text-ink-faded">{t.admin.enrolledKidsLocked}</p>
        )}
      </fieldset>

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
        {pending ? '…' : isEdit ? t.common.save : t.admin.create}
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
