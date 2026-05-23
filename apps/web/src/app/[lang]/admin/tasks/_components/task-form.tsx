/**
 * Shared client form for create + edit of a task template (daily OR long-term).
 *
 * Phase 4 adds the `kind` toggle. The form's local state mirrors the radio
 * selection so the conditional sections show/hide without a page round-trip.
 * Both server actions share the (prevState, FormData) signature so React 19's
 * useActionState dispatches them identically. Locked feedback memory: never
 * wrap a server action in a client async fn (silently strips its server-
 * action-ness and the form falls back to a plain browser POST).
 *
 * Kind-change-on-edit is rejected server-side — switching kinds would
 * silently invalidate existing completion / progress rows. The radio is
 * disabled in edit mode so admins don't try.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  createTaskTemplateAction,
  updateTaskTemplateAction,
  type TaskFormError,
} from '../../../../../lib/admin-tasks/actions';
import { IconPicker } from '../../../../../components/icon-picker';

interface InitialValues {
  id?: string;
  kind?: 'daily' | 'long_term';
  titleHe?: string;
  titleEn?: string;
  descriptionHe?: string | null;
  descriptionEn?: string | null;
  iconKey?: string;
  color?: string;
  coinValue?: number;
  evidenceRequired?: boolean;
  displayOrder?: number;
  longTermUnitLabelHe?: string | null;
  longTermUnitLabelEn?: string | null;
  longTermPerUnitCoins?: number | null;
  longTermGoalQuantity?: number | null;
  longTermBonusOnComplete?: number | null;
  /** Phase 7.5: optional 'HH:MM:SS' deadline string from the DB. */
  deadlineTime?: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  initial?: InitialValues;
  lang: string;
  t: Dictionary;
  submitLabel: string;
}

function errorString(t: Dictionary, key: TaskFormError): string {
  switch (key) {
    case 'invalid_title':
      return t.admin.titleHe + ' / ' + t.admin.titleEn;
    case 'invalid_coin_value':
      return t.admin.coinValue;
    case 'invalid_color':
      return t.admin.color;
    case 'invalid_long_term_fields':
      return t.admin.invalidLongTermFields;
    case 'not_found':
    case 'forbidden':
    case 'internal':
      return t.common.error;
  }
}

export function TaskForm({ mode, initial, lang, t, submitLabel }: Props) {
  const action = mode === 'create' ? createTaskTemplateAction : updateTaskTemplateAction;
  const [err, formAction, isPending] = useActionState<TaskFormError | undefined, FormData>(
    action,
    undefined,
  );

  // Local mirror of the kind radio so the conditional sections respond
  // without a server round-trip.
  const [kind, setKind] = useState<'daily' | 'long_term'>(initial?.kind ?? 'daily');
  // Color drives the icon-picker preview tile so the admin sees exactly
  // what the kid will see — pastel tile + chosen glyph.
  const [color, setColor] = useState<string>(initial?.color ?? '#ECE4F8');

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      <input type="hidden" name="lang" value={lang} />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <fieldset className="space-y-2">
        <legend className="text-sm text-ink-soft mb-1">{t.admin.kind}</legend>
        <div className="flex gap-2">
          <KindOption
            value="daily"
            checked={kind === 'daily'}
            label={t.admin.kindDaily}
            onChange={() => setKind('daily')}
            disabled={mode === 'edit'}
          />
          <KindOption
            value="long_term"
            checked={kind === 'long_term'}
            label={t.admin.kindLongTerm}
            onChange={() => setKind('long_term')}
            disabled={mode === 'edit'}
          />
        </div>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label={t.admin.titleHe}
          name="titleHe"
          defaultValue={initial?.titleHe ?? ''}
          required
        />
        <Field
          label={t.admin.titleEn}
          name="titleEn"
          defaultValue={initial?.titleEn ?? ''}
          required
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label={t.admin.descriptionHe}
          name="descriptionHe"
          defaultValue={initial?.descriptionHe ?? ''}
        />
        <Field
          label={t.admin.descriptionEn}
          name="descriptionEn"
          defaultValue={initial?.descriptionEn ?? ''}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {kind === 'daily' && (
          <Field
            label={t.admin.coinValue}
            name="coinValue"
            type="number"
            defaultValue={String(initial?.coinValue ?? 5)}
            required
            min={0}
          />
        )}
        <ColorField
          label={t.admin.color}
          name="color"
          value={color}
          onChange={setColor}
        />
        <Field
          label={t.admin.displayOrder}
          name="displayOrder"
          type="number"
          defaultValue={String(initial?.displayOrder ?? 50)}
        />
      </div>

      <div>
        <span className="block text-xs text-ink-soft mb-1">{t.admin.iconKey}</span>
        <IconPicker
          name="iconKey"
          defaultValue={initial?.iconKey ?? 'ic-bed'}
          family="task"
          lang={lang as 'he' | 'en'}
          previewColor={color}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="evidenceRequired"
          defaultChecked={initial?.evidenceRequired ?? false}
          className="accent-pink"
        />
        {t.admin.evidenceRequired}
      </label>

      {/* Phase 7.5: daily-task deadline. Only relevant for the daily kind;
          long-term has its own time semantics (the campaign window). */}
      {kind === 'daily' && (
        <label className="block">
          <span className="block text-sm text-ink-soft mb-1">{t.admin.deadlineTime}</span>
          <input
            type="time"
            name="deadlineTime"
            // Slice off the seconds — <input type="time"> wants HH:MM
            defaultValue={initial?.deadlineTime?.slice(0, 5) ?? ''}
            dir="ltr"
            className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          />
          <span className="block mt-1 text-[11px] text-ink-faded">
            {t.admin.deadlineTimeHint}
          </span>
        </label>
      )}

      {kind === 'long_term' && (
        <fieldset className="space-y-4 rounded-2xl border border-lavender-pale bg-lavender-soft p-4">
          <legend className="text-sm font-bold text-lavender-dark px-2">
            {t.admin.longTermFields}
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label={t.admin.unitLabelHe}
              name="longTermUnitLabelHe"
              defaultValue={initial?.longTermUnitLabelHe ?? ''}
              required
            />
            <Field
              label={t.admin.unitLabelEn}
              name="longTermUnitLabelEn"
              defaultValue={initial?.longTermUnitLabelEn ?? ''}
              required
              dir="ltr"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field
              label={t.admin.perUnitCoins}
              name="longTermPerUnitCoins"
              type="number"
              defaultValue={String(initial?.longTermPerUnitCoins ?? 1)}
              required
              min={1}
            />
            <Field
              label={t.admin.goalQuantity}
              name="longTermGoalQuantity"
              type="number"
              defaultValue={String(initial?.longTermGoalQuantity ?? 100)}
              required
              min={1}
            />
            <Field
              label={t.admin.bonusOnComplete}
              name="longTermBonusOnComplete"
              type="number"
              defaultValue={
                initial?.longTermBonusOnComplete != null
                  ? String(initial.longTermBonusOnComplete)
                  : ''
              }
              min={0}
            />
          </div>
        </fieldset>
      )}

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
        {isPending ? t.common.loading : submitLabel}
      </button>
    </form>
  );
}

function KindOption({
  value,
  checked,
  label,
  onChange,
  disabled,
}: {
  value: string;
  checked: boolean;
  label: string;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex-1 cursor-pointer rounded-2xl border px-4 py-3 text-sm font-bold text-center transition ${
        checked
          ? 'bg-pink-pale border-pink text-pink-dark'
          : 'bg-card border-rule text-ink-soft hover:border-pink-pale'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <input
        type="radio"
        name="kind"
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
  min,
  dir,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  min?: number;
  dir?: 'ltr' | 'rtl';
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-ink-soft mb-1">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        dir={dir}
        className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
      />
      {hint && <span className="block mt-1 text-[11px] text-ink-faded">{hint}</span>}
    </label>
  );
}

/** Color field with live state mirror so the icon-picker preview tile
 *  reflects the chosen color while the admin types. */
function ColorField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-ink-soft mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="w-9 h-9 rounded-xl border border-rule shrink-0"
          style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ECE4F8' }}
          aria-hidden="true"
        />
        <input
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          required
          dir="ltr"
          className="flex-1 rounded-xl border border-rule bg-card px-3 py-2 text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
      </div>
    </label>
  );
}
