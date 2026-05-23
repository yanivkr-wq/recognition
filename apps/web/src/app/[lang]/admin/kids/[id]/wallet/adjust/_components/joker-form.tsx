/**
 * Admin · joker form (client component).
 *
 * UX: two buttons ("Add" mint / "Subtract" pink) flip the sign on a hidden
 * `amount` value before submit. The visible amount input is unsigned; the
 * sign comes from the button the parent clicked. Reason is required and
 * non-empty (enforced both client-side via `required` and server-side via
 * the action + the underlying ledger CHECK constraint).
 *
 * On success: the form clears + a calm success line shows the new balance.
 * For admin_debit overdraws the clamped_amount surfaces ("subtracted N of
 * M") so the parent immediately sees what actually landed vs. what they
 * asked for.
 */

'use client';

import { useActionState, useRef, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { adjustWalletAction, type AdjustWalletState } from '../../../../../../../../lib/joker/actions';
import { Coin } from '../../../../../../../../components/coin';

interface Props {
  kidId: string;
  kidName: string;
  kidColor: string;
  balance: number;
  lang: 'he' | 'en';
  t: Dictionary;
}

export function JokerForm({ kidId, kidName, kidColor, balance, t }: Props) {
  const [state, action, pending] = useActionState<
    AdjustWalletState | undefined,
    FormData
  >(adjustWalletAction, undefined);

  const [mode, setMode] = useState<'credit' | 'debit'>('credit');
  const amountInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-card rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: kidColor }}
          aria-hidden="true"
        >
          <span
            className="text-2xl font-bold text-card"
            style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          >
            {kidName.charAt(0)}
          </span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-ink">{kidName}</p>
          <p className="text-xs text-ink-soft">{t.admin.walletBalance}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xl font-extrabold text-ink num">
          <Coin size={20} />
          <span dir="ltr">{balance}</span>
        </span>
      </div>

      <form
        action={(formData) => {
          // Inject sign onto the amount based on the active mode.
          const raw = Math.abs(
            Number.parseInt(String(formData.get('amount') ?? '0'), 10) || 0,
          );
          const signed = mode === 'debit' ? -raw : raw;
          formData.set('amount', String(signed));
          // useActionState dispatch — pass the same FormData with the corrected sign.
          return action(formData);
        }}
        className="space-y-3 bg-card rounded-2xl shadow-card border border-rule p-5"
      >
        <input type="hidden" name="kidId" value={kidId} />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('credit')}
            className={`flex-1 rounded-full py-2 px-4 text-sm font-bold transition ${
              mode === 'credit'
                ? 'bg-mint text-card shadow-cta-mint'
                : 'bg-card text-ink border border-rule'
            }`}
          >
            {t.admin.jokerCredit}
          </button>
          <button
            type="button"
            onClick={() => setMode('debit')}
            className={`flex-1 rounded-full py-2 px-4 text-sm font-bold transition ${
              mode === 'debit'
                ? 'bg-pink text-card shadow-cta-pink'
                : 'bg-card text-ink border border-rule'
            }`}
          >
            {t.admin.jokerDebit}
          </button>
        </div>

        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.admin.jokerAmount}</span>
          <input
            ref={amountInputRef}
            type="text"
            name="amount"
            required
            inputMode="numeric"
            pattern="[0-9]+"
            dir="ltr"
            className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-lg font-bold text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          />
          <span className="block text-[11px] text-ink-faded mt-1">
            {t.admin.jokerAmountHelp}
          </span>
        </label>

        <label className="block">
          <span className="block text-xs text-ink-soft mb-1">{t.admin.jokerReason}</span>
          <textarea
            name="reason"
            required
            minLength={1}
            maxLength={500}
            rows={3}
            placeholder={t.admin.jokerReasonPlaceholder}
            className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
          />
        </label>

        {state?.ok === false && (
          <p className="text-xs text-pink-dark" role="alert">
            {state.error === 'reason_required'
              ? t.admin.reasonRequired
              : state.error === 'invalid_amount'
                ? t.longTerm.invalidQuantity
                : t.home.errorTryAgain}
          </p>
        )}

        {state?.ok === true && (
          <p className="text-sm text-mint-dark font-bold" role="status">
            {state.amount > 0 ? t.admin.jokerCreditDone : t.admin.jokerDebitDone}{' '}
            <span className="num" dir="ltr">
              {Math.abs(state.amount)}
            </span>{' '}
            · {t.admin.walletBalance}:{' '}
            <span className="num" dir="ltr">
              {Math.max(0, state.balanceAfter)}
            </span>
            {state.clampedAmount && state.clampedAmount > 0 && (
              <>
                {' '}
                <span className="text-ink-soft font-normal">
                  (clamped <span className="num" dir="ltr">{state.clampedAmount}</span>)
                </span>
              </>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className={`font-bold rounded-full py-2 px-5 text-sm transition disabled:opacity-60 ${
            mode === 'credit'
              ? 'bg-mint text-card shadow-cta-mint'
              : 'bg-pink text-card shadow-cta-pink'
          }`}
        >
          {pending
            ? '…'
            : mode === 'credit'
              ? t.admin.jokerCredit
              : t.admin.jokerDebit}
        </button>
      </form>
    </div>
  );
}
