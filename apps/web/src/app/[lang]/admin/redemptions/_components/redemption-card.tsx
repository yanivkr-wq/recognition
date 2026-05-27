/**
 * Admin · redemption card (client component).
 *
 * Three modes:
 *   - pending  → mark received + cancel-with-reason buttons.
 *   - received → refund-with-reason button (rare, but supported per
 *                BUILD-PLAN §6 actions list).
 *   - closed   → readonly summary of cancelled / refunded with the parent's
 *                reason inline.
 *
 * The FCFS contract on the server returns `already_resolved` when another
 * parent already moved the redemption; we surface that as a calm
 * "state already changed" message rather than an error.
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  adminMarkReceivedAction,
  cancelRedemptionAction,
  refundRedemptionAction,
  type AdminMarkReceivedState,
  type CancelRedemptionState,
  type RefundRedemptionState,
} from '../../../../../lib/redeem/admin-actions';
import { Coin } from '../../../../../components/coin';

type Mode = 'pending' | 'received' | 'closed';

interface Props {
  mode: Mode;
  redemptionId: string;
  kidName: string;
  kidColor: string;
  titleHe: string;
  titleEn: string;
  coinCost: number;
  redeemedAt: string;
  // Optional fields for the resolved modes.
  receivedAt?: string | null;
  receivedByName?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  cancelledByName?: string | null;
  refundedAt?: string | null;
  refundReason?: string | null;
  refundedByName?: string | null;
  status?: 'pending_delivery' | 'received' | 'cancelled' | 'refunded';
  lang: 'he' | 'en';
  t: Dictionary;
}

export function RedemptionCard(props: Props) {
  const { lang, t } = props;
  const title = lang === 'he' ? props.titleHe : props.titleEn;

  const [receiveState, receiveAction, receiving] = useActionState<
    AdminMarkReceivedState | undefined,
    FormData
  >(adminMarkReceivedAction, undefined);
  const [cancelState, cancelAction, cancelling] = useActionState<
    CancelRedemptionState | undefined,
    FormData
  >(cancelRedemptionAction, undefined);
  const [refundState, refundAction, refunding] = useActionState<
    RefundRedemptionState | undefined,
    FormData
  >(refundRedemptionAction, undefined);

  const [showCancel, setShowCancel] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  // Once any action lands successfully in THIS session, collapse the card
  // into a brief confirmation. The server-side revalidatePath also fires;
  // when the user navigates back the queue is fresh.
  const resolvedHere =
    receiveState?.ok === true || cancelState?.ok === true || refundState?.ok === true;
  const alreadyResolvedByOther =
    (receiveState?.ok === false && receiveState.error === 'already_resolved') ||
    (cancelState?.ok === false && cancelState.error === 'already_resolved') ||
    (refundState?.ok === false && refundState.error === 'already_resolved') ||
    (cancelState?.ok === false && cancelState.error === 'invalid_state') ||
    (refundState?.ok === false && refundState.error === 'invalid_state');

  if (resolvedHere) {
    const label =
      receiveState?.ok === true
        ? t.admin.markReceived
        : cancelState?.ok === true
          ? t.admin.cancelRedemption
          : t.admin.refundRedemption;
    return (
      <li className="bg-mint-soft border border-mint-pale rounded-2xl shadow-card p-3 flex items-center gap-3">
        <KidPip name={props.kidName} color={props.kidColor} />
        <p className="text-sm text-mint-dark font-bold">
          {label} · {title}
        </p>
      </li>
    );
  }

  // --- closed (cancelled / refunded readonly summary) ----------------------
  if (props.mode === 'closed') {
    const isCancelled = props.status === 'cancelled';
    const ts = isCancelled ? props.cancelledAt : props.refundedAt;
    const by = isCancelled ? props.cancelledByName : props.refundedByName;
    const reason = isCancelled ? props.cancelReason : props.refundReason;
    const reasonLabel = isCancelled ? t.admin.cancelReason : t.admin.refundReason;
    const statusLabel = isCancelled ? t.admin.cancelledTab : t.admin.refundedTab;
    return (
      <li className="bg-pink-soft border border-pink-pale rounded-2xl p-3 space-y-2">
        <header className="flex items-center gap-3">
          <KidPip name={props.kidName} color={props.kidColor} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-ink text-sm break-words leading-snug">{title}</p>
            <p className="text-[11px] text-ink-soft mt-0.5">
              {statusLabel} · <span dir="ltr">{ts ? fmt(ts, lang) : ''}</span>
              {by && ` · ${by}`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft num">
            <Coin size={14} />
            <span dir="ltr">{props.coinCost}</span>
          </span>
        </header>
        {reason && (
          <p className="text-xs text-ink leading-snug bg-card rounded-xl p-2 border border-rule">
            <span className="text-ink-soft me-1">{reasonLabel}:</span>
            {reason}
          </p>
        )}
      </li>
    );
  }

  // --- pending or received ------------------------------------------------
  const isReceived = props.mode === 'received';
  return (
    <li className="bg-card rounded-2xl shadow-card p-4 border border-rule space-y-3">
      <header className="flex items-center gap-3">
        <KidPip name={props.kidName} color={props.kidColor} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink break-words leading-snug">{title}</h3>
          <p className="text-xs text-ink-soft">
            {props.kidName} · {t.admin.redeemedAt}{' '}
            <span dir="ltr" className="num">
              {fmt(props.redeemedAt, lang)}
            </span>
            {isReceived && props.receivedAt && (
              <>
                {' · '}
                {t.redeem.receivedAt}{' '}
                <span dir="ltr" className="num">
                  {fmt(props.receivedAt, lang)}
                </span>
                {props.receivedByName && ` · ${props.receivedByName}`}
              </>
            )}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-pale text-[#7A5D10] num">
          <span dir="ltr">{props.coinCost}</span>
        </span>
      </header>

      {alreadyResolvedByOther && (
        <p className="text-xs text-ink-soft" role="status">
          {t.admin.invalidState}
        </p>
      )}

      {!showCancel && !showRefund && (
        <div className="flex items-center gap-2 flex-wrap">
          {!isReceived && (
            <>
              <form action={receiveAction}>
                <input type="hidden" name="redemptionId" value={props.redemptionId} />
                <button type="submit" disabled={receiving || cancelling} className="btn-admin-mint">
                  {receiving ? '…' : t.admin.markReceived}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                disabled={receiving || cancelling}
                className="btn-admin-secondary"
              >
                {t.admin.cancelRedemption}
              </button>
            </>
          )}
          {isReceived && (
            <button
              type="button"
              onClick={() => setShowRefund(true)}
              disabled={refunding}
              className="btn-admin-secondary"
            >
              {t.admin.refundRedemption}
            </button>
          )}
        </div>
      )}

      {showCancel && (
        <ReasonForm
          action={cancelAction}
          pending={cancelling}
          redemptionId={props.redemptionId}
          label={t.admin.cancelReason}
          placeholder={t.admin.cancelReasonPlaceholder}
          missing={cancelState?.ok === false && cancelState.error === 'reason_required'}
          missingText={t.admin.reasonRequired}
          submitText={t.admin.cancelRedemption}
          onCancel={() => setShowCancel(false)}
          t={t}
        />
      )}

      {showRefund && (
        <ReasonForm
          action={refundAction}
          pending={refunding}
          redemptionId={props.redemptionId}
          label={t.admin.refundReason}
          placeholder={t.admin.refundReasonPlaceholder}
          missing={refundState?.ok === false && refundState.error === 'reason_required'}
          missingText={t.admin.reasonRequired}
          submitText={t.admin.refundRedemption}
          onCancel={() => setShowRefund(false)}
          t={t}
        />
      )}
    </li>
  );
}

function ReasonForm(props: {
  action: (formData: FormData) => void;
  pending: boolean;
  redemptionId: string;
  label: string;
  placeholder: string;
  missing: boolean;
  missingText: string;
  submitText: string;
  onCancel: () => void;
  t: Dictionary;
}) {
  return (
    <form action={props.action} className="space-y-2">
      <input type="hidden" name="redemptionId" value={props.redemptionId} />
      <label className="block">
        <span className="block text-xs text-ink-soft mb-1">{props.label}</span>
        <textarea
          name="reason"
          required
          minLength={1}
          maxLength={500}
          rows={2}
          placeholder={props.placeholder}
          className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
        />
      </label>
      {props.missing && (
        <p className="text-xs text-pink-dark" role="alert">
          {props.missingText}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={props.pending} className="btn-admin-danger">
          {props.pending ? '…' : props.submitText}
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          disabled={props.pending}
          className="btn-admin-ghost"
        >
          {props.t.common.cancel}
        </button>
      </div>
    </form>
  );
}

function KidPip({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      <span
        className="text-base font-bold text-card"
        style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
      >
        {name.charAt(0)}
      </span>
    </div>
  );
}

function fmt(iso: string, lang: 'he' | 'en'): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
