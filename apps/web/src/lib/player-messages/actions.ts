/**
 * Admin → player popup message actions + the kid-side dismissal.
 *
 *   - createPlayerMessageAction (admin) — compose a message for one player or
 *     all players, with a [startDate, endDate] window.
 *   - archivePlayerMessageAction (admin) — soft-remove a message.
 *   - dismissPlayerMessageAction (kid) — "do not show again": records a
 *     per-kid dismissal so the popup never returns for that player.
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import {
  getDb,
  playerMessage,
  playerMessageDismissal,
  kid as kidTable,
  auditLog,
} from '@reco/db';
import { requireAdmin, requireKid, UnauthorizedError } from '../auth/guards';

export type PlayerMessageError = 'invalid' | 'forbidden' | 'internal';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createPlayerMessageAction(
  _prev: PlayerMessageError | undefined,
  formData: FormData,
): Promise<PlayerMessageError | undefined> {
  const lang = String(formData.get('lang') ?? 'he');

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return 'forbidden';
    throw err;
  }

  const body = String(formData.get('body') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim() || null;
  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();
  if (!body || !DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) {
    return 'invalid';
  }

  // Target: '' or 'all' = broadcast (kid_id NULL); else must be a kid in the
  // admin's household.
  const targetRaw = String(formData.get('kidId') ?? '').trim();
  let kidId: string | null = null;
  if (targetRaw && targetRaw !== 'all') {
    const db = getDb();
    const rows = await db
      .select({ id: kidTable.id })
      .from(kidTable)
      .where(and(eq(kidTable.id, targetRaw), eq(kidTable.householdId, admin.householdId)))
      .limit(1);
    if (!rows[0]) return 'invalid';
    kidId = targetRaw;
  }

  const db = getDb();
  try {
    const [row] = await db
      .insert(playerMessage)
      .values({
        householdId: admin.householdId,
        kidId,
        title,
        body,
        startDate,
        endDate,
        createdByUserId: admin.userId,
      })
      .returning({ id: playerMessage.id });

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'player_message.created',
      targetKind: 'player_message',
      targetId: row!.id,
      afterJson: { kidId, title, body, startDate, endDate },
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('createPlayerMessageAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]', 'layout');
  redirect(`/${lang}/admin/messages`);
}

export async function archivePlayerMessageAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!id) return;
  const admin = await requireAdmin();

  const db = getDb();
  const rows = await db
    .select({ id: playerMessage.id })
    .from(playerMessage)
    .where(and(eq(playerMessage.id, id), eq(playerMessage.householdId, admin.householdId)))
    .limit(1);
  if (!rows[0]) return;

  await db.update(playerMessage).set({ archivedAt: new Date() }).where(eq(playerMessage.id, id));
  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: 'player_message.archived',
    targetKind: 'player_message',
    targetId: id,
  });

  // Archive button lives ON /admin/messages — Pattern C no-op redirect.
  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]', 'layout');
}

export type DismissMessageState = { ok: boolean };

export async function dismissPlayerMessageAction(
  _prev: DismissMessageState | undefined,
  formData: FormData,
): Promise<DismissMessageState> {
  const messageId = String(formData.get('messageId') ?? '');
  if (!messageId) return { ok: false };

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false };
    throw err;
  }

  try {
    await getDb()
      .insert(playerMessageDismissal)
      .values({ messageId, kidId: kid.kidId })
      .onConflictDoNothing();
  } catch (err) {
    console.error('dismissPlayerMessageAction failed', err);
    return { ok: false };
  }

  revalidatePath('/[lang]', 'layout');
  return { ok: true };
}
