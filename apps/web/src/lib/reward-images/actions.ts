/**
 * Server actions: admin uploads / removes a reward photo.
 *
 * Upload flow:
 *   1. requireAdmin — kids never upload reward images.
 *   2. Validate file (MIME on allowlist, size ≤ 5 MB).
 *   3. Verify the reward belongs to the admin's household (404 otherwise).
 *   4. Write to disk under REWARD_IMAGE_VOLUME_PATH with a UUID-only filename.
 *   5. UPDATE reward_item.image_path. If the row already had an image_path
 *      pointing at a relative file (not a legacy http URL), we DO NOT delete
 *      the old file — orphaned files are harmless and avoiding the unlink
 *      removes a race window if two admin tabs upload at once. A future
 *      cleanup cron can sweep unreferenced files if storage ever matters.
 *   6. INSERT audit_log.
 *
 * Remove flow:
 *   1. requireAdmin.
 *   2. UPDATE reward_item.image_path = NULL.
 *   3. INSERT audit_log. (Same don't-unlink reasoning as above.)
 *
 * NOTE: this action is edit-mode only — a brand-new reward must be created
 * first (so we have a reward_item.id to target). The form hides the picker
 * in create mode. UX echoes the existing IconPicker pattern: create with
 * defaults, then upload a photo on the edit page.
 */

'use server';

import 'server-only';
import { writeFile } from 'node:fs/promises';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { getDb, rewardItem, auditLog } from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';
import {
  ensureRewardImageDirFor,
  freshRewardImageFilename,
  isAllowedRewardMime,
  MAX_REWARD_IMAGE_BYTES,
  rewardExtensionFor,
  rewardImagePathFor,
} from './paths';

export type UploadRewardImageState =
  | { ok: true; rewardId: string }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'not_found'
        | 'no_file'
        | 'mime_not_allowed'
        | 'too_large'
        | 'internal';
    };

export async function uploadRewardImageAction(
  _prev: UploadRewardImageState | undefined,
  formData: FormData,
): Promise<UploadRewardImageState> {
  const rewardId = String(formData.get('rewardId') ?? '');
  if (!rewardId) return { ok: false, error: 'not_found' };

  const fileRaw = formData.get('file');
  if (!(fileRaw instanceof File) || fileRaw.size === 0) {
    return { ok: false, error: 'no_file' };
  }
  const file = fileRaw;

  if (file.size > MAX_REWARD_IMAGE_BYTES) return { ok: false, error: 'too_large' };
  if (!isAllowedRewardMime(file.type)) return { ok: false, error: 'mime_not_allowed' };
  const ext = rewardExtensionFor(file.type);
  if (!ext) return { ok: false, error: 'mime_not_allowed' };

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const db = getDb();
  const rows = await db
    .select({ id: rewardItem.id, oldPath: rewardItem.imagePath })
    .from(rewardItem)
    .where(
      and(eq(rewardItem.id, rewardId), eq(rewardItem.householdId, admin.householdId)),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return { ok: false, error: 'not_found' };

  const filename = freshRewardImageFilename(file.type);
  try {
    await ensureRewardImageDirFor(filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(rewardImagePathFor(filename), buffer, { mode: 0o644 });
  } catch (err) {
    console.error('uploadRewardImageAction: write failed', err);
    return { ok: false, error: 'internal' };
  }

  try {
    await db
      .update(rewardItem)
      .set({ imagePath: filename, updatedAt: new Date() })
      .where(eq(rewardItem.id, rewardId));

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'reward_item.image_uploaded',
      targetKind: 'reward_item',
      targetId: rewardId,
      beforeJson: { imagePath: r.oldPath },
      afterJson: { imagePath: filename, mime: file.type, sizeBytes: file.size },
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('uploadRewardImageAction: DB update failed', err);
    return { ok: false, error: 'internal' };
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/redeem', 'page');
  return { ok: true, rewardId };
}

export async function removeRewardImageAction(formData: FormData): Promise<void> {
  const rewardId = String(formData.get('rewardId') ?? '');
  if (!rewardId) return;

  const admin = await requireAdmin();

  const db = getDb();
  const rows = await db
    .select({ id: rewardItem.id, oldPath: rewardItem.imagePath })
    .from(rewardItem)
    .where(
      and(eq(rewardItem.id, rewardId), eq(rewardItem.householdId, admin.householdId)),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return;

  await db
    .update(rewardItem)
    .set({ imagePath: null, updatedAt: new Date() })
    .where(eq(rewardItem.id, rewardId));

  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: 'reward_item.image_removed',
    targetKind: 'reward_item',
    targetId: rewardId,
    beforeJson: { imagePath: r.oldPath },
    afterJson: { imagePath: null },
  });

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/redeem', 'page');
}
