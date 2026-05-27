/**
 * Admin · custom badge image picker (edit-mode only).
 *
 * Mirrors the reward image picker. Lives as its own <form> outside the main
 * badge form (the upload needs a badge id + is a file POST). When an image is
 * set it overrides the SVG emblem everywhere the badge renders. Reuses the
 * generic rewardImage* action/error strings for upload/remove/errors; badge-
 * specific labels cover the headline + empty state.
 */

'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Dictionary } from '@reco/shared/i18n';
import {
  removeBadgeImageAction,
  uploadBadgeImageAction,
  type UploadBadgeImageState,
} from '../../../../../lib/admin-badges/image-actions';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

interface Props {
  badgeId: string;
  currentImageUrl: string | null;
  t: Dictionary;
}

const ERROR_KEY: Record<
  Extract<UploadBadgeImageState, { ok: false }>['error'],
  keyof Dictionary['admin']
> = {
  forbidden: 'rewardImageFailed',
  not_found: 'rewardImageFailed',
  no_file: 'rewardImageNoFile',
  mime_not_allowed: 'rewardImageBadMime',
  too_large: 'rewardImageTooLarge',
  internal: 'rewardImageFailed',
};

export function BadgeImagePicker({ badgeId, currentImageUrl, t }: Props) {
  const [state, action] = useActionState<UploadBadgeImageState | undefined, FormData>(
    uploadBadgeImageAction,
    undefined,
  );
  const [clientError, setClientError] = useState<keyof Dictionary['admin'] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null);
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) setClientError('rewardImageTooLarge');
    else if (!ALLOWED.includes(f.type)) setClientError('rewardImageBadMime');
  }

  const errKey = clientError ?? (state && state.ok === false ? ERROR_KEY[state.error] : null);

  return (
    <div className="bg-bg rounded-2xl border border-rule p-4 space-y-3">
      <div>
        <p className="font-bold text-ink text-sm">{t.admin.badgeImage}</p>
        <p className="text-xs text-ink-soft mt-0.5">{t.admin.badgeImageHint}</p>
      </div>

      <div className="flex items-start gap-3">
        {currentImageUrl ? (
          <div className="w-20 h-20 rounded-full overflow-hidden border border-rule shrink-0 bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full border border-dashed border-rule flex items-center justify-center text-[10px] text-ink-faded text-center px-2 shrink-0">
            {t.admin.badgeImageNone}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink-soft">
            {currentImageUrl ? t.admin.badgeImageCurrent : t.admin.badgeImageNone}
          </p>
        </div>
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="badgeId" value={badgeId} />
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept={ALLOWED.join(',')}
          onChange={onFileChange}
          className="block w-full text-xs text-ink file:bg-ink file:text-card file:font-semibold file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:me-2 file:cursor-pointer"
        />
        <div className="flex items-center gap-2">
          <UploadButton t={t} disabled={!!clientError} />
          {currentImageUrl && <RemoveForm badgeId={badgeId} t={t} />}
        </div>
        {errKey && (
          <p className="text-xs text-pink-dark" role="alert">
            {t.admin[errKey]}
          </p>
        )}
        {state?.ok === true && !clientError && (
          <p className="text-xs text-mint-dark">{t.common.save} ✓</p>
        )}
      </form>
    </div>
  );
}

function UploadButton({ t, disabled }: { t: Dictionary; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn-admin"
    >
      {pending ? t.admin.rewardImageUploading : t.admin.rewardImageUpload}
    </button>
  );
}

function RemoveForm({ badgeId, t }: { badgeId: string; t: Dictionary }) {
  return (
    <form action={removeBadgeImageAction}>
      <input type="hidden" name="badgeId" value={badgeId} />
      <button type="submit" className="text-xs text-ink-soft underline-offset-2 hover:underline">
        {t.admin.rewardImageRemove}
      </button>
    </form>
  );
}
