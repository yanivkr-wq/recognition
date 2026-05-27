/**
 * Kid task card — interactive (client component).
 *
 * 2026-05-23 redesign (Lily's "Variant A + tweaks" pick):
 *   - Title is the visual focus. Line-clamp-2 instead of truncate so a
 *     long Hebrew title like "לעזור לאחות הקטנה בלימודים" reads fully.
 *   - Action buttons became ICONS (was pink-text "סיימתי!" / outlined "↶
 *     undo"). 44×44 min tap target for a 10yo thumb (WCAG AAA).
 *   - DONE state: the task type icon on the start side disappears and is
 *     replaced by the small undo icon button. The end side's action slot
 *     becomes a BIG green check-circle status badge — the action position
 *     literally becomes the celebration. Mint-tinted background stays.
 *   - The done badge scales in on mount (motion-safe) so the completion
 *     feels celebratory; reduced-motion users see the final state.
 *
 * State machine for evidence-required tasks (Phase 5 extends Phase 3):
 *   todo        → check-circle icon button (action)
 *   needsPhoto  → file picker + "Send for approval" (pending completion,
 *                 no submission yet)
 *   pending     → "Waiting for parent" pill (submission exists, awaiting)
 *   done        → mint card + BIG green checkmark + small undo icon
 *   denied      → pink-soft card + parent's reason + check-circle button
 *                 (effectively a "try again" via the same complete action)
 *   locked      → greyed card, deadline-passed text, no action
 *
 * Non-evidence tasks skip the needsPhoto / denied states — they go
 * straight from todo → done via Phase 3's completeTaskAction.
 *
 * All actions go through React 19's useActionState (per the locked
 * feedback memory: signature must be (prevState, FormData) and consumed
 * via useActionState directly — wrapping a server action in a client
 * async function silently strips its server-action-ness). A successful
 * action returns the new balance which the parent receives via the
 * `onBalance` callback so the wallet number animates immediately even
 * before revalidatePath re-renders the server tree.
 */

'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '@reco/shared/i18n';
import {
  completeTaskAction,
  undoTaskCompletionAction,
  type CompleteTaskState,
  type UndoTaskState,
} from '../../../lib/tasks/actions';
import {
  submitEvidenceAction,
  type SubmitEvidenceState,
} from '../../../lib/evidence/actions';
import { Coin } from '../../../components/coin';
import { TaskIcon } from '../../../components/task-icon';
import { celebrate } from '../../../lib/celebrate';

export type TaskCardStatus = 'todo' | 'needsPhoto' | 'pending' | 'done' | 'denied' | 'locked';

interface Props {
  assignmentId: string;
  completionId: string | null;
  status: TaskCardStatus;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
  coinValue: number;
  evidenceRequired: boolean;
  denyReason: string | null;
  deadlineTime?: string | null;
  lang: 'he' | 'en';
  t: Dictionary;
  onBalance?: (newBalance: number) => void;
  /** Fired once a successful completion lands. Parent (kid-home) uses this
   *  to track when the active list just hit zero and fire a bigger
   *  "all done!" confetti burst. */
  onLastActive?: () => void;
}

export function TaskCard(props: Props) {
  const { assignmentId, completionId, status, color, lang, t, coinValue } = props;
  const title = lang === 'he' ? props.titleHe : props.titleEn;

  const [completeState, completeAction, completing] = useActionState<
    CompleteTaskState | undefined,
    FormData
  >(completeTaskAction, undefined);
  const [undoState, undoAction, undoing] = useActionState<
    UndoTaskState | undefined,
    FormData
  >(undoTaskCompletionAction, undefined);
  const [submitState, submitAction, submitting] = useActionState<
    SubmitEvidenceState | undefined,
    FormData
  >(submitEvidenceAction, undefined);

  const [fileName, setFileName] = useState<string | null>(null);
  // Local preview of the photo the kid just picked, so she can SEE what she's
  // sending before it goes to a parent (Lily's request). Object URL is revoked
  // when replaced + on unmount.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // One-tap photo submission (Lily's pick): on a photo task, tapping the
  // action opens the camera; once a photo is picked we create the completion
  // AND attach the evidence in one go, so it lands in the parent's Approvals
  // queue (kids were instead using the Feedback button). If the second step
  // fails, the task is left in `needsPhoto` so the existing Add-photo flow can
  // recover it.
  const router = useRouter();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  async function captureForApproval(file: File) {
    setPhotoErr(null);
    setPhotoBusy(true);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    try {
      const fd1 = new FormData();
      fd1.set('assignmentId', assignmentId);
      const r1 = await completeTaskAction(undefined, fd1);
      if (!r1.ok) {
        setPhotoErr(
          r1.error === 'already_done'
            ? t.home.alreadyDone
            : r1.error === 'deadline_passed'
              ? t.home.deadlinePassed
              : t.home.errorTryAgain,
        );
        setPhotoBusy(false);
        return;
      }
      const fd2 = new FormData();
      fd2.set('completionId', r1.completionId);
      fd2.set('file', file);
      const r2 = await submitEvidenceAction(undefined, fd2);
      if (!r2.ok) {
        setPhotoErr(
          r2.error === 'too_large'
            ? t.home.photoTooLarge
            : r2.error === 'mime_not_allowed'
              ? t.home.photoBadFormat
              : t.home.photoUploadError,
        );
        setPhotoBusy(false);
        // Completion exists now → the card will re-render as needsPhoto so the
        // kid can retry the upload via the Add-photo flow.
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setPhotoErr(t.home.errorTryAgain);
      setPhotoBusy(false);
    }
  }

  // Three effects (one per action) so the most recent action wins the wallet
  // pulse. A single combined effect always favors the earlier-declared
  // state — see Phase 3's task-card lesson (mirrored in Phase 4's long-term
  // card).
  const onBalance = props.onBalance;
  useEffect(() => {
    if (onBalance && completeState?.ok === true) onBalance(completeState.balanceAfter);
  }, [completeState, onBalance]);
  useEffect(() => {
    if (onBalance && undoState?.ok === true) onBalance(undoState.balanceAfter);
  }, [undoState, onBalance]);

  const containerClass =
    status === 'done'
      ? 'bg-mint-soft border-mint-pale'
      : status === 'pending'
        ? 'bg-pink-soft border-pink-pale'
        : status === 'needsPhoto'
          ? 'bg-yellow-pale border-[#FFE9A8]'
          : status === 'denied'
            ? 'bg-pink-soft border-pink-pale'
            : status === 'locked'
              ? 'bg-bg border-rule opacity-60'
              : 'bg-card border-rule';

  const showAlreadyDone =
    completeState?.ok === false && completeState.error === 'already_done';
  const showDeadlinePassed =
    completeState?.ok === false && completeState.error === 'deadline_passed';
  const showInternalError =
    (completeState?.ok === false && completeState.error === 'internal') ||
    (undoState?.ok === false && undoState.error === 'internal') ||
    (submitState?.ok === false && submitState.error === 'internal');
  const showUploadError =
    submitState?.ok === false &&
    (submitState.error === 'too_large' ||
      submitState.error === 'mime_not_allowed' ||
      submitState.error === 'no_file');

  const isDone = status === 'done' && !!completionId;

  return (
    <li
      className={`rounded-2xl border shadow-card p-4 transition-colors ${containerClass}`}
    >
      <div className="flex items-start gap-3">
        {/* ─── START COLUMN (visually right in RTL) ─────────────────────────
            Active states: task type icon. Done state: small undo button
            (so the task type fades away and the kid sees "I can undo"
            from the same visual position).
        */}
        <div className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
          {isDone ? (
            <UndoIconButton
              completionId={completionId!}
              undoAction={undoAction}
              undoing={undoing}
              label={t.home.undo}
            />
          ) : (
            <TaskIcon
              iconKey={props.iconKey}
              color={color}
              title={title}
              size={36}
            />
          )}
        </div>

        {/* ─── MIDDLE COLUMN: title + status sub-line ─────────────────── */}
        <div className="flex-1 min-w-0 py-1 space-y-0.5">
          <div className="flex items-start gap-2 flex-wrap">
            {/* line-clamp-2: full title, never truncated to 6 chars. */}
            <h3 className="font-bold text-ink text-[15px] leading-snug line-clamp-2 break-words">
              {title}
            </h3>
            {props.evidenceRequired && status !== 'done' && status !== 'denied' && (
              <span className="text-[10px] uppercase tracking-wider text-pink-dark shrink-0 mt-1">
                {t.home.needsPhoto}
              </span>
            )}
          </div>
          {status === 'pending' ? (
            <p className="text-xs text-ink-soft">{t.home.waitingApproval}</p>
          ) : status === 'denied' ? (
            <p className="text-xs text-pink-dark">{t.home.deniedNeedsRetry}</p>
          ) : status === 'locked' ? (
            <p className="text-xs text-ink-soft">
              {t.home.deadlinePassed}{' '}
              <span dir="ltr" className="num">
                {props.deadlineTime?.slice(0, 5)}
              </span>
            </p>
          ) : photoBusy ? (
            <p className="text-xs text-ink-soft">{t.home.uploadingPhoto}</p>
          ) : photoErr ? (
            <p className="text-xs text-pink-dark">{photoErr}</p>
          ) : status === 'todo' && props.deadlineTime ? (
            <Countdown deadline={props.deadlineTime} t={t} />
          ) : showAlreadyDone ? (
            <p className="text-xs text-pink-dark">{t.home.alreadyDone}</p>
          ) : showDeadlinePassed ? (
            <p className="text-xs text-pink-dark">{t.home.deadlinePassed}</p>
          ) : showUploadError ? (
            <p className="text-xs text-pink-dark">
              {submitState?.ok === false && submitState.error === 'too_large'
                ? t.home.photoTooLarge
                : submitState?.ok === false &&
                    submitState.error === 'mime_not_allowed'
                  ? t.home.photoBadFormat
                  : t.home.photoUploadError}
            </p>
          ) : showInternalError ? (
            <p className="text-xs text-pink-dark">{t.home.errorTryAgain}</p>
          ) : null}
        </div>

        {/* ─── END COLUMN (visually left in RTL): coin chip + action ─── */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold num whitespace-nowrap ${
              isDone
                ? 'bg-mint-pale text-mint-dark'
                : 'bg-yellow-pale text-[#7A5D10]'
            }`}
          >
            <Coin size={14} />
            <span dir="ltr">
              {isDone ? '+' : ''}
              {coinValue}
            </span>
          </span>

          {status === 'todo' && props.evidenceRequired && (
            <CameraCaptureButton
              busy={photoBusy}
              label={t.home.addPhoto}
              onFile={captureForApproval}
            />
          )}

          {status === 'todo' && !props.evidenceRequired && (
            <form action={completeAction}>
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <CheckIconButton
                pending={completing}
                onTap={(rect) => {
                  void celebrate({
                    intensity: 'small',
                    origin: {
                      x: (rect.left + rect.width / 2) / window.innerWidth,
                      y: (rect.top + rect.height / 2) / window.innerHeight,
                    },
                  });
                  props.onLastActive?.();
                }}
                label={t.home.iDidIt}
              />
            </form>
          )}

          {isDone && <BigDoneBadge label={t.home.done} />}

          {/* needsPhoto state: kid tapped "I did it" but hasn't uploaded
              the photo yet. The completion row exists; we offer a clear
              "back out" affordance so a kid who can't / changed their
              mind isn't stuck staring at a file picker. */}
          {status === 'needsPhoto' && completionId && (
            <UndoIconButton
              completionId={completionId}
              undoAction={undoAction}
              undoing={undoing}
              label={t.home.undo}
            />
          )}

          {status === 'denied' && completionId && (
            <form action={undoAction}>
              <input type="hidden" name="completionId" value={completionId} />
              <CheckIconButton
                pending={undoing}
                label={t.home.iDidIt}
              />
            </form>
          )}
        </div>
      </div>

      {/* One-tap capture preview — the photo the kid just took, while it's
          being sent for approval. */}
      {status === 'todo' && previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={fileName ?? ''}
          className="mt-3 max-h-44 w-auto rounded-xl border border-rule object-contain"
        />
      )}

      {/* Photo-upload affordance — only when the kid has a pending completion
          that's still missing its submission. The form posts multipart/form-data
          to submitEvidenceAction. */}
      {status === 'needsPhoto' && completionId && (
        <form
          action={submitAction}
          encType="multipart/form-data"
          className="space-y-1.5 mt-3"
        >
          <input type="hidden" name="completionId" value={completionId} />
          <div className="flex items-center gap-2">
            <label className="bg-card text-ink font-bold rounded-full py-2 px-4 border border-rule cursor-pointer hover:border-pink-pale transition text-xs whitespace-nowrap shrink-0">
              {t.home.addPhoto}
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                capture="environment"
                required
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0] ?? null;
                  setFileName(f?.name ?? null);
                  setPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return f ? URL.createObjectURL(f) : null;
                  });
                }}
                className="sr-only"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !fileName}
              className="flex-1 bg-pink text-card font-bold rounded-full py-2 px-4 text-xs shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60 whitespace-nowrap"
            >
              {submitting ? t.home.uploadingPhoto : t.home.sendPhoto}
            </button>
          </div>
          {/* The kid sees the photo she's about to send. */}
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={fileName ?? ''}
              className="mt-1 max-h-44 w-auto rounded-xl border border-rule object-contain"
            />
          )}
        </form>
      )}

      {/* Parent's denial reason — surfaced inline so the kid can act on it
          before tapping the check button to retry. */}
      {status === 'denied' && props.denyReason && (
        <p className="text-sm text-ink leading-snug bg-card rounded-xl border border-rule p-3 mt-3">
          {props.denyReason}
        </p>
      )}
    </li>
  );
}

// ─── Action sub-components ────────────────────────────────────────────────

/** Small pink circular "done" action button. 44×44 hit area, 28px visual
 *  diameter — matches Material/iOS touch-target guidance for kids. */
function CheckIconButton({
  pending,
  onTap,
  label,
}: {
  pending: boolean;
  onTap?: (rect: DOMRect) => void;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      onClick={
        onTap
          ? (e) => onTap((e.currentTarget as HTMLElement).getBoundingClientRect())
          : undefined
      }
      className="relative w-11 h-11 rounded-full flex items-center justify-center bg-pink text-card shadow-cta-pink transition active:scale-95 disabled:opacity-60 disabled:scale-100"
    >
      {pending ? (
        <span className="text-card text-xs font-bold">…</span>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 10.5l3.5 3.5L15 7"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/** Photo-task action: a pink circular camera button that opens the device
 *  camera/picker. On pick it fires the one-tap capture→complete→submit flow.
 *  It's a <label> wrapping a hidden file input so a single tap opens the
 *  camera (no intermediate "I did it" step that kids were getting lost in). */
function CameraCaptureButton({
  busy,
  label,
  onFile,
}: {
  busy: boolean;
  label: string;
  onFile: (file: File) => void;
}) {
  return (
    <label
      aria-label={label}
      className="relative w-11 h-11 rounded-full flex items-center justify-center bg-pink text-card shadow-cta-pink transition active:scale-95 cursor-pointer aria-disabled:opacity-60"
      aria-disabled={busy}
    >
      {busy ? (
        <span className="text-card text-xs font-bold">…</span>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2l1.2-1.8A1 1 0 0 1 8.5 4.7h7a1 1 0 0 1 .8.5L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12.5" r="3.2" stroke="white" strokeWidth="2" />
        </svg>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={busy}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = '';
        }}
        className="sr-only"
      />
    </label>
  );
}

/** Small undo (counter-clockwise arrow) icon button. Used in the start
 *  column when status === 'done' — the position the task-type icon used
 *  to occupy. Fades in on mount so it feels arrival-ed rather than swapped. */
function UndoIconButton({
  completionId,
  undoAction,
  undoing,
  label,
}: {
  completionId: string;
  undoAction: (formData: FormData) => void;
  undoing: boolean;
  label: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <form action={undoAction}>
      <input type="hidden" name="completionId" value={completionId} />
      <button
        type="submit"
        disabled={undoing}
        aria-label={label}
        className={`w-11 h-11 rounded-full flex items-center justify-center bg-card border border-rule text-mint-dark transition active:scale-95 disabled:opacity-60 motion-safe:transition-opacity motion-safe:duration-300 ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {undoing ? (
          <span className="text-mint-dark text-xs font-bold">…</span>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            {/* curved arrow pointing left+up — semantic "go back" */}
            <path
              d="M5 9.5 L5 5 L9.5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 6 C9 4.5 14 6 15 11 C15.8 15 12.5 16.5 9.5 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
      </button>
    </form>
  );
}

/** Big mint checkmark circle — the celebration state when status === 'done'.
 *  Sits where the action button used to be. Scales in on mount (motion-safe)
 *  so the completion feels triumphant. */
function BigDoneBadge({ label }: { label: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <span
      className={`w-11 h-11 rounded-full bg-mint flex items-center justify-center shrink-0 motion-safe:transition-transform motion-safe:duration-300 ${
        mounted ? 'scale-100' : 'scale-50'
      }`}
      aria-label={label}
      role="img"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 10.5l3.5 3.5L15 7"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Countdown for time-bound tasks (Fix 12a). Ticks every second so the kid
 * feels the live clock running down (9:21:59 → 9:21:58 → ...). Format:
 *   H:MM:SS when there's at least one full hour left
 *   MM:SS   when under an hour
 *   SS      when under a minute
 *
 * Switches to "deadline passed" copy once it crosses zero — the parent
 * server query also flips the card to status='locked' on the next render,
 * so this UI is transient.
 */
function Countdown({
  deadline,
  t,
}: {
  deadline: string;
  t: Dictionary;
}) {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    computeRemainingMs(deadline),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingMs(computeRemainingMs(deadline));
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (remainingMs <= 0) {
    return (
      <p className="text-xs text-pink-dark">
        {t.home.deadlinePassed}
      </p>
    );
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const time =
    hours > 0
      ? `${hours}:${pad(mins)}:${pad(secs)}`
      : mins > 0
        ? `${mins}:${pad(secs)}`
        : `${secs}`;
  const urgent = remainingMs < 30 * 60_000;
  const lead = urgent ? t.home.deadlineUrgent : t.home.deadlineSoon;
  return (
    <p
      className={`text-xs ${urgent ? 'text-pink-dark font-bold' : 'text-ink-soft'}`}
    >
      ⏰ {lead}{' '}
      <span className="num" dir="ltr">
        {time}
      </span>{' '}
      ({t.home.deadlineBy}{' '}
      <span className="num" dir="ltr">
        {deadline.slice(0, 5)}
      </span>
      )
    </p>
  );
}

function computeRemainingMs(deadline: string): number {
  // deadline is HH:MM or HH:MM:SS in household tz. Compare to "now" in the
  // same tz (kid's device tz === Asia/Jerusalem in practice; if they're
  // travelling the math still gets them an approximate countdown to the
  // local-time deadline, which is the spec we want).
  const [hStr, mStr, sStr] = deadline.split(':');
  const h = Number.parseInt(hStr ?? '0', 10);
  const m = Number.parseInt(mStr ?? '0', 10);
  const s = sStr ? Number.parseInt(sStr, 10) : 0;
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h,
    m,
    s,
  );
  return target.getTime() - now.getTime();
}
