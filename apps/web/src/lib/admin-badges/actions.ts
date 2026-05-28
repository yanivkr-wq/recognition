/**
 * Admin server actions for badge CRUD.
 *
 * Badges are household-wide. A campaign's badge picker shows every
 * non-archived badge, so this surface feeds that dropdown. Archiving is the
 * soft-delete: kid_badge.badge_id has onDelete restrict, so a badge already
 * awarded can't be hard-deleted — archive hides it from new campaigns while
 * preserving earned history.
 *
 * iconKey is constrained to the locked em-* emblem set (BADGE_EMBLEMS); no
 * emoji emblems (CLAUDE.md §6). Every mutation appends an audit_log entry.
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { getDb, badge, auditLog, type BadgeAwardedVia } from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';
import { isBadgeEmblem } from './emblems';

export type BadgeFormError =
  | 'invalid_title'
  | 'invalid_color'
  | 'invalid_icon'
  | 'invalid_awarded_via'
  | 'forbidden'
  | 'not_found'
  | 'internal';

interface ParsedBadge {
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  iconKey: string;
  color: string;
  awardedVia: BadgeAwardedVia;
  displayOrder: number;
}

function parseBadgeForm(formData: FormData): ParsedBadge | BadgeFormError {
  const titleHe = String(formData.get('titleHe') ?? '').trim();
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  if (!titleHe || !titleEn) return 'invalid_title';

  const descriptionHe = String(formData.get('descriptionHe') ?? '').trim() || null;
  const descriptionEn = String(formData.get('descriptionEn') ?? '').trim() || null;

  const iconKey = String(formData.get('iconKey') ?? '').trim();
  if (!isBadgeEmblem(iconKey)) return 'invalid_icon';

  const color = String(formData.get('color') ?? '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return 'invalid_color';

  const awardedViaRaw = String(formData.get('awardedVia') ?? 'campaign').trim();
  if (awardedViaRaw !== 'campaign' && awardedViaRaw !== 'manual') {
    return 'invalid_awarded_via';
  }
  const awardedVia = awardedViaRaw as BadgeAwardedVia;

  const orderRaw = String(formData.get('displayOrder') ?? '50');
  const orderParsed = Number.parseInt(orderRaw, 10);
  const displayOrder = Number.isInteger(orderParsed) ? orderParsed : 50;

  return {
    titleHe,
    titleEn,
    descriptionHe,
    descriptionEn,
    iconKey,
    color,
    awardedVia,
    displayOrder,
  };
}

export async function createBadgeAction(
  _prev: BadgeFormError | undefined,
  formData: FormData,
): Promise<BadgeFormError | undefined> {
  const lang = String(formData.get('lang') ?? 'he');

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return 'forbidden';
    throw err;
  }
  const parsed = parseBadgeForm(formData);
  if (typeof parsed === 'string') return parsed;

  const db = getDb();
  try {
    const [row] = await db
      .insert(badge)
      .values({
        householdId: admin.householdId,
        titleHe: parsed.titleHe,
        titleEn: parsed.titleEn,
        descriptionHe: parsed.descriptionHe,
        descriptionEn: parsed.descriptionEn,
        iconKey: parsed.iconKey,
        color: parsed.color,
        awardedVia: parsed.awardedVia,
        displayOrder: parsed.displayOrder,
      })
      .returning({ id: badge.id });

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'badge.created',
      targetKind: 'badge',
      targetId: row!.id,
      afterJson: parsed,
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('createBadgeAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  redirect(`/${lang}/admin/badges`);
}

export async function updateBadgeAction(
  _prev: BadgeFormError | undefined,
  formData: FormData,
): Promise<BadgeFormError | undefined> {
  const id = String(formData.get('id') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!id) return 'not_found';

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return 'forbidden';
    throw err;
  }
  const parsed = parseBadgeForm(formData);
  if (typeof parsed === 'string') return parsed;

  const db = getDb();
  const before = await db
    .select()
    .from(badge)
    .where(and(eq(badge.id, id), eq(badge.householdId, admin.householdId)))
    .limit(1);
  if (!before[0]) return 'not_found';

  try {
    await db
      .update(badge)
      .set({
        titleHe: parsed.titleHe,
        titleEn: parsed.titleEn,
        descriptionHe: parsed.descriptionHe,
        descriptionEn: parsed.descriptionEn,
        iconKey: parsed.iconKey,
        color: parsed.color,
        awardedVia: parsed.awardedVia,
        displayOrder: parsed.displayOrder,
      })
      .where(eq(badge.id, id));

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'badge.updated',
      targetKind: 'badge',
      targetId: id,
      beforeJson: before[0],
      afterJson: parsed,
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('updateBadgeAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  redirect(`/${lang}/admin/badges`);
}

export async function toggleArchiveBadgeAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!id) return;
  const admin = await requireAdmin();

  const db = getDb();
  const rows = await db
    .select({ id: badge.id, archivedAt: badge.archivedAt })
    .from(badge)
    .where(and(eq(badge.id, id), eq(badge.householdId, admin.householdId)))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const newValue = row.archivedAt ? null : new Date();
  await db.update(badge).set({ archivedAt: newValue }).where(eq(badge.id, id));

  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: newValue ? 'badge.archived' : 'badge.unarchived',
    targetKind: 'badge',
    targetId: id,
  });

  // Form lives ON /admin/badges — redirect-to-same-URL is a Pattern C no-op;
  // revalidatePath alone refreshes the list.
  revalidatePath('/[lang]/admin', 'layout');
}
