/**
 * Floating feedback button + modal — shown on every authenticated surface
 * (kid + admin) via the [lang] layout. Any principal can submit; only admins
 * see the triage list at /admin/feedback.
 *
 * The body textarea uses dir="auto" so Hebrew right-aligns and English
 * left-aligns automatically as the user types (Lily's request). Posts to
 * submitFeedbackAction via useActionState (multipart — carries the optional
 * image File). Sits above the kid bottom-nav (bottom-24) so it never overlaps.
 */

'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { submitFeedbackAction, type SubmitFeedbackState } from '../lib/feedback/actions';

const CATEGORIES = ['bug', 'ui_ux', 'feature'] as const;
type Category = (typeof CATEGORIES)[number];

function categoryLabel(t: Dictionary, c: Category): string {
  if (c === 'bug') return t.feedback.categoryBug;
  if (c === 'ui_ux') return t.feedback.categoryUiUx;
  return t.feedback.categoryFeature;
}

function errorText(t: Dictionary, state: SubmitFeedbackState | undefined): string | null {
  if (!state || state.ok) return null;
  switch (state.error) {
    case 'invalid_body':
      return t.feedback.errorBody;
    case 'too_large':
      return t.feedback.errorTooLarge;
    case 'mime_not_allowed':
      return t.feedback.errorMime;
    default:
      return t.feedback.errorGeneric;
  }
}

export function FeedbackButton({ t }: { t: Dictionary }) {
  const [open, setOpen] = useState(false);
  // Bumped on every open so the modal (and its useActionState) remounts fresh —
  // otherwise a successful submit leaves state.ok=true forever and the form is
  // stuck on the success message, blocking a second feedback (Pattern A).
  const [openKey, setOpenKey] = useState(0);

  function openModal() {
    setOpenKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={t.feedback.button}
        className="fixed bottom-24 end-4 z-30 flex items-center gap-2 rounded-full bg-pink text-card font-bold text-sm py-2.5 px-4 shadow-cta-pink hover:-translate-y-px transition"
      >
        <ChatIcon />
        <span>{t.feedback.button}</span>
      </button>

      {open && <FeedbackModal key={openKey} t={t} onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ t, onClose }: { t: Dictionary; onClose: () => void }) {
  const [category, setCategory] = useState<Category>('bug');
  const [state, action, pending] = useActionState<SubmitFeedbackState | undefined, FormData>(
    submitFeedbackAction,
    undefined,
  );

  // Close shortly after a successful submit.
  useEffect(() => {
    if (state?.ok) {
      const id = setTimeout(onClose, 1400);
      return () => clearTimeout(id);
    }
  }, [state, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.feedback.title}
    >
      <div
        className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-card p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{t.feedback.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.feedback.close}
            className="text-ink-soft hover:text-ink text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {state?.ok ? (
          <p className="text-mint-dark font-bold py-6 text-center">{t.feedback.success}</p>
        ) : (
          <form action={action} className="space-y-4">
            {/* Category chips */}
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-ink-soft mb-1">{t.feedback.categoryLabel}</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <label
                    key={c}
                    className={`rounded-full py-1.5 px-3 text-sm font-bold cursor-pointer transition border ${
                      category === c
                        ? 'bg-pink text-card border-pink shadow-cta-pink'
                        : 'bg-card text-ink border-rule hover:border-pink-pale'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c}
                      checked={category === c}
                      onChange={() => setCategory(c)}
                      className="sr-only"
                    />
                    {categoryLabel(t, c)}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Body — dir=auto auto-aligns by first strong character. */}
            <label className="block">
              <span className="block text-xs text-ink-soft mb-1">{t.feedback.bodyLabel}</span>
              <textarea
                name="body"
                required
                dir="auto"
                rows={4}
                placeholder={t.feedback.bodyPlaceholder}
                className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition resize-y"
              />
            </label>

            {/* Optional image */}
            <label className="block">
              <span className="block text-xs text-ink-soft mb-1">{t.feedback.attachImage}</span>
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-xs text-ink-soft file:me-3 file:rounded-full file:border-0 file:bg-pink-soft file:text-pink-dark file:font-bold file:py-1.5 file:px-3 file:cursor-pointer"
              />
            </label>

            {errorText(t, state) && (
              <p className="text-xs text-pink-dark" role="alert">
                {errorText(t, state)}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-pink text-card font-bold rounded-full py-2.5 text-sm shadow-cta-pink transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
            >
              {pending ? t.feedback.sending : t.feedback.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
