/**
 * Feedback server actions.
 *
 *   - submitFeedbackAction — any principal (kid or admin) via the floating
 *     feedback button. Category + body required; an optional image attachment
 *     is written to the shared evidence volume under feedback/. The submitter
 *     identity is recorded via the matching nullable FK + a denormalized
 *     label. No audit_log row — this is user-generated content, not an admin
 *     state mutation.
 *   - updateFeedbackStatusAction — admin-only triage; moves a row through
 *     new → in_progress → in_validation → completed. Writes an audit_log row.
 *
 * Image handling mirrors lib/reward-images/actions.ts (MIME allowlist, 5 MB
 * cap, UUID filename, no unlink-on-replace).
 */

'use server';

import 'server-only';
import { writeFile } from 'node:fs/promises';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { getDb, feedback, auditLog, type FeedbackStatus } from '@reco/db';
import { requireAdmin, requireKidOrAdmin, UnauthorizedError } from '../auth/guards';
import {
  ensureFeedbackImageDirFor,
  feedbackImagePathFor,
  freshFeedbackImageFilename,
  isAllowedFeedbackMime,
  MAX_FEEDBACK_IMAGE_BYTES,
} from '../feedback-images/paths';

const CATEGORIES = new Set(['bug', 'ui_ux', 'feature']);
const STATUSES = new Set<FeedbackStatus>(['new', 'in_progress', 'in_validation', 'completed']);

export type SubmitFeedbackState =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_category' | 'invalid_body' | 'too_large' | 'mime_not_allowed' | 'forbidden' | 'internal';
    };

export async function submitFeedbackAction(
  _prev: SubmitFeedbackState | undefined,
  formData: FormData,
): Promise<SubmitFeedbackState> {
  const category = String(formData.get('category') ?? '').trim();
  if (!CATEGORIES.has(category)) return { ok: false, error: 'invalid_category' };

  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { ok: false, error: 'invalid_body' };

  let principal;
  try {
    principal = await requireKidOrAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  // Optional image attachment.
  let imagePath: string | null = null;
  const fileRaw = formData.get('image');
  if (fileRaw instanceof File && fileRaw.size > 0) {
    if (fileRaw.size > MAX_FEEDBACK_IMAGE_BYTES) return { ok: false, error: 'too_large' };
    if (!isAllowedFeedbackMime(fileRaw.type)) return { ok: false, error: 'mime_not_allowed' };
    const filename = freshFeedbackImageFilename(fileRaw.type);
    try {
      await ensureFeedbackImageDirFor(filename);
      const buffer = Buffer.from(await fileRaw.arrayBuffer());
      await writeFile(feedbackImagePathFor(filename), buffer, { mode: 0o644 });
      imagePath = filename;
    } catch (err) {
      console.error('submitFeedbackAction: image write failed', err);
      return { ok: false, error: 'internal' };
    }
  }

  try {
    await getDb()
      .insert(feedback)
      .values({
        householdId: principal.householdId,
        submittedByKidId: principal.kidId,
        submittedByUserId: principal.userId,
        submitterLabel: principal.label,
        category: category as 'bug' | 'ui_ux' | 'feature',
        body,
        imagePath,
      });
  } catch (err) {
    console.error('submitFeedbackAction: insert failed', err);
    return { ok: false, error: 'internal' };
  }

  revalidatePath('/[lang]/admin/feedback', 'page');
  return { ok: true };
}

export async function updateFeedbackStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as FeedbackStatus;
  if (!id || !STATUSES.has(status)) return;

  const admin = await requireAdmin();
  const db = getDb();

  const before = await db
    .select({ id: feedback.id, status: feedback.status })
    .from(feedback)
    .where(and(eq(feedback.id, id), eq(feedback.householdId, admin.householdId)))
    .limit(1);
  if (!before[0]) return;

  await db
    .update(feedback)
    .set({ status, updatedAt: new Date() })
    .where(eq(feedback.id, id));

  const hdrs = await headers();
  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: 'feedback.status_changed',
    targetKind: 'feedback',
    targetId: id,
    beforeJson: { status: before[0].status },
    afterJson: { status },
    requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: hdrs.get('user-agent') ?? null,
  });

  revalidatePath('/[lang]/admin/feedback', 'page');
}
