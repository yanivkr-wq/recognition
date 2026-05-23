/**
 * Kid task card — interactive (client component).
 *
 * State machine for evidence-required tasks (Phase 5 extends Phase 3):
 *   todo        → "I did it" button (pink CTA per BRANDBOOK §6.1)
 *   needsPhoto  → file picker + "Send for approval" (pending completion, no
 *                 submission yet)
 *   pending     → "Waiting for parent" pill (submission exists, awaiting)
 *   done        → mint card + small undo link
 *   denied      → pink-soft card + parent's reason + "Try again" (undo)
 *
 * Non-evidence tasks skip the needsPhoto / denied states — they go straight
 * from todo → done via Phase 3's completeTaskAction.
 *
 * All actions go through React 19's useActionState (per the locked feedback
 * memory: signature must be (prevState, FormData) and consumed via
 * useActionState directly — wrapping a server action in a client async
 * function silently strips its server-action-ness). A successful action
 * returns the new balance which the parent receives via the `onBalance`
 * callback so the wallet number animates immediately even before
 * revalidatePath re-renders the server tree.
 */

'use client';

import { useActionState, useEffect, useState } from 'react';
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

  // Local file selection so the parent component can show the filename + a
  // disabled submit-until-file-chosen state. The FormData posted to the
  // server action includes the file from the <input>; we don't need to
  // manage the file content ourselves.
  const [fileName, setFileName] = useState<string | null>(null);

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
  // submitEvidenceAction doesn't credit coins — that fires on parent approval.

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

  return (
    <li
      className={`rounded-2xl border shadow-card p-4 space-y-3 ${containerClass}`}
    >
      <div className="flex items-center gap-3">
        <TaskIcon iconKey={props.iconKey} color={color} title={title} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-bold text-ink text-[15px] truncate">{title}</h3>
            {props.evidenceRequired && status !== 'done' && status !== 'denied' && (
              <span className="text-[10px] uppercase tracking-wider text-pink-dark shrink-0">
                {t.home.needsPhoto}
              </span>
            )}
          </div>
          {status === 'pending' ? (
            <p className="text-xs text-ink-soft mt-0.5">{t.home.waitingApproval}</p>
          ) : status === 'denied' ? (
            <p className="text-xs text-pink-dark mt-0.5">{t.home.deniedNeedsRetry}</p>
          ) : status === 'locked' ? (
            <p className="text-xs text-ink-soft mt-0.5">
              {t.home.deadlinePassed}{' '}
              <span dir="ltr" className="num">
                {props.deadlineTime?.slice(0, 5)}
              </span>
            </p>
          ) : status === 'todo' && props.deadlineTime ? (
            // Countdown displayed under the title while the kid still has
            // time. The Countdown component ticks every minute (every 10s
            // when under 5 min remain) so the kid sees the pressure mount.
            <Countdown deadline={props.deadlineTime} t={t} />
          ) : showAlreadyDone ? (
            <p className="text-xs text-pink-dark mt-0.5">{t.home.alreadyDone}</p>
          ) : showDeadlinePassed ? (
            <p className="text-xs text-pink-dark mt-0.5">{t.home.deadlinePassed}</p>
          ) : showUploadError ? (
            <p className="text-xs text-pink-dark mt-0.5">
              {submitState?.ok === false && submitState.error === 'too_large'
                ? t.home.photoTooLarge
                : submitState?.ok === false &&
                    submitState.error === 'mime_not_allowed'
                  ? t.home.photoBadFormat
                  : t.home.photoUploadError}
            </p>
          ) : showInternalError ? (
            <p className="text-xs text-pink-dark mt-0.5">{t.home.errorTryAgain}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold num ${
              status === 'done'
                ? 'bg-mint-pale text-mint-dark'
                : 'bg-yellow-pale text-[#7A5D10]'
            }`}
          >
            <Coin size={14} />
            <span dir="ltr">
              {status === 'done' && completionId ? '+' : ''}
              {coinValue}
            </span>
          </span>

          {status === 'todo' && (
            <form action={completeAction}>
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <button
                type="submit"
                disabled={completing}
                onClick={(e) => {
                  // Fix 4a: confetti at the moment of the tap, BEFORE the
                  // form action navigates state. The tap is the kid's joy
                  // moment; waiting for revalidatePath would unmount this
                  // card and the celebrate effect would never fire.
                  // Origin is the button's center in viewport coordinates
                  // so the burst comes from where the kid pressed.
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  void celebrate({
                    intensity: 'small',
                    origin: {
                      x: (r.left + r.width / 2) / window.innerWidth,
                      y: (r.top + r.height / 2) / window.innerHeight,
                    },
                  });
                  // If this completion drops active count to 1→0, kid-home
                  // fires the bigger burst.
                  props.onLastActive?.();
                }}
                className="bg-pink text-card font-bold rounded-full py-2 px-4 text-xs shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
              >
                {completing ? '…' : t.home.iDidIt}
              </button>
            </form>
          )}

          {status === 'done' && completionId && (
            <>
              {/* Big green checkmark replaces the pink CTA: clear "you got
                  it" affordance per Fix 2. */}
              <span
                className="w-9 h-9 rounded-full bg-mint flex items-center justify-center shrink-0"
                aria-label={t.home.done}
                role="img"
              >
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
              </span>
              {/* Undo as a proper bordered pill (Fix 3) — not a tiny link.
                  The "↶" glyph signals "go back" without needing copy. */}
              <form action={undoAction}>
                <input type="hidden" name="completionId" value={completionId} />
                <button
                  type="submit"
                  disabled={undoing}
                  className="inline-flex items-center gap-1 bg-card text-mint-dark border border-mint-pale font-bold rounded-full py-2 px-3 text-xs hover:bg-mint-pale transition disabled:opacity-60"
                  aria-label={t.home.undo}
                >
                  <span aria-hidden="true" className="text-base leading-none">↶</span>
                  {undoing ? '…' : t.home.undo}
                </button>
              </form>
            </>
          )}

          {status === 'denied' && completionId && (
            <form action={undoAction}>
              <input type="hidden" name="completionId" value={completionId} />
              <button
                type="submit"
                disabled={undoing}
                className="bg-pink text-card font-bold rounded-full py-2 px-4 text-xs shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
              >
                {undoing ? '…' : t.home.iDidIt}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Photo-upload affordance — only when the kid has a pending completion
          that's still missing its submission. The form posts multipart/form-data
          to submitEvidenceAction. */}
      {status === 'needsPhoto' && completionId && (
        // Fix 1: send + add-pic buttons live on the same row to save the
        // second line. The filename (when chosen) wraps under the row so
        // the kid still sees what they're sending without the layout
        // getting taller before they pick.
        <form action={submitAction} encType="multipart/form-data" className="space-y-1.5">
          <input type="hidden" name="completionId" value={completionId} />
          <div className="flex items-center gap-2">
            <label className="bg-card text-ink font-bold rounded-full py-2 px-4 border border-rule cursor-pointer hover:border-pink-pale transition text-xs whitespace-nowrap shrink-0">
              {t.home.addPhoto}
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                required
                onChange={(e) =>
                  setFileName(e.currentTarget.files?.[0]?.name ?? null)
                }
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
          {fileName && (
            <p className="text-[11px] text-ink-soft truncate" dir="ltr">
              {fileName}
            </p>
          )}
        </form>
      )}

      {/* Parent's denial reason — surfaced inline so the kid can act on it
          before tapping "Try again." */}
      {status === 'denied' && props.denyReason && (
        <p className="text-sm text-ink leading-snug bg-card rounded-xl border border-rule p-3">
          {props.denyReason}
        </p>
      )}
    </li>
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
    // 1-second tick. Cheap — one setInterval per visible time-bound task
    // and only when the kid's actually on the home page.
    const id = window.setInterval(() => {
      setRemainingMs(computeRemainingMs(deadline));
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (remainingMs <= 0) {
    return (
      <p className="text-xs text-pink-dark mt-0.5">
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
      className={`text-xs mt-0.5 ${urgent ? 'text-pink-dark font-bold' : 'text-ink-soft'}`}
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

function computeRemainingMs(deadlineHHMMSS: string): number {
  // Parse "HH:MM:SS" as today's wall-clock time in the BROWSER's local tz.
  // The kid's device is the household device; effectively this matches the
  // household IL clock. Off-by-a-zone bug for kids traveling abroad is
  // accepted v1.
  const [hh, mm, ss] = deadlineHHMMSS.split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(hh ?? 0, mm ?? 0, ss ?? 0, 0);
  return d.getTime() - Date.now();
}
