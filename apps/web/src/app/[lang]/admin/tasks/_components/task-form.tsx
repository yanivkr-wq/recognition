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
 * Kind is editable in both create + edit (Lily's request): an admin can flip
 * daily ↔ long-term any time. The update action rewrites the kind-specific
 * columns to satisfy the DB CHECK; any past completion / progress rows are
 * kept as history. A short note reminds the admin of that in edit mode.
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
import { AutofillButton } from '../../../../../components/autofill-button';
import { Coin } from '../../../../../components/coin';

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
  /** Times/day the task may be completed. null = unlimited; 1 = once. */
  maxPerDay?: number | null;
  /** Journey measure: amount one completion adds + unit label. */
  measureAmount?: number | null;
  measureUnit?: string | null;
  /** One-time: single date (YYYY-MM-DD) the task is visible on. null = repeats. */
  availableDate?: string | null;
  /** Cap on approved + pending completions across all kids. null = uncapped. */
  maxCompletionsTotal?: number | null;
}

interface AssignKid {
  id: string;
  name: string;
  color: string;
  assigned: boolean;
}

interface Props {
  mode: 'create' | 'edit';
  initial?: InitialValues;
  lang: string;
  t: Dictionary;
  submitLabel: string;
  /** Edit-mode only: the household's active kids + whether this task is
   *  currently assigned to each. When provided, the form renders the
   *  per-kid assignment checkboxes and saves them with the main submit. */
  assignKids?: AssignKid[];
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

export function TaskForm({ mode, initial, lang, t, submitLabel, assignKids }: Props) {
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
  // Title + description + icon are also state so the LLM autofill button
  // can programmatically populate them after the admin types HE only.
  const [titleHe, setTitleHe] = useState<string>(initial?.titleHe ?? '');
  const [titleEn, setTitleEn] = useState<string>(initial?.titleEn ?? '');
  const [descriptionHe, setDescriptionHe] = useState<string>(initial?.descriptionHe ?? '');
  const [descriptionEn, setDescriptionEn] = useState<string>(initial?.descriptionEn ?? '');
  const [iconKey, setIconKey] = useState<string>(initial?.iconKey ?? 'ic-bed');

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
          />
          <KindOption
            value="long_term"
            checked={kind === 'long_term'}
            label={t.admin.kindLongTerm}
            onChange={() => setKind('long_term')}
          />
        </div>
        {mode === 'edit' && (
          <p className="text-[11px] text-ink-faded">{t.admin.kindChangeNote}</p>
        )}
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
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
        />
      </div>

      {/* LLM autofill — admin types HE, taps button, gets EN + icon + color
          populated. Everything is still editable after. */}
      <AutofillButton
        family="task"
        getHe={() => ({ titleHe, descriptionHe })}
        onResult={(data) => {
          setTitleEn(data.titleEn);
          setDescriptionEn(data.descriptionEn);
          setIconKey(data.iconKey);
          setColor(data.suggestedColor);
        }}
      />

      <div className="grid sm:grid-cols-2 gap-4">
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
        />
      </div>

      {/* Coin value — the most-edited number on a daily task, so it gets its
          own prominent row (Lily, mobile audit: "make the value fields more
          accessible and clear"). Big touch target + coin glyph next to the
          input so the meaning is unmistakable on a small screen. */}
      {kind === 'daily' && (
        <label className="block">
          <span className="flex items-center gap-1.5 text-sm font-bold text-ink mb-1">
            <Coin size={18} />
            {t.admin.coinValue}
          </span>
          <input
            name="coinValue"
            type="number"
            inputMode="numeric"
            min={0}
            required
            defaultValue={String(initial?.coinValue ?? 5)}
            dir="ltr"
            className="w-full rounded-xl border border-rule bg-card px-3 py-3 text-xl font-bold text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          />
        </label>
      )}

      {/* Color + display order — visual / power-user fields, paired together
          and stacked on mobile so each gets a full-width touch target. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          value={iconKey}
          family="task"
          lang={lang as 'he' | 'en'}
          previewColor={color}
          onChange={setIconKey}
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

      {/* Repeatable: how many times/day this task may be completed. Empty =
          unlimited; 1 = once. Daily only. */}
      {kind === 'daily' && (
        <label className="block">
          <span className="block text-sm font-bold text-ink mb-1">{t.admin.maxPerDay}</span>
          <input
            type="number"
            name="maxPerDay"
            min={1}
            inputMode="numeric"
            defaultValue={
              initial?.maxPerDay === null ? '' : String(initial?.maxPerDay ?? 1)
            }
            dir="ltr"
            className="w-full rounded-xl border border-rule bg-card px-3 py-3 text-base text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          />
          <span className="block mt-1 text-[11px] text-ink-faded">
            {t.admin.maxPerDayHint}
          </span>
        </label>
      )}

      {/* Journey measure (optional): how much one completion adds to a journey
          this task feeds, and the unit label. Empty = doesn't count toward
          journeys. Daily only. Stack on mobile so each input gets a full-
          width touch target; pair up at sm+ where there's room. */}
      {kind === 'daily' && (
        <div>
          <span className="block text-sm font-bold text-ink mb-1">{t.admin.measureLabel}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="number"
              name="measureAmount"
              min={0}
              inputMode="numeric"
              placeholder={t.admin.measureAmountPlaceholder}
              defaultValue={initial?.measureAmount == null ? '' : String(initial.measureAmount)}
              dir="ltr"
              className="w-full rounded-xl border border-rule bg-card px-3 py-3 text-base text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
            />
            <input
              type="text"
              name="measureUnit"
              placeholder={t.admin.measureUnitPlaceholder}
              defaultValue={initial?.measureUnit ?? ''}
              className="w-full rounded-xl border border-rule bg-card px-3 py-3 text-base text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
            />
          </div>
          <span className="block mt-1 text-[11px] text-ink-faded">
            {t.admin.measureHint}
          </span>
        </div>
      )}

      {/* One-time daily task (Lily's "like a sale" feature): the task is only
          visible on `availableDate`, and `maxCompletionsTotal` caps the
          household-wide claim count. Empty fields = repeats every day, no cap. */}
      {kind === 'daily' && (
        <fieldset className="space-y-3 rounded-2xl border border-yellow-pale bg-yellow-pale/30 p-4">
          <legend className="text-sm font-bold text-[#7A5D10] px-2">
            {t.admin.oneTimeFields}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-bold text-ink mb-1">
                {t.admin.availableDate}
              </span>
              <input
                type="date"
                name="availableDate"
                defaultValue={initial?.availableDate ?? ''}
                dir="ltr"
                className="w-full rounded-xl border border-rule bg-card px-3 py-3 text-base text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-ink mb-1">
                {t.admin.maxCompletionsTotal}
              </span>
              <input
                type="number"
                name="maxCompletionsTotal"
                min={1}
                inputMode="numeric"
                placeholder={t.admin.maxCompletionsTotalPlaceholder}
                defaultValue={
                  initial?.maxCompletionsTotal == null
                    ? ''
                    : String(initial.maxCompletionsTotal)
                }
                dir="ltr"
                className="w-full rounded-xl border border-rule bg-card px-3 py-3 text-base text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
              />
            </label>
          </div>
          <p className="text-[11px] text-ink-faded leading-snug">
            {t.admin.oneTimeHint}
          </p>
        </fieldset>
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

      {/* Per-kid assignment — folded in from the old standalone assign page.
          Checkboxes post `assignKidId` for each ticked kid; the hidden
          `assignmentsManaged` flag tells updateTaskTemplateAction to diff and
          apply the assignment changes alongside the template edit. Saved with
          the main submit below. */}
      {assignKids && assignKids.length > 0 && (
        <fieldset className="space-y-2 rounded-2xl border border-sky-pale bg-sky-soft p-4">
          <legend className="text-sm font-bold text-sky-dark px-2">
            {t.admin.assignTo}
          </legend>
          <input type="hidden" name="assignmentsManaged" value="1" />
          <div className="flex flex-wrap gap-2">
            {assignKids.map((k) => (
              <label
                key={k.id}
                className="inline-flex items-center gap-2 bg-card rounded-full border border-rule ps-2 pe-3 py-1.5 cursor-pointer hover:border-sky-pale transition"
              >
                <input
                  type="checkbox"
                  name="assignKidId"
                  value={k.id}
                  defaultChecked={k.assigned}
                  className="w-4 h-4 accent-sky-dark"
                />
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: k.color }}
                  aria-hidden="true"
                >
                  <span
                    className="text-xs font-bold text-card"
                    style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
                  >
                    {k.name.charAt(0)}
                  </span>
                </span>
                <span className="text-sm font-bold text-ink">{k.name}</span>
              </label>
            ))}
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
        className="btn-admin"
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
  value,
  onChange,
  type = 'text',
  required,
  min,
  dir,
  hint,
}: {
  label: string;
  name: string;
  /** Uncontrolled initial value — for fields the form doesn't mirror into
   *  React state (numeric / long-term fields). */
  defaultValue?: string;
  /** Controlled value — pair with onChange. Used for fields the LLM
   *  autofill button can populate (title HE/EN + description HE/EN). */
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  dir?: 'ltr' | 'rtl';
  hint?: string;
}) {
  const controlled = value !== undefined;
  const isNumber = type === 'number';
  return (
    <label className="block">
      <span className="block text-sm text-ink-soft mb-1">{label}</span>
      <input
        name={name}
        type={type}
        // Number inputs should bring up the numeric keypad on mobile, not
        // the full alphabetic keyboard — saves taps and avoids fat-finger
        // mistakes on small touch targets.
        inputMode={isNumber ? 'numeric' : undefined}
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.currentTarget.value) }
          : { defaultValue })}
        required={required}
        min={min}
        dir={dir ?? (isNumber ? 'ltr' : undefined)}
        className={`w-full rounded-xl border border-rule bg-card px-3 py-2 text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition ${
          isNumber ? 'num' : ''
        }`}
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
