/**
 * Badge image serve.
 *
 * :id is badge.id (not the filename) — stable URL across re-uploads, hides
 * the date-sharded path. Badges are shown to kids (badges page, campaign
 * cards), so both principals may read: kid-session preferred (a kid PWA can
 * run on a parent's phone), else admin session. Scoped to the household.
 *
 * Mirrors api/reward-images/[id]/route.ts.
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { and, eq } from 'drizzle-orm';
import { getDb, badge as badgeTable } from '@reco/db';
import { auth } from '../../../../auth';
import { verifyKidSession } from '../../../../lib/kid-auth/session';
import { KID_SESSION_COOKIE } from '../../../../lib/kid-auth/constants';
import { badgeImagePathFor } from '../../../../lib/badge-images/paths';

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

  const cookieJar = await cookies();
  const kidJwt = cookieJar.get(KID_SESSION_COOKIE)?.value;
  const kidPayload = kidJwt ? await verifyKidSession(kidJwt) : null;

  let householdId: string | null = null;
  if (kidPayload) {
    householdId = kidPayload.household_id;
  } else {
    const session = await auth();
    if (session?.user) householdId = session.user.householdId;
  }
  if (!householdId) return new NextResponse('unauthorized', { status: 401 });

  const rows = await getDb()
    .select({ imagePath: badgeTable.imagePath })
    .from(badgeTable)
    .where(and(eq(badgeTable.id, id), eq(badgeTable.householdId, householdId)))
    .limit(1);
  const r = rows[0];
  if (!r || !r.imagePath) return new NextResponse('not found', { status: 404 });

  let absPath: string;
  try {
    absPath = badgeImagePathFor(r.imagePath);
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
