/**
 * Session-gated reward image serve.
 *
 * The :id route param is reward_item.id (NOT the filename). Keeping the URL
 * stable across re-uploads means /api/reward-images/<reward-id> always
 * returns the current photo without breaking links in past server-rendered
 * pages. Also avoids leaking the date-sharded path structure to clients.
 *
 * Authorization:
 *   - Admin (parent): any reward in their household.
 *   - Kid: any visible_to_kids = true, non-archived reward in their household.
 *     (We don't gate by per-reward enrollment because rewards are
 *     household-wide; the shop already filters by visibility.)
 *   - Anonymous: 401.
 *
 * Cache: reward images are not minors' photos, so a short shared cache is
 * fine — but the cookie is still required, so we use `private`.
 *
 * Mirrors apps/web/src/app/api/evidence/[id]/route.ts structurally; the
 * differences are:
 *   - resolves by reward_item.id, not evidence.id
 *   - kid principal allowed for any visible reward (not only own evidence)
 *   - cacheable for 5 min
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, rewardItem as rewardItemTable } from '@reco/db';
import { auth } from '../../../../auth';
import { verifyKidSession } from '../../../../lib/kid-auth/session';
import { KID_SESSION_COOKIE } from '../../../../lib/kid-auth/constants';
import { rewardImagePathFor, isExternalImageUrl } from '../../../../lib/reward-images/paths';

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

  // Resolve principal: prefer kid-session over admin-session (same precedence
  // as the evidence route — kid PWA can be opened on a parent's phone).
  const cookieJar = await cookies();
  const kidJwt = cookieJar.get(KID_SESSION_COOKIE)?.value;
  const kidPayload = kidJwt ? await verifyKidSession(kidJwt) : null;

  let principal: 'kid' | 'admin' | null = null;
  let householdId: string | null = null;
  if (kidPayload) {
    principal = 'kid';
    householdId = kidPayload.household_id;
  } else {
    const session = await auth();
    if (session?.user) {
      principal = 'admin';
      householdId = session.user.householdId;
    }
  }

  if (!principal || !householdId) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const rows = await getDb()
    .select({
      imagePath: rewardItemTable.imagePath,
      visibleToKids: rewardItemTable.visibleToKids,
      archivedAt: rewardItemTable.archivedAt,
    })
    .from(rewardItemTable)
    .where(
      and(eq(rewardItemTable.id, id), eq(rewardItemTable.householdId, householdId)),
    )
    .limit(1);
  const r = rows[0];
  if (!r || !r.imagePath) return new NextResponse('not found', { status: 404 });

  if (principal === 'kid') {
    if (!r.visibleToKids || r.archivedAt) {
      return new NextResponse('forbidden', { status: 403 });
    }
  }

  // Defense-in-depth: a legacy http URL should never reach this route (the
  // page-level URL builder bypasses /api/reward-images for those), but if it
  // does, refuse rather than try to write it to disk.
  if (isExternalImageUrl(r.imagePath)) {
    return new NextResponse('not found', { status: 404 });
  }

  let absPath: string;
  try {
    absPath = rewardImagePathFor(r.imagePath);
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
      // Not minor's content — short private cache is OK to spare repeated
      // file reads when the shop is open on a slow connection.
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
