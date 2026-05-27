/**
 * Player popup message — a dismissible card shown over the kid's home when an
 * admin has an active message targeting them (or a broadcast). One action: a
 * Close button (and a matching ✕ in the corner) records a per-kid dismissal so
 * the message doesn't nag on every visit (dismissPlayerMessageAction).
 *
 * Body is centered so the card reads as one tidy note in both languages.
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
      <div className="relative bg-card w-full max-w-sm rounded-3xl shadow-card p-6 space-y-4 motion-safe:animate-[recoMsgPop_.4s_cubic-bezier(.34,1.56,.64,1)]">
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          aria-label={t.playerMsg.popupClose}
          className="absolute top-3 end-3 grid place-items-center w-8 h-8 rounded-full text-ink-soft hover:bg-rule-soft hover:text-ink transition disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-3xl" aria-hidden="true">💌</span>
          {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
        </div>
        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap text-center" dir="auto">
          {body}
        </p>
        <div className="pt-1">
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className="w-full bg-pink text-card font-bold rounded-full py-2.5 text-sm shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
          >
            {t.playerMsg.popupClose}
          </button>
        </div>
      </div>
      <style>{`@keyframes recoMsgPop { 0% { transform: scale(.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
