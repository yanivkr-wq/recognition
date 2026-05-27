/**
 * Player popup message — a dismissible card shown over the kid's home when an
 * admin has an active message targeting them (or a broadcast). Two actions:
 *   - "Later" closes it for now (it returns next visit).
 *   - "Got it, don't show again" records a per-kid dismissal so it never
 *     returns (dismissPlayerMessageAction).
 *
 * Body renders dir="auto" so Hebrew right-aligns / English left-aligns.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '@reco/shared/i18n';
import { dismissPlayerMessageAction } from '../../../lib/player-messages/actions';

interface Props {
  messageId: string;
  title: string | null;
  body: string;
  t: Dictionary;
}

export function PlayerMessagePopup({ messageId, title, body, t }: Props) {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) return null;

  function dismiss() {
    const fd = new FormData();
    fd.set('messageId', messageId);
    start(async () => {
      await dismissPlayerMessageAction(undefined, fd);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card w-full max-w-sm rounded-3xl shadow-card p-6 space-y-4 motion-safe:animate-[recoMsgPop_.4s_cubic-bezier(.34,1.56,.64,1)]">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-3xl" aria-hidden="true">💌</span>
          {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
        </div>
        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap" dir="auto">
          {body}
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className="w-full bg-pink text-card font-bold rounded-full py-2.5 text-sm shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
          >
            {t.playerMsg.popupDismiss}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="w-full text-ink-soft text-sm py-1.5 hover:underline underline-offset-4"
          >
            {t.playerMsg.popupClose}
          </button>
        </div>
      </div>
      <style>{`@keyframes recoMsgPop { 0% { transform: scale(.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
