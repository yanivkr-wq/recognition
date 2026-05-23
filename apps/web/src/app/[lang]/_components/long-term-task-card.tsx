/**
 * Long-term task card (kid-facing) — progress bar + log-quantity input +
 * inline undo chips for today's entries.
 *
 * Visual contract per BRANDBOOK:
 *   - §2.3 lavender = campaigns / long-term / "magic" surfaces; progress
 *     bar uses lavender gradient.
 *   - §6.4 progress bar: 8px track, rounded both ends, `transition: width
 *     300ms ease`.
 *   - §6.2 card-mint for completed state.
 *
 * Two separate useEffects watch logState + undoState so the most-recent
 * action wins when both have ever fired (same lesson as the daily task
 * card — a single combined effect always favors the earlier-declared
 * state). Catches the same stale-state bug from Phase 3.
 *
 * Today's-entries chips: small pill-shaped buttons per row. Tap to undo
 * that specific row (with bonus reversal if it drops the total below
 * goal — handled inside undoLongTermProgressOperation).
 */

'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  logProgressAction,
  undoLongTermProgressAction,
  type LogProgressState,
  type UndoProgressState,
} from '../../../lib/long-term/actions';
import { Coin } from '../../../components/coin';
import { TaskIcon } from '../../../components/task-icon';

export interface TodaysProgressEntry {
  progressId: string;
  quantity: number;
}

interface Props {
  assignmentId: string;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
  perUnitCoins: number;
  goalQuantity: number;
  bonusOnComplete: number | null;
  unitLabelHe: string;
  unitLabelEn: string;
  currentTotal: number;
  completed: boolean;
  todaysEntries: TodaysProgressEntry[];
  lang: 'he' | 'en';
  t: Dictionary;
  onBalance?: (newBalance: number) => void;
}

export function LongTermTaskCard(props: Props) {
  const { lang, t } = props;
  const title = lang === 'he' ? props.titleHe : props.titleEn;
  const unit = lang === 'he' ? props.unitLabelHe : props.unitLabelEn;

  const [quantity, setQuantity] = useState<string>('');

  const [logState, logAction, logPending] = useActionState<LogProgressState | undefined, FormData>(
    logProgressAction,
    undefined,
  );
  const [undoState, undoAction, undoPending] = useActionState<
    UndoProgressState | undefined,
    FormData
  >(undoLongTermProgressAction, undefined);

  const onBalance = props.onBalance;
  useEffect(() => {
    if (onBalance && logState?.ok === true) onBalance(logState.balanceAfter);
  }, [logState, onBalance]);
  useEffect(() => {
    if (onBalance && undoState?.ok === true) onBalance(undoState.balanceAfter);
  }, [undoState, onBalance]);

  // Clear the input after a successful log so the kid can immediately log another.
  useEffect(() => {
    if (logState?.ok === true) setQuantity('');
  }, [logState]);

  const fillPct =
    props.goalQuantity > 0
      ? Math.min(100, Math.round((props.currentTotal / props.goalQuantity) * 100))
      : 0;

  return (
    <li
      className={`rounded-2xl border shadow-card p-4 space-y-3 ${
        props.completed ? 'bg-mint-soft border-mint-pale' : 'bg-card border-rule'
      }`}
    >
      <header className="flex items-center gap-3">
        <TaskIcon iconKey={props.iconKey} color={props.color} title={title} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-soft flex items-center flex-wrap gap-1">
            <Coin size={12} />
            <span dir="ltr" className="num">
              {props.perUnitCoins}
            </span>{' '}
            <span>
              {t.longTerm.perUnit} {unit}
            </span>
            {props.bonusOnComplete ? (
              <>
                <span className="mx-1">·</span>
                <span>{t.longTerm.bonusEarned}:</span>
                <Coin size={12} />
                <span dir="ltr" className="num">
                  {props.bonusOnComplete}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {props.completed && (
          <span className="text-[10px] uppercase tracking-wider text-mint-dark font-bold whitespace-nowrap">
            {t.longTerm.completed}
          </span>
        )}
      </header>

      <div>
        <div className="flex items-center justify-between text-[11px] text-ink-soft mb-1">
          <span>{t.longTerm.progressLabel}</span>
          <span className="num" dir="ltr">
            {props.currentTotal} / {props.goalQuantity} {unit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-rule overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${fillPct}%`,
              background: 'linear-gradient(90deg, var(--lavender), var(--lavender-dark))',
              transition: 'width 300ms ease',
            }}
            aria-label={`${fillPct}%`}
          />
        </div>
      </div>

      {!props.completed && (
        <form action={logAction} className="flex items-center gap-2">
          <input type="hidden" name="assignmentId" value={props.assignmentId} />
          <input
            type="number"
            name="quantity"
            inputMode="numeric"
            min={1}
            max={9999}
            placeholder={t.longTerm.quantityPlaceholder}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            dir="ltr"
            className="flex-1 min-w-0 rounded-full border border-rule bg-card px-3 py-2 text-sm text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
            required
          />
          <button
            type="submit"
            disabled={logPending}
            className="bg-pink text-card font-bold rounded-full py-2 px-4 text-xs shadow-cta-pink hover:-translate-y-px active:translate-y-0 transition disabled:opacity-60 shrink-0"
          >
            {logPending ? '…' : t.longTerm.log}
          </button>
        </form>
      )}

      {props.todaysEntries.length > 0 && (
        <div className="border-t border-rule pt-2">
          <p className="text-[11px] text-ink-soft mb-1">{t.longTerm.todaysEntries}</p>
          <ul className="flex flex-wrap gap-2">
            {props.todaysEntries.map((entry) => (
              <li key={entry.progressId}>
                <form action={undoAction} className="inline-flex">
                  <input type="hidden" name="progressId" value={entry.progressId} />
                  <button
                    type="submit"
                    disabled={undoPending}
                    className="inline-flex items-center gap-1 bg-rule rounded-full px-2.5 py-1 text-xs text-ink-soft font-bold hover:bg-pink-pale hover:text-pink-dark transition disabled:opacity-60"
                    aria-label={`${t.home.undo} +${entry.quantity}`}
                  >
                    <span dir="ltr" className="num">
                      +{entry.quantity}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {logState?.ok === false && logState.error === 'invalid_quantity' && (
        <p className="text-xs text-pink-dark" role="alert">
          {t.longTerm.invalidQuantity}
        </p>
      )}
      {logState?.ok === false && logState.error === 'internal' && (
        <p className="text-xs text-pink-dark" role="alert">
          {t.home.errorTryAgain}
        </p>
      )}
    </li>
  );
}
