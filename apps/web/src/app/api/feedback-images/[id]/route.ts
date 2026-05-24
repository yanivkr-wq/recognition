/**
 * Admin-only feedback image serve.
 *
 * The :id route param is feedback.id (NOT the filename) — keeps the URL stable
 * and hides the date-sharded path. Only admins (parents) view feedback, so
 * this route requires an Auth.js session and scopes by household_id. Kids who
 * submitted the attachment never read it back (they previewed the local File
 * before submit).
 *
 * Mirrors api/reward-images/[id]/route.ts, minus the kid principal branch.
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { and, eq } from 'drizzle-orm';
import { getDb, feedback as feedbackTable } from '@reco/db';
import { auth } from '../../../../auth';
import { feedbackImagePathFor } from '../../../../lib/feedback-images/paths';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function GET(_req: NextRequest, { params }: Ctx): Promise<Response> {
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse('not found', { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const rows = await getDb()
    .select({ imagePath: feedbackTable.imagePath })
    .from(feedbackTable)
    .where(and(eq(feedbackTable.id, id), eq(feedbackTable.householdId, session.user.householdId)))
    .limit(1);
  const r = rows[0];
  if (!r || !r.imagePath) return new NextResponse('not found', { status: 404 });

  let absPath: string;
  try {
    absPath = feedbackImagePathFor(r.imagePath);
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  let size: number;
  try {
    const s = await stat(absPath);
    size = s.size;
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  const ext = r.imagePath.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';

  const nodeStream = createReadStream(absPath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(size),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
