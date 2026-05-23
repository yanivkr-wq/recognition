/**
 * Admin server actions for task templates + per-kid assignment toggles.
 *
 * All actions require an admin (parent) session — household-scoped, never
 * touches another household's rows. Phase 3 keeps the surface small: create
 * a daily template, edit it, archive/unarchive, and toggle per-kid
 * assignment on/off. Long-term templates (with goal + per-unit + bonus
 * fields) land in Phase 4.
 *
 * Audit log: every mutation appends an audit_log entry so both parents see
 * what the other did. Required for the household-wide audit feed (Phase 6)
 * but cheap to write now.
 *
 * Form signature: every action uses (prevState, FormData) so the calling
 * client component can pass it straight to useActionState (lesson from the
 * Phase 2 set-PIN form — wrapping a server action in a client async fn
 * silently strips its server-action-ness).
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import {
  getDb,
  taskTemplate,
  taskAssignment,
  auditLog,
  kid as kidTable,
} from '@reco/db';
import { requireAdmin, UnauthorizedError } from '../auth/guards';

export type TaskFormError =
  | 'invalid_title'
  | 'invalid_coin_value'
  | 'invalid_color'
  | 'invalid_long_term_fields'
  | 'forbidden'
  | 'not_found'
  | 'internal';

interface ParsedDaily {
  kind: 'daily';
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  iconKey: string;
  color: string;
  coinValue: number;
  evidenceRequired: boolean;
  displayOrder: number;
  /** Phase 7.5: optional 'HH:MM' or 'HH:MM:SS' deadline. null = no deadline. */
  deadlineTime: string | null;
}

interface ParsedLongTerm {
  kind: 'long_term';
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  iconKey: string;
  color: string;
  coinValue: 0;
  evidenceRequired: boolean;
  displayOrder: number;
  longTermUnitLabelHe: string;
  longTermUnitLabelEn: string;
  longTermPerUnitCoins: number;
  longTermGoalQuantity: number;
  longTermBonusOnComplete: number | null;
}

type ParsedTask = ParsedDaily | ParsedLongTerm;

function parseTaskForm(formData: FormData): ParsedTask | TaskFormError {
  const kindRaw = String(formData.get('kind') ?? 'daily');
  const kind: 'daily' | 'long_term' = kindRaw === 'long_term' ? 'long_term' : 'daily';

  const titleHe = String(formData.get('titleHe') ?? '').trim();
  const titleEn = String(formData.get('titleEn') ?? '').trim();
  if (!titleHe || !titleEn) return 'invalid_title';

  const descriptionHe = String(formData.get('descriptionHe') ?? '').trim() || null;
  const descriptionEn = String(formData.get('descriptionEn') ?? '').trim() || null;

  const color = String(formData.get('color') ?? '#ECE4F8').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return 'invalid_color';

  const iconKey = String(formData.get('iconKey') ?? '').trim() || 'ic-bed';
  const evidenceRequired = formData.get('evidenceRequired') === 'on';

  const displayOrderRaw = String(formData.get('displayOrder') ?? '50');
  const displayOrderParsed = Number.parseInt(displayOrderRaw, 10);
  const displayOrder = Number.isInteger(displayOrderParsed) ? displayOrderParsed : 50;

  const common = {
    titleHe,
    titleEn,
    descriptionHe,
    descriptionEn,
    iconKey,
    color,
    evidenceRequired,
    displayOrder,
  };

  if (kind === 'daily') {
    const coinValueRaw = String(formData.get('coinValue') ?? '0');
    const coinValue = Number.parseInt(coinValueRaw, 10);
    if (!Number.isInteger(coinValue) || coinValue < 0) return 'invalid_coin_value';
    const deadlineRaw = String(formData.get('deadlineTime') ?? '').trim();
    let deadlineTime: string | null = null;
    if (deadlineRaw !== '') {
      // <input type="time"> returns 'HH:MM'. Normalize to 'HH:MM:00' for
      // Postgres TIME column.
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deadlineRaw)) return 'invalid_coin_value';
      deadlineTime = deadlineRaw + ':00';
    }
    return { ...common, kind: 'daily', coinValue, deadlineTime };
  }

  // long_term — all four required fields per DB CHECK + per-unit must be > 0.
  const unitHe = String(formData.get('longTermUnitLabelHe') ?? '').trim();
  const unitEn = String(formData.get('longTermUnitLabelEn') ?? '').trim();
  const perUnit = Number.parseInt(String(formData.get('longTermPerUnitCoins') ?? ''), 10);
  const goal = Number.parseInt(String(formData.get('longTermGoalQuantity') ?? ''), 10);
  const bonusRaw = String(formData.get('longTermBonusOnComplete') ?? '').trim();
  const bonus = bonusRaw === '' ? null : Number.parseInt(bonusRaw, 10);

  if (
    !unitHe ||
    !unitEn ||
    !Number.isInteger(perUnit) ||
    perUnit < 1 ||
    !Number.isInteger(goal) ||
    goal < 1 ||
    (bonus != null && (!Number.isInteger(bonus) || bonus < 0))
  ) {
    return 'invalid_long_term_fields';
  }

  return {
    ...common,
    kind: 'long_term',
    coinValue: 0,
    longTermUnitLabelHe: unitHe,
    longTermUnitLabelEn: unitEn,
    longTermPerUnitCoins: perUnit,
    longTermGoalQuantity: goal,
    longTermBonusOnComplete: bonus,
  };
}

export async function createTaskTemplateAction(
  _prev: TaskFormError | undefined,
  formData: FormData,
): Promise<TaskFormError | undefined> {
  const lang = String(formData.get('lang') ?? 'he');
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return 'forbidden';
    throw err;
  }
  const parsed = parseTaskForm(formData);
  if (typeof parsed === 'string') return parsed;

  const db = getDb();
  try {
    const [row] = await db
      .insert(taskTemplate)
      .values({
        householdId: admin.householdId,
        kind: parsed.kind,
        titleHe: parsed.titleHe,
        titleEn: parsed.titleEn,
        descriptionHe: parsed.descriptionHe,
        descriptionEn: parsed.descriptionEn,
        iconKey: parsed.iconKey,
        color: parsed.color,
        coinValue: parsed.coinValue,
        evidenceRequired: parsed.evidenceRequired,
        displayOrder: parsed.displayOrder,
        longTermUnitLabelHe:
          parsed.kind === 'long_term' ? parsed.longTermUnitLabelHe : null,
        longTermUnitLabelEn:
          parsed.kind === 'long_term' ? parsed.longTermUnitLabelEn : null,
        longTermPerUnitCoins:
          parsed.kind === 'long_term' ? parsed.longTermPerUnitCoins : null,
        longTermGoalQuantity:
          parsed.kind === 'long_term' ? parsed.longTermGoalQuantity : null,
        longTermBonusOnComplete:
          parsed.kind === 'long_term' ? parsed.longTermBonusOnComplete : null,
        deadlineTime: parsed.kind === 'daily' ? parsed.deadlineTime : null,
      })
      .returning({ id: taskTemplate.id });

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'task_template.created',
      targetKind: 'task_template',
      targetId: row!.id,
      afterJson: parsed,
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('createTaskTemplateAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  redirect(`/${lang}/admin/tasks`);
}

export async function updateTaskTemplateAction(
  _prev: TaskFormError | undefined,
  formData: FormData,
): Promise<TaskFormError | undefined> {
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

  const parsed = parseTaskForm(formData);
  if (typeof parsed === 'string') return parsed;

  const db = getDb();
  const before = await db
    .select()
    .from(taskTemplate)
    .where(and(eq(taskTemplate.id, id), eq(taskTemplate.householdId, admin.householdId)))
    .limit(1);
  if (!before[0]) return 'not_found';

  // Block kind changes: switching a template from daily → long_term (or back)
  // would silently invalidate any existing task_completion / long_term_progress
  // rows that reference it. If the admin wants the other kind, they archive
  // and create a new template.
  if (before[0].kind !== parsed.kind) {
    return 'invalid_long_term_fields';
  }

  try {
    await db
      .update(taskTemplate)
      .set({
        titleHe: parsed.titleHe,
        titleEn: parsed.titleEn,
        descriptionHe: parsed.descriptionHe,
        descriptionEn: parsed.descriptionEn,
        iconKey: parsed.iconKey,
        color: parsed.color,
        coinValue: parsed.coinValue,
        evidenceRequired: parsed.evidenceRequired,
        displayOrder: parsed.displayOrder,
        longTermUnitLabelHe:
          parsed.kind === 'long_term' ? parsed.longTermUnitLabelHe : null,
        longTermUnitLabelEn:
          parsed.kind === 'long_term' ? parsed.longTermUnitLabelEn : null,
        longTermPerUnitCoins:
          parsed.kind === 'long_term' ? parsed.longTermPerUnitCoins : null,
        longTermGoalQuantity:
          parsed.kind === 'long_term' ? parsed.longTermGoalQuantity : null,
        longTermBonusOnComplete:
          parsed.kind === 'long_term' ? parsed.longTermBonusOnComplete : null,
        deadlineTime: parsed.kind === 'daily' ? parsed.deadlineTime : null,
        updatedAt: new Date(),
      })
      .where(eq(taskTemplate.id, id));

    const hdrs = await headers();
    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'task_template.updated',
      targetKind: 'task_template',
      targetId: id,
      beforeJson: before[0],
      afterJson: parsed,
      requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: hdrs.get('user-agent') ?? null,
    });
  } catch (err) {
    console.error('updateTaskTemplateAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  redirect(`/${lang}/admin/tasks`);
}

export async function toggleArchiveTaskTemplateAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  if (!id) return;
  const admin = await requireAdmin();

  const db = getDb();
  const rows = await db
    .select({ id: taskTemplate.id, archivedAt: taskTemplate.archivedAt })
    .from(taskTemplate)
    .where(and(eq(taskTemplate.id, id), eq(taskTemplate.householdId, admin.householdId)))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const newValue = row.archivedAt ? null : new Date();
  await db
    .update(taskTemplate)
    .set({ archivedAt: newValue, updatedAt: new Date() })
    .where(eq(taskTemplate.id, id));

  await db.insert(auditLog).values({
    householdId: admin.householdId,
    actorUserId: admin.userId,
    action: newValue ? 'task_template.archived' : 'task_template.unarchived',
    targetKind: 'task_template',
    targetId: id,
  });

  revalidatePath('/[lang]/admin', 'layout');
  redirect(`/${lang}/admin/tasks`);
}

/**
 * Phase 7.5: admin completes a deadline-locked task on a kid's behalf.
 *
 * Use case (from BUILD-PLAN exit narrative): kid missed their 8:00 AM
 * "brush teeth" deadline. The parent decides to give them the credit
 * anyway. This action runs the same ledger.post + campaign fanout as a
 * normal kid-side completion, but bypasses the time-of-day gate and
 * attributes the actor as the admin in `audit_log`.
 *
 * Behaviorally identical to `completeTaskAction` after auth — but the
 * actor is the parent and there's an `admin_reopened` audit row alongside.
 * If the task is evidence-required, this opens it as `auto_approved` so
 * the parent doesn't need to also click approve.
 */
import { processCompletionForCampaigns, ledgerPost as _ledgerPostMarker } from '@reco/db';
void _ledgerPostMarker;

export type AdminReopenState =
  | { ok: true; completionId: string }
  | { ok: false; error: 'forbidden' | 'not_found' | 'already_done' | 'internal' };

export async function adminCompleteForKidAction(
  _prev: AdminReopenState | undefined,
  formData: FormData,
): Promise<AdminReopenState> {
  const assignmentId = String(formData.get('assignmentId') ?? '');
  if (!assignmentId) return { ok: false, error: 'not_found' };
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const aRows = await getDb()
    .select({
      kidId: taskAssignment.kidId,
      templateId: taskAssignment.templateId,
      enabled: taskAssignment.enabled,
      archivedAt: taskAssignment.archivedAt,
      householdId: taskAssignment.householdId,
      kind: taskTemplate.kind,
      coinValue: taskTemplate.coinValue,
    })
    .from(taskAssignment)
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskAssignment.templateId))
    .where(
      and(
        eq(taskAssignment.id, assignmentId),
        eq(taskAssignment.householdId, admin.householdId),
      ),
    )
    .limit(1);
  const a = aRows[0];
  if (!a || a.archivedAt || !a.enabled || a.kind !== 'daily') {
    return { ok: false, error: 'not_found' };
  }

  const { getPool, ledgerPost } = await import('@reco/db');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const todayRes = await client.query<{ today: string }>(
      `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text AS today`,
    );
    const completionDate = todayRes.rows[0]!.today;

    let completionId: string;
    try {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO task_completion (
           household_id, assignment_id, kid_id, completion_date, approval_status
         ) VALUES ($1, $2, $3, $4, 'auto_approved')
         RETURNING id`,
        [a.householdId, assignmentId, a.kidId, completionDate],
      );
      completionId = inserted.rows[0]!.id;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        await client.query('ROLLBACK');
        return { ok: false, error: 'already_done' };
      }
      throw err;
    }

    const entry = await ledgerPost(client, {
      kind: 'earn',
      householdId: a.householdId,
      kidId: a.kidId,
      amount: a.coinValue,
      taskCompletionId: completionId,
    });
    await client.query(
      `UPDATE task_completion SET ledger_credit_id = $1, updated_at = now() WHERE id = $2`,
      [entry.id, completionId],
    );

    // Audit + run the campaign engine just like a kid-side completion does.
    await client.query(
      `INSERT INTO audit_log (
         household_id, actor_user_id, action, target_kind, target_id, after_json
       ) VALUES ($1, $2, 'task.admin_reopened', 'task_completion', $3, $4)`,
      [
        a.householdId,
        admin.userId,
        completionId,
        JSON.stringify({
          assignment_id: assignmentId,
          kid_id: a.kidId,
          coins: a.coinValue,
          ledger_entry_id: entry.id,
        }),
      ],
    );
    await processCompletionForCampaigns(client, {
      kidId: a.kidId,
      householdId: a.householdId,
      templateId: a.templateId,
      asOfDate: completionDate,
    });

    await client.query('COMMIT');
    revalidatePath('/[lang]', 'layout');
    revalidatePath('/[lang]/admin', 'layout');
    return { ok: true, completionId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('adminCompleteForKidAction failed', err);
    return { ok: false, error: 'internal' };
  } finally {
    client.release();
  }
}

/** Void wrapper for inline <form action={...}> usage where useActionState
 *  isn't needed (the admin ledger reopen button is a fire-and-forget). */
export async function adminCompleteForKidFormAction(formData: FormData): Promise<void> {
  await adminCompleteForKidAction(undefined, formData);
}

export type ToggleAssignmentResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: 'forbidden' | 'not_found' | 'internal' };

export async function toggleAssignmentAction(
  _prev: ToggleAssignmentResult | undefined,
  formData: FormData,
): Promise<ToggleAssignmentResult> {
  const templateId = String(formData.get('templateId') ?? '');
  const kidId = String(formData.get('kidId') ?? '');
  if (!templateId || !kidId) return { ok: false, error: 'not_found' };

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const db = getDb();
  // Verify both template and kid belong to this household.
  const tRows = await db
    .select({ id: taskTemplate.id })
    .from(taskTemplate)
    .where(and(eq(taskTemplate.id, templateId), eq(taskTemplate.householdId, admin.householdId)))
    .limit(1);
  if (!tRows[0]) return { ok: false, error: 'not_found' };
  const kRows = await db
    .select({ id: kidTable.id })
    .from(kidTable)
    .where(
      and(
        eq(kidTable.id, kidId),
        eq(kidTable.householdId, admin.householdId),
        isNull(kidTable.archivedAt),
      ),
    )
    .limit(1);
  if (!kRows[0]) return { ok: false, error: 'not_found' };

  try {
    const existing = await db
      .select({ id: taskAssignment.id, enabled: taskAssignment.enabled })
      .from(taskAssignment)
      .where(
        and(eq(taskAssignment.templateId, templateId), eq(taskAssignment.kidId, kidId)),
      )
      .limit(1);

    let enabled: boolean;
    if (existing[0]) {
      enabled = !existing[0].enabled;
      await db
        .update(taskAssignment)
        .set({ enabled, archivedAt: enabled ? null : new Date() })
        .where(eq(taskAssignment.id, existing[0].id));
    } else {
      enabled = true;
      await db.insert(taskAssignment).values({
        householdId: admin.householdId,
        templateId,
        kidId,
        enabled: true,
      });
    }

    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: enabled ? 'task_assignment.enabled' : 'task_assignment.disabled',
      targetKind: 'task_assignment',
      targetId: null,
      afterJson: { templateId, kidId, enabled },
    });

    revalidatePath('/[lang]/admin', 'layout');
    return { ok: true, enabled };
  } catch (err) {
    console.error('toggleAssignmentAction failed', err);
    return { ok: false, error: 'internal' };
  }
}

/**
 * Void wrapper for inline `<form action={...}>` usage where we don't need
 * to consume the result via useActionState. The page re-renders via
 * revalidatePath so the new state is visible after submission.
 */
export async function toggleAssignmentFormAction(formData: FormData): Promise<void> {
  await toggleAssignmentAction(undefined, formData);
}
