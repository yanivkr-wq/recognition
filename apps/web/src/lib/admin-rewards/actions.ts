/**
 * Admin server actions for reward CRUD.
 *
 * Rewards are household-wide (no per-kid assignment toggle — the kid shop
 * shows every `visible_to_kids = true AND archived_at IS NULL` reward). The
 * surface is therefore simpler than the task templates: create, edit,
 * archive/unarchive, visibility toggle.
 *
 * Archiving is the soft-delete: existing redemptions snapshot their title /
 * cost so a renamed-or-archived reward never rewrites history. Hard-delete
 * is intentionally not supported in v1 (would break the redemption FK).
 *
 * Audit log: every mutation appends an audit_log entry. Both parents see
 * the household audit feed (Phase 6 sub-6h).
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb, rewardItem, auditLog } from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';

export type RewardFormError =
  | 'invalid_title'
  | 'invalid_coin_cost'
  | 'invalid_color'
  | 'invalid_stock'
  | 'invalid_cap'
  | 'invalid_icon'
  | 'forbidden'
  | 'not_found'
  | 'internal';

interface ParsedReward {
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  iconKey: string;
  color: string;
  coinCost: number;
  stockQuantity: number | null;
  maxPerKidPerDay: number | null;
  displayOrder: number;
  visibleToKids: boolean;
}

function parseRewardForm(formData: FormData): ParsedReward | RewardFormError {
  const titleHe = String(formData.get('titleHe') ?? '').trim();
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  if (!titleHe || !titleEn) return 'invalid_title';

  const descriptionHe = String(formData.get('descriptionHe') ?? '').trim() || null;
  const descriptionEn = String(formData.get('descriptionEn') ?? '').trim() || null;

  const iconKey = String(formData.get('iconKey') ?? '').trim();
  if (!iconKey) return 'invalid_icon';

  const color = String(formData.get('color') ?? '#FFF0F6').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return 'invalid_color';

  const coinCost = Number.parseInt(String(formData.get('coinCost') ?? ''), 10);
  if (!Number.isInteger(coinCost) || coinCost <= 0) return 'invalid_coin_cost';

  // Both stock + cap are nullable (empty input = unlimited).
  const stockRaw = String(formData.get('stockQuantity') ?? '').trim();
  let stockQuantity: number | null = null;
  if (stockRaw !== '') {
    const v = Number.parseInt(stockRaw, 10);
    if (!Number.isInteger(v) || v < 0) return 'invalid_stock';
    stockQuantity = v;
  }

  const capRaw = String(formData.get('maxPerKidPerDay') ?? '').trim();
  let maxPerKidPerDay: number | null = null;
  if (capRaw !== '') {
    const v = Number.parseInt(capRaw, 10);
    if (!Number.isInteger(v) || v < 1) return 'invalid_cap';
    maxPerKidPerDay = v;
  }

  const orderRaw = String(formData.get('displayOrder') ?? '50');
  const orderParsed = Number.parseInt(orderRaw, 10);
  const displayOrder = Number.isInteger(orderParsed) ? orderParsed : 50;

  const visibleToKids = formData.get('visibleToKids') === 'on';

  return {
    titleHe,
    titleEn,
    descriptionHe,
    descriptionEn,
    iconKey,
    color,
    coinCost,
    stockQuantity,
    maxPerKidPerDay,
    displayOrder,
    visibleToKids,
  };
}

export async function createRewardAction(
  _prev: RewardFormError | undefined,
  formData: FormData,
): Promise<RewardFormError | undefined> {
  const lang = String(formData.get('lang') ?? 'he');

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return 'forbidden';
    throw err;
  }
  const parsed = parseRewardForm(formData);
  if (typeof parsed === 'string') return parsed;

  const db = getDb();
  try {
    const [row] = await db
      .insert(rewardItem)
      .values({
        householdId: admin.householdId,
        titleHe: parsed.titleHe,
        titleEn: parsed.titleEn,
        descriptionHe: parsed.descriptionHe,
        descriptionEn: parsed.descriptionEn,
        iconKey: parsed.iconKey,
        color: parsed.color,
        coinCost: parsed.coinCost,
        stockQuantity: parsed.stockQuantity,
        maxPerKidPerDay: parsed.maxPerKidPerDay,
        displayOrder: parsed.displayOrder,
        visibleToKids: parsed.visibleToKids,
      })
      .returning({ id: rewardItem.id });

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'reward_item.created',
      targetKind: 'reward_item',
      targetId: row!.id,
      afterJson: parsed,
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('createRewardAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/redeem', 'page');
  redirect(`/${lang}/admin/rewards`);
}

export async function updateRewardAction(
  _prev: RewardFormError | undefined,
  formData: FormData,
): Promise<RewardFormError | undefined> {
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
  const parsed = parseRewardForm(formData);
  if (typeof parsed === 'string') return parsed;

  const db = getDb();
  const before = await db
    .select()
    .from(rewardItem)
    .where(and(eq(rewardItem.id, id), eq(rewardItem.householdId, admin.householdId)))
    .limit(1);
  if (!before[0]) return 'not_found';

  try {
    await db
      .update(rewardItem)
      .set({
        titleHe: parsed.titleHe,
        titleEn: parsed.titleEn,
        descriptionHe: parsed.descriptionHe,
        descriptionEn: parsed.descriptionEn,
        iconKey: parsed.iconKey,
        color: parsed.color,
        coinCost: parsed.coinCost,
        stockQuantity: parsed.stockQuantity,
        maxPerKidPerDay: parsed.maxPerKidPerDay,
        displayOrder: parsed.displayOrder,
        visibleToKids: parsed.visibleToKids,
        updatedAt: new Date(),
      })
      .where(eq(rewardItem.id, id));

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'reward_item.updated',
      targetKind: 'reward_item',
      targetId: id,
      beforeJson: before[0],
      afterJson: parsed,
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('updateRewardAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/redeem', 'page');
  redirect(`/${lang}/admin/rewards`);
}

/**
 * Bulk operations over a set of selected rewards (Lily's request: "bulk edit,
 * bulk remove, bulk add points…"). All scoped to the admin's household.
 *
 * Operations:
 *   - archive / unarchive  — soft-delete toggle (remove = archive).
 *   - show / hide          — flip visible_to_kids.
 *   - addPoints            — add `amount` coins to each reward's cost (>= 1).
 *
 * One audit row per affected reward keeps the household feed honest.
 */
export type BulkRewardOp = 'archive' | 'unarchive' | 'show' | 'hide' | 'addPoints';

export async function bulkUpdateRewardsAction(formData: FormData): Promise<void> {
  const lang = String(formData.get('lang') ?? 'he');
  const op = String(formData.get('op') ?? '') as BulkRewardOp;
  const ids = formData
    .getAll('ids')
    .map((v) => String(v))
    .filter(Boolean);
  if (ids.length === 0) return;

  const admin = await requireAdmin();
  const db = getDb();

  // Constrain to the household so a spoofed id can't touch another family.
  const owned = await db
    .select({ id: rewardItem.id })
    .from(rewardItem)
    .where(and(eq(rewardItem.householdId, admin.householdId), inArray(rewardItem.id, ids)));
  const ownedIds = owned.map((r) => r.id);
  if (ownedIds.length === 0) return;

  const now = new Date();
  let action: string;
  switch (op) {
    case 'archive':
      await db.update(rewardItem).set({ archivedAt: now, updatedAt: now }).where(inArray(rewardItem.id, ownedIds));
      action = 'reward_item.archived';
      break;
    case 'unarchive':
      await db.update(rewardItem).set({ archivedAt: null, updatedAt: now }).where(inArray(rewardItem.id, ownedIds));
      action = 'reward_item.unarchived';
      break;
    case 'show':
      await db.update(rewardItem).set({ visibleToKids: true, updatedAt: now }).where(inArray(rewardItem.id, ownedIds));
      action = 'reward_item.shown';
      break;
    case 'hide':
      await db.update(rewardItem).set({ visibleToKids: false, updatedAt: now }).where(inArray(rewardItem.id, ownedIds));
      action = 'reward_item.hidden';
      break;
    case 'addPoints': {
      const amount = Number.parseInt(String(formData.get('amount') ?? ''), 10);
      if (!Number.isInteger(amount) || amount === 0) return;
      // GREATEST(1, …) keeps cost a positive integer even if a delta would
      // push it to/below zero.
      await db
        .update(rewardItem)
        .set({ coinCost: sql`GREATEST(1, ${rewardItem.coinCost} + ${amount})`, updatedAt: now })
        .where(inArray(rewardItem.id, ownedIds));
      action = 'reward_item.points_adjusted';
      break;
    }
    default:
      return;
  }

  await db.insert(auditLog).values(
    ownedIds.map((id) => ({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action,
      targetKind: 'reward_item' as const,
      targetId: id,
      afterJson: op === 'addPoints' ? { amount: Number(formData.get('amount')) } : undefined,
    })),
  );

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/redeem', 'page');
  redirect(`/${lang}/admin/rewards`);
}

export async function toggleArchiveRewardAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!id) return;
  const admin = await requireAdmin();

  const db = getDb();
  const rows = await db
    .select({ id: rewardItem.id, archivedAt: rewardItem.archivedAt })
    .from(rewardItem)
    .where(and(eq(rewardItem.id, id), eq(rewardItem.householdId, admin.householdId)))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const newValue = row.archivedAt ? null : new Date();
  await db
    .update(rewardItem)
    .set({ archivedAt: newValue, updatedAt: new Date() })
    .where(eq(rewardItem.id, id));

  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: newValue ? 'reward_item.archived' : 'reward_item.unarchived',
    targetKind: 'reward_item',
    targetId: id,
  });

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/redeem', 'page');
  redirect(`/${lang}/admin/rewards`);
}
