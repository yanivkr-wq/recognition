/**
 * Server action: kid uploads a photo for an evidence-required completion.
 *
 * Flow:
 *   1. Phase 3's completeTaskAction already created a `task_completion` with
 *      `approval_status='pending'` and `evidence_submission_id=NULL` when the
 *      kid tapped "I did it". This action attaches the photo to THAT row.
 *   2. Validate: kid owns the completion, the template requires evidence,
 *      no submission exists yet (re-upload requires undo + redo).
 *   3. Validate the file: MIME on the allowlist, size ≤ 10 MB. The DB CHECK
 *      `evidence.size_bytes BETWEEN 1 AND 10485760` is the second gate.
 *   4. Generate a UUID-only filename. NEVER trust the client's name.
 *   5. Write the file to disk under `EVIDENCE_VOLUME_PATH`.
 *   6. INSERT evidence + submission in one transaction; UPDATE the
 *      completion's evidence_submission_id atomically. If any step throws,
 *      rollback the DB AND unlink the file from disk so we don't orphan.
 *
 * Phase 5 NEVER posts to the ledger here. The earn fires when a parent
 * approves the submission — see /admin/approvals.
 */

'use server';

import 'server-only';
import { writeFile, unlink } from 'node:fs/promises';
import { revalidatePath } from 'next/cache';
import { getPool } from '@reco/db';
import { requireKid, UnauthorizedError } from '../auth/guards';
import {
  ensureDirFor,
  evidencePathFor,
  extensionFor,
  freshFilename,
  isAllowedMime,
  MAX_EVIDENCE_BYTES,
} from './paths';

export type SubmitEvidenceState =
  | {
      ok: true;
      submissionId: string;
      evidenceId: string;
    }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'not_found'
        | 'no_file'
        | 'mime_not_allowed'
        | 'too_large'
        | 'completion_already_resolved'
        | 'submission_exists'
        | 'internal';
    };

export async function submitEvidenceAction(
  _prev: SubmitEvidenceState | undefined,
  formData: FormData,
): Promise<SubmitEvidenceState> {
  const completionId = String(formData.get('completionId') ?? '');
  if (!completionId) return { ok: false, error: 'not_found' };

  const fileRaw = formData.get('file');
  if (!(fileRaw instanceof File) || fileRaw.size === 0) {
    return { ok: false, error: 'no_file' };
  }
  const file = fileRaw;

  if (file.size > MAX_EVIDENCE_BYTES) return { ok: false, error: 'too_large' };
  if (!isAllowedMime(file.type)) return { ok: false, error: 'mime_not_allowed' };

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  // 1. Validate the completion: kid owns it, evidence-required, still pending,
  //    no existing submission. We don't lock here — concurrent uploads for the
  //    same completion are vanishingly rare (one phone, one kid) and the
  //    completion's `evidence_submission_id IS NULL` check inside the UPDATE
  //    below catches the race.
  const pool = getPool();
  const cRes = await pool.query<{
    id: string;
    kid_id: string;
    approval_status: string;
    evidence_submission_id: string | null;
    evidence_required: boolean;
    template_id: string;
  }>(
    `SELECT tc.id, tc.kid_id, tc.approval_status, tc.evidence_submission_id,
            tt.evidence_required, tt.id AS template_id
     FROM task_completion tc
     JOIN task_assignment ta ON ta.id = tc.assignment_id
     JOIN task_template tt ON tt.id = ta.template_id
     WHERE tc.id = $1`,
    [completionId],
  );
  const c = cRes.rows[0];
  if (!c || c.kid_id !== kid.kidId) return { ok: false, error: 'not_found' };
  if (!c.evidence_required) return { ok: false, error: 'not_found' };
  if (c.approval_status !== 'pending') {
    return { ok: false, error: 'completion_already_resolved' };
  }
  if (c.evidence_submission_id) return { ok: false, error: 'submission_exists' };

  // 2. Generate a UUID filename. NEVER use `file.name`.
  const filename = freshFilename(file.type);
  const mime = file.type;
  const sizeBytes = file.size;
  const ext = extensionFor(mime); // never null here — we validated above
  if (!ext) return { ok: false, error: 'mime_not_allowed' };

  // 3. Write the file to disk. We do this BEFORE the DB INSERT so the
  //    INSERT can fail without orphaning a file. (If the write succeeds and
  //    the INSERT fails, the catch path below unlinks.)
  try {
    await ensureDirFor(filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(evidencePathFor(filename), buffer, { mode: 0o600 });
  } catch (err) {
    console.error('submitEvidenceAction: write failed', err);
    return { ok: false, error: 'internal' };
  }

  // 4. INSERT evidence + submission, UPDATE completion in one transaction.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eRes = await client.query<{ id: string }>(
      `INSERT INTO evidence (household_id, kid_id, filename, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [kid.householdId, kid.kidId, filename, mime, sizeBytes],
    );
    const evidenceId = eRes.rows[0]!.id;

    const sRes = await client.query<{ id: string }>(
      `INSERT INTO submission (
         household_id, kid_id, task_completion_id, evidence_id, status
       ) VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [kid.householdId, kid.kidId, completionId, evidenceId],
    );
    const submissionId = sRes.rows[0]!.id;

    // Wire the submission back to the completion ONLY if it's still empty;
    // this is the race-safe-tie-in: a concurrent upload for the same
    // completion (extremely rare) would lose this check.
    const u = await client.query(
      `UPDATE task_completion
         SET evidence_submission_id = $1, updated_at = now()
       WHERE id = $2 AND evidence_submission_id IS NULL`,
      [submissionId, completionId],
    );
    if (u.rowCount !== 1) {
      await client.query('ROLLBACK');
      await unlink(evidencePathFor(filename)).catch(() => undefined);
      return { ok: false, error: 'submission_exists' };
    }

    await client.query('COMMIT');
    revalidatePath('/[lang]', 'layout');
    return { ok: true, submissionId, evidenceId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    await unlink(evidencePathFor(filename)).catch(() => undefined);
    console.error('submitEvidenceAction: DB INSERT failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}
