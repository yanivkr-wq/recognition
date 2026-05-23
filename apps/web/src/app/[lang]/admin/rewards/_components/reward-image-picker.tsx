/**
 * Admin · reward image picker (edit-mode only).
 *
 * Lives BELOW the main reward fields as a separate <form>. Why separate:
 *   - The upload needs a `rewardId`, so it's edit-only — bundling it into
 *     the main form would mean form-level conditional rendering AND a
 *     mixed-content POST (text fields + a file blob).
 *   - Keeping it isolated means the IconPicker preview keeps working
 *     unchanged in create mode, and the upload doesn't block "save" when
 *     the admin just wants to tweak the title.
 *
 * UI:
 *   - Current photo preview (if any) with a "remove" button.
 *   - File input + "upload" button. Client-side validation rejects oversize
 *     / wrong-mime files before the request fires.
 *   - Server response refreshes the page (revalidatePath in the action),
 *     so the preview updates to the new image without a manual reload.
 *
 * The kid shop sees the new image immediately because the action revalidates
 * /[lang]/redeem as well.
 */

'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Dictionary } from '@reco/shared/i18n';
import {
  removeRewardImageAction,
  uploadRewardImageAction,
  type UploadRewardImageState,
} from '../../../../../lib/reward-images/actions';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

interface Props {
  rewardId: string;
  currentImageUrl: string | null;
  t: Dictionary;
}

const ERROR_KEY: Record<
  Exclude<Extract<UploadRewardImageState, { ok: false }>['error'], never>,
  keyof Dictionary['admin']
> = {
  forbidden: 'rewardImageFailed',
  not_found: 'rewardImageFailed',
  no_file: 'rewardImageNoFile',
  mime_not_allowed: 'rewardImageBadMime',
  too_large: 'rewardImageTooLarge',
  internal: 'rewardImageFailed',
};

export function RewardImagePicker({ rewardId, currentImageUrl, t }: Props) {
  const [state, action] = useActionState<UploadRewardImageState | undefined, FormData>(
    uploadRewardImageAction,
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

  const errKey =
    clientError ?? (state && state.ok === false ? ERROR_KEY[state.error] : null);

  return (
    <div className="bg-bg rounded-2xl border border-rule p-4 space-y-3">
      <div>
        <p className="font-bold text-ink text-sm">{t.admin.rewardImage}</p>
        <p className="text-xs text-ink-soft mt-0.5">{t.admin.rewardImageHint}</p>
      </div>

      <div className="flex items-start gap-3">
        {currentImageUrl ? (
          <div className="w-24 h-24 rounded-2xl overflow-hidden border border-rule shrink-0 bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-2xl border border-dashed border-rule flex items-center justify-center text-[10px] text-ink-faded text-center px-2 shrink-0">
            {t.admin.rewardImageNone}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink-soft">
            {currentImageUrl ? t.admin.rewardImageCurrent : t.admin.rewardImageNone}
          </p>
        </div>
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="rewardId" value={rewardId} />
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept={ALLOWED.join(',')}
          onChange={onFileChange}
          className="block w-full text-xs text-ink file:bg-pink file:text-card file:font-bold file:rounded-full file:border-0 file:px-3 file:py-1.5 file:me-2 file:cursor-pointer file:shadow-cta-pink"
        />
        <div className="flex items-center gap-2">
          <UploadButton t={t} disabled={!!clientError} />
          {currentImageUrl && <RemoveForm rewardId={rewardId} t={t} />}
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
      className="bg-pink text-card font-bold rounded-full py-1.5 px-4 text-xs shadow-cta-pink hover:-translate-y-px transition disabled:opacity-60 disabled:translate-y-0"
    >
      {pending ? t.admin.rewardImageUploading : t.admin.rewardImageUpload}
    </button>
  );
}

function RemoveForm({ rewardId, t }: { rewardId: string; t: Dictionary }) {
  return (
    <form action={removeRewardImageAction}>
      <input type="hidden" name="rewardId" value={rewardId} />
      <button
        type="submit"
        className="text-xs text-ink-soft underline-offset-2 hover:underline"
      >
        {t.admin.rewardImageRemove}
      </button>
    </form>
  );
}
