/**
 * Admin server actions for campaign CRUD.
 *
 * v1 surface:
 *   - createCampaignAction — full create with feeding-task picker + kids
 *     picker + optional badge_id. Enrollments land in the same tx.
 *   - updateCampaignAction — edit title/description/dates/bonus_coins +
 *     toggle feeding tasks. Kind is immutable (changing streak ↔ total
 *     mid-campaign would silently invalidate the enrollment state).
 *     Enrolled kids are also immutable in v1 — admins archive + recreate
 *     if they need to swap kids.
 *   - toggleArchiveCampaignAction — soft delete; the engines + cron skip
 *     archived campaigns automatically.
 *
 * Every mutation writes an audit_log row. The household_id filter on every
 * SELECT/UPDATE keeps actions scoped to the admin's household.
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import {
  getDb,
  getPool,
  campaign as campaignTable,
  campaignFeedingTask,
  campaignEnrollment,
  auditLog,
} from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';

export type CampaignFormError =
  | 'invalid_title'
  | 'invalid_dates'
  | 'invalid_kind'
  | 'invalid_bonus'
  | 'invalid_streak_fields'
  | 'invalid_total_fields'
  | 'no_feeding_tasks'
  | 'no_kids'
  | 'forbidden'
  | 'not_found'
  | 'internal';

interface ParsedCampaign {
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  kind: 'streak' | 'total';
  startDate: string;
  endDate: string;
  bonusCoins: number;
  badgeId: string | null;
  streakTargetDays: number | null;
  streakFreezesAllowed: number;
  streakPerDayThreshold: number | null;
  totalTargetQuantity: number | null;
  /** Display unit label for a 'total' journey target (hours / pages / …). */
  measureUnit: string | null;
  nudgeCadence: 'standard' | 'aggressive' | 'gentle' | 'silent';
  feedingTemplateIds: string[];
  kidIds: string[];
}

function parseCampaignForm(
  formData: FormData,
  opts: { requireKids?: boolean } = {},
): ParsedCampaign | CampaignFormError {
  const requireKids = opts.requireKids ?? true;
  const titleHe = String(formData.get('titleHe') ?? '').trim();
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  if (!titleHe || !titleEn) return 'invalid_title';

  const descriptionHe = String(formData.get('descriptionHe') ?? '').trim() || null;
  const descriptionEn = String(formData.get('descriptionEn') ?? '').trim() || null;

  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
    return 'invalid_dates';
  if (endDate < startDate) return 'invalid_dates';

  const kindRaw = String(formData.get('kind') ?? '');
  if (kindRaw !== 'streak' && kindRaw !== 'total') return 'invalid_kind';
  const kind: 'streak' | 'total' = kindRaw;

  const bonusCoins = Number.parseInt(String(formData.get('bonusCoins') ?? '0'), 10);
  if (!Number.isInteger(bonusCoins) || bonusCoins < 0) return 'invalid_bonus';

  const badgeRaw = String(formData.get('badgeId') ?? '').trim();
  const badgeId = badgeRaw === '' ? null : badgeRaw;

  const nudgeRaw = String(formData.get('nudgeCadence') ?? 'standard');
  const nudgeCadence: ParsedCampaign['nudgeCadence'] =
    nudgeRaw === 'aggressive' || nudgeRaw === 'gentle' || nudgeRaw === 'silent'
      ? nudgeRaw
      : 'standard';

  let streakTargetDays: number | null = null;
  let streakFreezesAllowed = 1;
  let streakPerDayThreshold: number | null = null;
  let totalTargetQuantity: number | null = null;
  let measureUnit: string | null = null;

  if (kind === 'streak') {
    const t = Number.parseInt(String(formData.get('streakTargetDays') ?? ''), 10);
    const f = Number.parseInt(String(formData.get('streakFreezesAllowed') ?? '1'), 10);
    if (!Number.isInteger(t) || t < 1) return 'invalid_streak_fields';
    if (!Number.isInteger(f) || f < 0) return 'invalid_streak_fields';
    streakTargetDays = t;
    streakFreezesAllowed = f;
    const thRaw = String(formData.get('streakPerDayThreshold') ?? '').trim();
    if (thRaw !== '') {
      const th = Number.parseInt(thRaw, 10);
      if (!Number.isInteger(th) || th < 1) return 'invalid_streak_fields';
      streakPerDayThreshold = th;
    }
  } else {
    const q = Number.parseInt(String(formData.get('totalTargetQuantity') ?? ''), 10);
    if (!Number.isInteger(q) || q < 1) return 'invalid_total_fields';
    totalTargetQuantity = q;
    measureUnit = String(formData.get('measureUnit') ?? '').trim() || null;
  }

  // formData.getAll returns the multi-select values verbatim.
  const feedingTemplateIds = formData.getAll('feedingTemplateIds').map(String).filter(Boolean);
  if (feedingTemplateIds.length === 0) return 'no_feeding_tasks';

  const kidIds = formData.getAll('kidIds').map(String).filter(Boolean);
  if (requireKids && kidIds.length === 0) return 'no_kids';

  return {
    titleHe,
    titleEn,
    descriptionHe,
    descriptionEn,
    kind,
    startDate,
    endDate,
    bonusCoins,
    badgeId,
    streakTargetDays,
    streakFreezesAllowed,
    streakPerDayThreshold,
    totalTargetQuantity,
    measureUnit,
    nudgeCadence,
    feedingTemplateIds,
    kidIds,
  };
}

export async function createCampaignAction(
  _prev: CampaignFormError | undefined,
  formData: FormData,
): Promise<CampaignFormError | undefined> {
  const lang = String(formData.get('lang') ?? 'he');
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return 'forbidden';
    throw err;
  }
  const parsed = parseCampaignForm(formData);
  if (typeof parsed === 'string') return parsed;

  // INSERT campaign + feeding tasks + enrollments atomically. The CHECK
  // constraint on campaign enforces kind/field mutual exclusion at the DB
  // layer (defense-in-depth alongside our validation).
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const campRes = await client.query<{ id: string }>(
      `INSERT INTO campaign (
         household_id, title_he, title_en, description_he, description_en,
         kind, start_date, end_date, bonus_coins, badge_id,
         streak_target_days, streak_freezes_allowed, streak_per_day_threshold,
         total_target_quantity, measure_unit, nudge_cadence
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7::date, $8::date, $9, $10,
         $11, $12, $13,
         $14, $15, $16
       )
       RETURNING id`,
      [
        admin.householdId,
        parsed.titleHe,
        parsed.titleEn,
        parsed.descriptionHe,
        parsed.descriptionEn,
        parsed.kind,
        parsed.startDate,
        parsed.endDate,
        parsed.bonusCoins,
        parsed.badgeId,
        parsed.streakTargetDays,
        parsed.streakFreezesAllowed,
        parsed.streakPerDayThreshold,
        parsed.totalTargetQuantity,
        parsed.measureUnit,
        parsed.nudgeCadence,
      ],
    );
    const campaignId = campRes.rows[0]!.id;

    for (const tid of parsed.feedingTemplateIds) {
      await client.query(
        `INSERT INTO campaign_feeding_task (campaign_id, template_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [campaignId, tid],
      );
    }
    for (const kid of parsed.kidIds) {
      await client.query(
        `INSERT INTO campaign_enrollment (household_id, campaign_id, kid_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (campaign_id, kid_id) DO NOTHING`,
        [admin.householdId, campaignId, kid],
      );
    }

    const hdrs = await headers();
    await client.query(
      `INSERT INTO audit_log (
         household_id, actor_user_id, action, target_kind, target_id,
         after_json, request_ip, user_agent
       ) VALUES (
         $1, $2, 'campaign.created', 'campaign', $3,
         $4, $5, $6
       )`,
      [
        admin.householdId,
        admin.userId,
        campaignId,
        JSON.stringify(parsed),
        hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        hdrs.get('user-agent') ?? null,
      ],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('createCampaignAction failed', err);
    return 'internal';
  } finally {
    client.release();
  }

  revalidatePath('/[lang]/admin', 'layout');
  redirect(`/${lang}/admin/campaigns`);
}

export async function updateCampaignAction(
  _prev: CampaignFormError | undefined,
  formData: FormData,
): Promise<CampaignFormError | undefined> {
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

  // Enrolled kids + kind are immutable post-creation (changing either would
  // silently invalidate the engine-derived enrollment state). The form locks
  // both; we re-validate kind against the stored row below.
  const parsed = parseCampaignForm(formData, { requireKids: false });
  if (typeof parsed === 'string') return parsed;

  const db = getDb();
  const before = await db
    .select()
    .from(campaignTable)
    .where(and(eq(campaignTable.id, id), eq(campaignTable.householdId, admin.householdId)))
    .limit(1);
  if (!before[0]) return 'not_found';
  if (before[0].kind !== parsed.kind) return 'invalid_kind';

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE campaign SET
         title_he = $2, title_en = $3, description_he = $4, description_en = $5,
         start_date = $6::date, end_date = $7::date, bonus_coins = $8, badge_id = $9,
         streak_target_days = $10, streak_freezes_allowed = $11,
         streak_per_day_threshold = $12, total_target_quantity = $13,
         nudge_cadence = $14, measure_unit = $15
       WHERE id = $1`,
      [
        id,
        parsed.titleHe,
        parsed.titleEn,
        parsed.descriptionHe,
        parsed.descriptionEn,
        parsed.startDate,
        parsed.endDate,
        parsed.bonusCoins,
        parsed.badgeId,
        parsed.streakTargetDays,
        parsed.streakFreezesAllowed,
        parsed.streakPerDayThreshold,
        parsed.totalTargetQuantity,
        parsed.nudgeCadence,
        parsed.measureUnit,
      ],
    );

    // Replace the feeding-task set: drop the old links, insert the new
    // selection. Enrollments and completion history are untouched.
    await client.query(`DELETE FROM campaign_feeding_task WHERE campaign_id = $1`, [id]);
    for (const tid of parsed.feedingTemplateIds) {
      await client.query(
        `INSERT INTO campaign_feeding_task (campaign_id, template_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, tid],
      );
    }

    const hdrs = await headers();
    await client.query(
      `INSERT INTO audit_log (
         household_id, actor_user_id, action, target_kind, target_id,
         before_json, after_json, request_ip, user_agent
       ) VALUES (
         $1, $2, 'campaign.updated', 'campaign', $3, $4, $5, $6, $7
       )`,
      [
        admin.householdId,
        admin.userId,
        id,
        JSON.stringify(before[0]),
        JSON.stringify(parsed),
        hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        hdrs.get('user-agent') ?? null,
      ],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('updateCampaignAction failed', err);
    return 'internal';
  } finally {
    client.release();
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]/campaigns', 'page');
  redirect(`/${lang}/admin/campaigns`);
}

export async function toggleArchiveCampaignAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!id) return;
  const admin = await requireAdmin();

  const db = getDb();
  const rows = await db
    .select({ id: campaignTable.id, archivedAt: campaignTable.archivedAt })
    .from(campaignTable)
    .where(and(eq(campaignTable.id, id), eq(campaignTable.householdId, admin.householdId)))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const newValue = row.archivedAt ? null : new Date();
  await db
    .update(campaignTable)
    .set({ archivedAt: newValue })
    .where(eq(campaignTable.id, id));

  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: newValue ? 'campaign.archived' : 'campaign.unarchived',
    targetKind: 'campaign',
    targetId: id,
  });

  revalidatePath('/[lang]/admin', 'layout');
  redirect(`/${lang}/admin/campaigns`);
}

// Touched re-exports so unused-import lint doesn't kick the form types around.
void campaignFeedingTask;
void campaignEnrollment;
