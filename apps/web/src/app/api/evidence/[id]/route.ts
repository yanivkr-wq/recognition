/**
 * Session-gated evidence photo serve.
 *
 * Architectural deviation from ARCHITECTURE.md §9 (worker-side serve):
 *   The arch doc placed this on the worker on the assumption that web didn't
 *   mount the volume. The docker-compose snippet in §9 actually mounts the
 *   volume on BOTH containers (web writes uploads, worker handles purges),
 *   so the web app can also serve. Placing the serve route here:
 *     - Keeps the session check in the same process as the session cookie
 *       (no internal-token proxy hop in dev where there's no Caddy).
 *     - Avoids cross-origin browser cookies when web is on :3030 and worker
 *       is on :8100 in dev.
 *     - Is identical to the worker route security-wise (uuid filenames +
 *       path traversal guard + private,no-store cache).
 *   The worker keeps the evidence-purge cron (also touches the volume).
 *
 * Authorization rules:
 *   - Admin (parent): can fetch any submission in their household.
 *   - Kid: can fetch only their own submission (evidence.kid_id matches).
 *   - Anonymous: 401.
 *
 * The :id route param refers to the `evidence.id` (NOT submission.id) — that
 * keeps the URL stable across resubmits and matches the ARCHITECTURE doc.
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import { getDb, evidence as evidenceTable } from '@reco/db';
import { auth } from '../../../../auth';
import { verifyKidSession } from '../../../../lib/kid-auth/session';
import { KID_SESSION_COOKIE } from '../../../../lib/kid-auth/constants';
import { evidencePathFor } from '../../../../lib/evidence/paths';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx): Promise<Response> {
  const { id } = await params;

  // UUID shape sanity — a malformed id couldn't match the DB anyway, but
  // we error early so we don't hit the pool for obviously-bad input.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse('not found', { status: 404 });
  }

  // Middleware deliberately skips /api/*; resolve the principal inline.
  // Prefer kid-session if both cookies are present (kid PWAs can be opened
  // on a parent's phone; the kid scope is the more restrictive one).
  const cookieJar = await cookies();
  const kidJwt = cookieJar.get(KID_SESSION_COOKIE)?.value;
  const kidPayload = kidJwt ? await verifyKidSession(kidJwt) : null;

  let kidId: string | null = null;
  let householdId: string | null = null;
  let principal: 'kid' | 'admin' | null = null;
  if (kidPayload) {
    kidId = kidPayload.kid_id;
    householdId = kidPayload.household_id;
    principal = 'kid';
  } else {
    const session = await auth();
    if (session?.user) {
      householdId = session.user.householdId;
      principal = 'admin';
    }
  }

  if (!principal) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const rows = await getDb()
    .select({
      filename: evidenceTable.filename,
      mimeType: evidenceTable.mimeType,
      kidId: evidenceTable.kidId,
      householdId: evidenceTable.householdId,
      purgedAt: evidenceTable.purgedAt,
    })
    .from(evidenceTable)
    .where(eq(evidenceTable.id, id))
    .limit(1);
  const e = rows[0];
  if (!e || e.purgedAt) return new NextResponse('not found', { status: 404 });

  if (principal === 'kid') {
    if (e.kidId !== kidId) {
      return new NextResponse('forbidden', { status: 403 });
    }
  } else {
    if (householdId !== e.householdId) {
      return new NextResponse('forbidden', { status: 403 });
    }
  }

  // Stream the file.
  const absPath = evidencePathFor(e.filename);
  let size: number;
  try {
    const s = await stat(absPath);
    size = s.size;
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  const nodeStream = createReadStream(absPath);
  // node:stream → Web ReadableStream so NextResponse can consume it.
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': e.mimeType,
      'Content-Length': String(size),
      // Per ARCHITECTURE.md §9 — minors' photos must NEVER cache.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
