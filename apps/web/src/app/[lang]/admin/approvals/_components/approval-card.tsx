/**
 * Admin · approval queue item (client component).
 *
 * Three states:
 *   - pending (default) — shows photo + approve / deny buttons.
 *   - approving — disabled buttons + spinner-like label.
 *   - resolved (this session) — hides the row OR shows the success/failure
 *     state in place. We use the same dual-useEffect pattern as the kid task
 *     card so the most recent action wins.
 *
 * The deny path expands a small reason textarea inline. The action requires
 * a non-empty reason (CHECK constraint + app-layer guard).
 */

'use client';

import { useActionState, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  approveSubmissionAction,
  denySubmissionAction,
  type ApproveSubmissionState,
  type DenySubmissionState,
} from '../../../../../lib/evidence/admin-actions';

interface Props {
  submissionId: string;
  evidenceId: string | null;
  kidName: string;
  kidColor: string;
  taskTitleHe: string;
  taskTitleEn: string;
  coinValue: number;
  submittedAt: string;
  lang: 'he' | 'en';
  t: Dictionary;
}

export function ApprovalCard(props: Props) {
  const { lang, t } = props;
  const title = lang === 'he' ? props.taskTitleHe : props.taskTitleEn;

  const [approveState, approveAction, approving] = useActionState<
    ApproveSubmissionState | undefined,
    FormData
  >(approveSubmissionAction, undefined);
  const [denyState, denyAction, denying] = useActionState<
    DenySubmissionState | undefined,
    FormData
  >(denySubmissionAction, undefined);

  const [showDeny, setShowDeny] = useState(false);

  // Resolved this session — collapse the card visually.
  const resolved = approveState?.ok === true || denyState?.ok === true;
  const alreadyResolvedByOther =
    (approveState?.ok === false && approveState.error === 'already_resolved') ||
    (denyState?.ok === false && denyState.error === 'already_resolved');

  if (resolved) {
    return (
      <li className="bg-mint-soft border border-mint-pale rounded-2xl shadow-card p-4">
        <div className="flex items-center gap-3">
          <KidPip name={props.kidName} color={props.kidColor} />
          <p className="text-sm text-mint-dark font-bold">
            {approveState?.ok === true
              ? `+${approveState.coinsAwarded} → ${props.kidName} · ${title}`
              : `${title} · ${t.admin.denyReason}: ${formDataValue(denyAction)?.toString() ?? ''}`}
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="bg-card rounded-2xl shadow-card p-4 border border-rule space-y-3">
      <header className="flex items-center gap-3">
        <KidPip name={props.kidName} color={props.kidColor} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink break-words leading-snug">{title}</h3>
          <p className="text-xs text-ink-soft">
            {props.kidName} · <span dir="ltr" className="num">{props.submittedAt}</span>
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-pale text-[#7A5D10] num">
          <span dir="ltr">+{props.coinValue}</span>
        </span>
      </header>

      {props.evidenceId && (
        <div className="rounded-2xl overflow-hidden border border-rule bg-bg flex items-center justify-center max-h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/evidence/${props.evidenceId}`}
            alt={title}
            className="max-h-96 w-auto object-contain"
          />
        </div>
      )}

      {alreadyResolvedByOther && (
        <p className="text-xs text-ink-soft" role="status">
          {t.admin.alreadyResolved}
        </p>
      )}

      {!showDeny ? (
        <div className="flex items-center gap-2">
          <form action={approveAction}>
            <input type="hidden" name="submissionId" value={props.submissionId} />
            <button
              type="submit"
              disabled={approving || denying}
              className="bg-mint text-card font-bold rounded-full py-2 px-5 text-sm shadow-cta-mint transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
            >
              {approving ? '…' : t.admin.approve}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setShowDeny(true)}
            disabled={approving || denying}
            className="bg-card text-ink font-bold rounded-full py-2 px-5 text-sm border border-rule hover:border-pink-pale transition disabled:opacity-60"
          >
            {t.admin.deny}
          </button>
        </div>
      ) : (
        <form action={denyAction} className="space-y-2">
          <input type="hidden" name="submissionId" value={props.submissionId} />
          <label className="block">
            <span className="block text-xs text-ink-soft mb-1">
              {t.admin.denyReason}
            </span>
            <textarea
              name="denyReason"
              required
              minLength={1}
              maxLength={500}
              rows={2}
              placeholder={t.admin.denyReasonPlaceholder}
              className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
            />
          </label>
          {denyState?.ok === false && denyState.error === 'reason_required' && (
            <p className="text-xs text-pink-dark" role="alert">
              {t.admin.denyReasonRequired}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={denying}
              className="bg-pink text-card font-bold rounded-full py-2 px-5 text-sm shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
            >
              {denying ? '…' : t.admin.deny}
            </button>
            <button
              type="button"
              onClick={() => setShowDeny(false)}
              disabled={denying}
              className="text-xs text-ink-soft underline-offset-4 hover:underline"
            >
              {t.common.cancel}
            </button>
          </div>
        </form>
      )}
    </li>
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

// Type-only stub: extract a value from the most recent form data. Used so the
// success-card can echo the deny reason without re-fetching. The actual
// FormData isn't accessible from useActionState's state value (Next strips
// it), so this is intentionally a no-op stub — the deny success path just
// shows "denied" with no echoed reason. (Future polish.)
function formDataValue(_action: unknown): string | undefined {
  return undefined;
}
