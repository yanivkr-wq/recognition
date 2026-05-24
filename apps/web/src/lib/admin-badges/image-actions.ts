/**
 * Admin server actions: upload / remove a custom badge image.
 *
 * Mirrors lib/reward-images/actions.ts. Edit-mode only (needs a badge id to
 * target). On upload we write the file to the shared evidence volume under
 * badges/ and set badge.image_path; the renderer then prefers the image over
 * the em-* SVG emblem. Old files are not unlinked on replace (harmless
 * orphans, avoids a two-tab race) — same policy as reward images.
 */

'use server';

import 'server-only';
import { writeFile } from 'node:fs/promises';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { getDb, badge, auditLog } from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';
import {
  badgeExtensionFor,
  badgeImagePathFor,
  ensureBadgeImageDirFor,
  freshBadgeImageFilename,
  isAllowedBadgeMime,
  MAX_BADGE_IMAGE_BYTES,
} from '../badge-images/paths';

export type UploadBadgeImageState =
  | { ok: true; badgeId: string }
  | {
      ok: false;
      error: 'forbidden' | 'not_found' | 'no_file' | 'mime_not_allowed' | 'too_large' | 'internal';
    };

export async function uploadBadgeImageAction(
  _prev: UploadBadgeImageState | undefined,
  formData: FormData,
): Promise<UploadBadgeImageState> {
  const badgeId = String(formData.get('badgeId') ?? '');
  if (!badgeId) return { ok: false, error: 'not_found' };

  const fileRaw = formData.get('file');
  if (!(fileRaw instanceof File) || fileRaw.size === 0) {
    return { ok: false, error: 'no_file' };
  }
  if (fileRaw.size > MAX_BADGE_IMAGE_BYTES) return { ok: false, error: 'too_large' };
  if (!isAllowedBadgeMime(fileRaw.type)) return { ok: false, error: 'mime_not_allowed' };
  if (!badgeExtensionFor(fileRaw.type)) return { ok: false, error: 'mime_not_allowed' };

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const db = getDb();
  const rows = await db
    .select({ id: badge.id, oldPath: badge.imagePath })
    .from(badge)
    .where(and(eq(badge.id, badgeId), eq(badge.householdId, admin.householdId)))
    .limit(1);
  const b = rows[0];
  if (!b) return { ok: false, error: 'not_found' };

  const filename = freshBadgeImageFilename(fileRaw.type);
  try {
    await ensureBadgeImageDirFor(filename);
    const buffer = Buffer.from(await fileRaw.arrayBuffer());
    await writeFile(badgeImagePathFor(filename), buffer, { mode: 0o644 });
  } catch (err) {
    console.error('uploadBadgeImageAction: write failed', err);
    return { ok: false, error: 'internal' };
  }

  try {
    await db.update(badge).set({ imagePath: filename }).where(eq(badge.id, badgeId));
    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'badge.image_uploaded',
      targetKind: 'badge',
      targetId: badgeId,
      beforeJson: { imagePath: b.oldPath },
      afterJson: { imagePath: filename, mime: fileRaw.type, sizeBytes: fileRaw.size },
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('uploadBadgeImageAction: DB update failed', err);
    return { ok: false, error: 'internal' };
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/badges', 'page');
  return { ok: true, badgeId };
}

export async function removeBadgeImageAction(formData: FormData): Promise<void> {
  const badgeId = String(formData.get('badgeId') ?? '');
  if (!badgeId) return;

  const admin = await requireAdmin();
  const db = getDb();
  const rows = await db
    .select({ id: badge.id, oldPath: badge.imagePath })
    .from(badge)
    .where(and(eq(badge.id, badgeId), eq(badge.householdId, admin.householdId)))
    .limit(1);
  const b = rows[0];
  if (!b) return;

  await db.update(badge).set({ imagePath: null }).where(eq(badge.id, badgeId));
  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: 'badge.image_removed',
    targetKind: 'badge',
    targetId: badgeId,
    beforeJson: { imagePath: b.oldPath },
    afterJson: { imagePath: null },
  });

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/badges', 'page');
}
