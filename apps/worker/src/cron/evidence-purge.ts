/**
 * Evidence purge — Phase 5 cron job.
 *
 * Runs at 06:00 Asia/Jerusalem daily (per docs/CRON.md). Deletes photo files
 * from the reco-evidence volume for any resolved submissions older than 30
 * days. The `evidence` row itself stays in the DB (audit trail of what was
 * uploaded) — only `purged_at` flips to non-null and the bytes leave.
 *
 * Orphan rule: an evidence row with `submission_id IS NULL` (which shouldn't
 * normally exist — every upload creates a linked submission in the same tx)
 * is also purged after the same 30-day window from `uploaded_at`. This is
 * the safety net for failed-mid-upload edge cases.
 *
 * Idempotency: WHERE `purged_at IS NULL` filters out already-purged rows so
 * a re-run is a no-op. node-cron fires on schedule regardless of overlap, so
 * the SQL must be the integrity point.
 */

import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { logger } from '../logger';
import { env } from '../env';

interface PurgeCandidate {
  id: string;
  filename: string;
}

export async function runEvidencePurge(pool: Pool): Promise<{
  purged: number;
  errors: number;
}> {
  // Reuse the same path-safety logic as the web upload action. We can't
  // import @reco/web's helpers from the worker (circular dependency), so the
  // small set of guards is inlined here. If a future refactor moves
  // evidencePathFor into @reco/db, this can switch to the shared helper.
  const root = path.resolve(env.EVIDENCE_VOLUME_PATH);

  const res = await pool.query<PurgeCandidate>(
    `SELECT e.id, e.filename
       FROM evidence e
       LEFT JOIN submission s ON s.evidence_id = e.id
      WHERE e.purged_at IS NULL
        AND (
          (s.id IS NOT NULL
             AND s.status IN ('approved', 'denied')
             AND s.resolved_at < (now() - INTERVAL '30 days'))
          OR
          (s.id IS NULL
             AND e.uploaded_at < (now() - INTERVAL '30 days'))
        )`,
  );

  let purged = 0;
  let errors = 0;

  for (const row of res.rows) {
    // Defense-in-depth filename guard (mirrors paths.ts in @reco/web).
    if (
      row.filename.includes('..') ||
      row.filename.startsWith('/') ||
      row.filename.startsWith('\\')
    ) {
      logger.error({ id: row.id, filename: row.filename }, 'unsafe evidence filename — skipping');
      errors += 1;
      continue;
    }
    const abs = path.resolve(root, row.filename);
    if (!abs.startsWith(root + path.sep) && abs !== root) {
      logger.error({ id: row.id, filename: row.filename, abs }, 'evidence path escapes root — skipping');
      errors += 1;
      continue;
    }

    try {
      await unlink(abs);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      // ENOENT = file already gone (manual cleanup, restored backup, etc.) —
      // continue to update the DB row so subsequent runs don't re-try it.
      if (code !== 'ENOENT') {
        logger.error({ id: row.id, filename: row.filename, err }, 'unlink failed — skipping DB update');
        errors += 1;
        continue;
      }
    }

    await pool.query(`UPDATE evidence SET purged_at = now() WHERE id = $1`, [row.id]);
    purged += 1;
  }

  return { purged, errors };
}
