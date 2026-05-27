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
import { and, eq, isNull, inArray } from 'drizzle-orm';
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
  /** Times/day this task may be completed. null = unlimited; 1 = once. */
  maxPerDay: number | null;
  /** Amount one completion contributes to a journey it feeds. null = none. */
  measureAmount: number | null;
  /** Display unit label for the measure (hours / pages / …). null = none. */
  measureUnit: string | null;
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
    // Times/day: '' or '0' = unlimited (null); otherwise a positive integer.
    const maxRaw = String(formData.get('maxPerDay') ?? '').trim();
    let maxPerDay: number | null = 1;
    if (maxRaw === '' || maxRaw === '0') {
      maxPerDay = null;
    } else {
      const v = Number.parseInt(maxRaw, 10);
      if (!Number.isInteger(v) || v < 1) return 'invalid_coin_value';
      maxPerDay = v;
    }
    // Optional journey measure: amount one completion adds + a unit label.
    const measureRaw = String(formData.get('measureAmount') ?? '').trim();
    let measureAmount: number | null = null;
    if (measureRaw !== '') {
      const v = Number.parseInt(measureRaw, 10);
      if (!Number.isInteger(v) || v < 0) return 'invalid_coin_value';
      measureAmount = v;
    }
    const measureUnit = String(formData.get('measureUnit') ?? '').trim() || null;
    return {
      ...common,
      kind: 'daily',
      coinValue,
      deadlineTime,
      maxPerDay,
      measureAmount,
      measureUnit,
    };
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
        maxPerDay: parsed.kind === 'daily' ? parsed.maxPerDay : 1,
        measureAmount: parsed.kind === 'daily' ? parsed.measureAmount : null,
        measureUnit: parsed.kind === 'daily' ? parsed.measureUnit : null,
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

  // Kind is editable (Lily's request): flipping daily ↔ long_term rewrites the
  // kind-specific columns below to satisfy the task_template CHECK. Existing
  // task_completion / long_term_progress rows are kept as history — the engines
  // read them per the template's CURRENT kind from here on.
  try {
    await db
      .update(taskTemplate)
      .set({
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
        maxPerDay: parsed.kind === 'daily' ? parsed.maxPerDay : 1,
        measureAmount: parsed.kind === 'daily' ? parsed.measureAmount : null,
        measureUnit: parsed.kind === 'daily' ? parsed.measureUnit : null,
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

    // Per-kid assignment, folded in from the old standalone /assign page.
    // Only runs when the form rendered the assignment checkboxes (edit mode);
    // the hidden `assignmentsManaged` flag guards against an absent section
    // silently un-assigning every kid. Same diff semantics as bulkAssign,
    // but pivoted to one template across kids.
    if (formData.get('assignmentsManaged') === '1') {
      await applyAssignmentDiff(db, admin.householdId, admin.userId, id, formData);
    }
  } catch (err) {
    console.error('updateTaskTemplateAction failed', err);
    return 'internal';
  }

  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]', 'layout');
  redirect(`/${lang}/admin/tasks`);
}

/**
 * Diff the per-kid assignment checkboxes posted by the task edit form against
 * the current task_assignment rows for one template, then INSERT / re-enable /
 * disable to match. Checked kids that are forged / not in the household are
 * silently ignored. Mirrors bulkAssignTasksAction's enabled+archived_at knob
 * (never a second INSERT — the unique (template_id, kid_id) index forbids it).
 */
async function applyAssignmentDiff(
  db: ReturnType<typeof getDb>,
  householdId: string,
  actorUserId: string,
  templateId: string,
  formData: FormData,
): Promise<void> {
  const checked = new Set(formData.getAll('assignKidId').map((v) => String(v)));

  // Valid active kids in this household.
  const kids = await db
    .select({ id: kidTable.id })
    .from(kidTable)
    .where(and(eq(kidTable.householdId, householdId), isNull(kidTable.archivedAt)));
  const validKidIds = new Set(kids.map((k) => k.id));

  // Existing assignment rows for this template (any state) keyed by kid.
  const existing = await db
    .select({
      id: taskAssignment.id,
      kidId: taskAssignment.kidId,
      enabled: taskAssignment.enabled,
      archivedAt: taskAssignment.archivedAt,
    })
    .from(taskAssignment)
    .where(eq(taskAssignment.templateId, templateId));
  const existingByKid = new Map(existing.map((r) => [r.kidId, r]));

  const auditAdded: string[] = [];
  const auditRemoved: string[] = [];

  // Pass 1: kids that should be assigned.
  for (const kidId of checked) {
    if (!validKidIds.has(kidId)) continue;
    const row = existingByKid.get(kidId);
    if (!row) {
      await db.insert(taskAssignment).values({ householdId, templateId, kidId, enabled: true });
      auditAdded.push(kidId);
    } else if (!row.enabled || row.archivedAt) {
      await db
        .update(taskAssignment)
        .set({ enabled: true, archivedAt: null })
        .where(eq(taskAssignment.id, row.id));
      auditAdded.push(kidId);
    }
  }
  // Pass 2: currently-active assignments whose kid was un-checked.
  for (const row of existing) {
    if (checked.has(row.kidId)) continue;
    if (row.enabled && !row.archivedAt) {
      await db
        .update(taskAssignment)
        .set({ enabled: false, archivedAt: new Date() })
        .where(eq(taskAssignment.id, row.id));
      auditRemoved.push(row.kidId);
    }
  }

  if (auditAdded.length > 0 || auditRemoved.length > 0) {
    await db.insert(auditLog).values({
      householdId,
      actorUserId,
      action: 'task_assignment.bulk',
      targetKind: 'task_template',
      targetId: templateId,
      afterJson: { added: auditAdded, removed: auditRemoved },
    });
  }
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

// ─── Bulk per-kid assignment ──────────────────────────────────────────────
// Lets admin pick a kid and toggle a whole list of task templates on/off in
// one save. Diff-based:
//   - template in checked list, no row yet → INSERT enabled=true
//   - template in checked list, row exists but disabled → re-enable
//   - template NOT in checked list, row exists + enabled → disable
//   - template NOT in checked list, row absent → no-op
// The unique (template_id, kid_id) index means we never INSERT a second row;
// toggling enabled is the right knob.

export type BulkAssignResult =
  | { ok: true; added: number; removed: number; unchanged: number }
  | { ok: false; error: 'forbidden' | 'not_found' | 'internal' };

export async function bulkAssignTasksAction(
  _prev: BulkAssignResult | undefined,
  formData: FormData,
): Promise<BulkAssignResult> {
  const kidId = String(formData.get('kidId') ?? '');
  if (!kidId) return { ok: false, error: 'not_found' };
  // Every checked checkbox posts its templateId. Empty list = unassign all.
  const checked = new Set(formData.getAll('templateId').map((v) => String(v)));

  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  const db = getDb();

  // Verify kid belongs to this household.
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

  // Pull every active task template in the household. Anything in `checked`
  // that doesn't match one of these (forged template id from a stale page)
  // gets silently ignored — safer than erroring on a partial mismatch.
  const templates = await db
    .select({ id: taskTemplate.id })
    .from(taskTemplate)
    .where(
      and(
        eq(taskTemplate.householdId, admin.householdId),
        isNull(taskTemplate.archivedAt),
      ),
    );
  const validTemplateIds = new Set(templates.map((t) => t.id));

  // Pull every existing assignment row for this kid (including disabled +
  // archived) so we can diff.
  const existing = await db
    .select({
      id: taskAssignment.id,
      templateId: taskAssignment.templateId,
      enabled: taskAssignment.enabled,
      archivedAt: taskAssignment.archivedAt,
    })
    .from(taskAssignment)
    .where(eq(taskAssignment.kidId, kidId));
  const existingByTemplate = new Map(existing.map((r) => [r.templateId, r]));

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  const auditAdded: string[] = [];
  const auditRemoved: string[] = [];

  try {
    // Pass 1: things that should be enabled.
    for (const templateId of checked) {
      if (!validTemplateIds.has(templateId)) continue;
      const row = existingByTemplate.get(templateId);
      if (!row) {
        await db.insert(taskAssignment).values({
          householdId: admin.householdId,
          templateId,
          kidId,
          enabled: true,
        });
        added += 1;
        auditAdded.push(templateId);
      } else if (!row.enabled || row.archivedAt) {
        await db
          .update(taskAssignment)
          .set({ enabled: true, archivedAt: null })
          .where(eq(taskAssignment.id, row.id));
        added += 1;
        auditAdded.push(templateId);
      } else {
        unchanged += 1;
      }
    }
    // Pass 2: things that should be disabled — anything currently enabled
    // that the admin un-checked.
    for (const row of existing) {
      if (checked.has(row.templateId)) continue;
      if (row.enabled && !row.archivedAt) {
        await db
          .update(taskAssignment)
          .set({ enabled: false, archivedAt: new Date() })
          .where(eq(taskAssignment.id, row.id));
        removed += 1;
        auditRemoved.push(row.templateId);
      }
    }

    if (added > 0 || removed > 0) {
      await db.insert(auditLog).values({
        householdId: admin.householdId,
        actorUserId: admin.userId,
        action: 'task_assignment.bulk',
        targetKind: 'kid',
        targetId: kidId,
        afterJson: { added: auditAdded, removed: auditRemoved },
      });
    }

    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]', 'layout');
    return { ok: true, added, removed, unchanged };
  } catch (err) {
    console.error('bulkAssignTasksAction failed', err);
    return { ok: false, error: 'internal' };
  }
}

// ─── Bulk operations from the tasks-manager screen ─────────────────────────
// All three take a set of templateIds (posted as repeated `templateId` fields)
// and operate on the whole set in one save. Household-scoped; forged/foreign
// ids are filtered out by the WHERE clause rather than erroring the batch.

export type BulkOpResult =
  | { ok: true; affected: number }
  | { ok: false; error: 'forbidden' | 'none_selected' | 'no_fields' | 'internal' };

/** Resolve the requesting admin, returning a typed error instead of throwing. */
async function adminOrError(): Promise<
  { ok: true; householdId: string; userId: string } | { ok: false; error: 'forbidden' }
> {
  try {
    const admin = await requireAdmin();
    return { ok: true, householdId: admin.householdId, userId: admin.userId };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }
}

/** Validate the posted templateIds against the household, returning the subset
 *  that actually belongs to it. */
async function householdTemplateIds(
  db: ReturnType<typeof getDb>,
  householdId: string,
  posted: string[],
): Promise<string[]> {
  if (posted.length === 0) return [];
  const rows = await db
    .select({ id: taskTemplate.id })
    .from(taskTemplate)
    .where(
      and(eq(taskTemplate.householdId, householdId), inArray(taskTemplate.id, posted)),
    );
  return rows.map((r) => r.id);
}

/** Bulk archive / unarchive selected templates. `archive=1` archives, else
 *  unarchives. */
export async function bulkArchiveTasksAction(
  _prev: BulkOpResult | undefined,
  formData: FormData,
): Promise<BulkOpResult> {
  const admin = await adminOrError();
  if (!admin.ok) return admin;

  const posted = formData.getAll('templateId').map((v) => String(v));
  const archive = formData.get('archive') === '1';
  const db = getDb();
  const ids = await householdTemplateIds(db, admin.householdId, posted);
  if (ids.length === 0) return { ok: false, error: 'none_selected' };

  try {
    await db
      .update(taskTemplate)
      .set({ archivedAt: archive ? new Date() : null, updatedAt: new Date() })
      .where(inArray(taskTemplate.id, ids));

    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: archive ? 'task_template.bulk_archived' : 'task_template.bulk_unarchived',
      targetKind: 'task_template',
      targetId: ids[0]!,
      afterJson: { ids },
    });

    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]', 'layout');
    return { ok: true, affected: ids.length };
  } catch (err) {
    console.error('bulkArchiveTasksAction failed', err);
    return { ok: false, error: 'internal' };
  }
}

/** Bulk edit selected templates. Only the fields the admin flagged are
 *  changed (leave-the-rest semantics):
 *    - `setCoinValue=1` + `coinValue` → applies to DAILY templates only
 *      (long-term coin value stays 0 by contract).
 *    - `setEvidence=1` + `evidenceValue` (on/off) → applies to all selected.
 *  Kind is intentionally NOT bulk-editable: flipping daily↔long_term would
 *  orphan existing completions / progress rows (same guard as single edit). */
export async function bulkEditTasksAction(
  _prev: BulkOpResult | undefined,
  formData: FormData,
): Promise<BulkOpResult> {
  const admin = await adminOrError();
  if (!admin.ok) return admin;

  const posted = formData.getAll('templateId').map((v) => String(v));
  const db = getDb();
  const ids = await householdTemplateIds(db, admin.householdId, posted);
  if (ids.length === 0) return { ok: false, error: 'none_selected' };

  const setCoin = formData.get('setCoinValue') === '1';
  const setEvidence = formData.get('setEvidence') === '1';
  if (!setCoin && !setEvidence) return { ok: false, error: 'no_fields' };

  let coinValue = 0;
  if (setCoin) {
    coinValue = Number.parseInt(String(formData.get('coinValue') ?? ''), 10);
    if (!Number.isInteger(coinValue) || coinValue < 0) return { ok: false, error: 'no_fields' };
  }
  const evidenceValue = formData.get('evidenceValue') === 'on';

  try {
    if (setCoin) {
      // Daily-only so long-term templates keep their 0 coin value.
      await db
        .update(taskTemplate)
        .set({ coinValue, updatedAt: new Date() })
        .where(
          and(inArray(taskTemplate.id, ids), eq(taskTemplate.kind, 'daily')),
        );
    }
    if (setEvidence) {
      await db
        .update(taskTemplate)
        .set({ evidenceRequired: evidenceValue, updatedAt: new Date() })
        .where(inArray(taskTemplate.id, ids));
    }

    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'task_template.bulk_edited',
      targetKind: 'task_template',
      targetId: ids[0]!,
      afterJson: {
        ids,
        ...(setCoin ? { coinValue } : {}),
        ...(setEvidence ? { evidenceRequired: evidenceValue } : {}),
      },
    });

    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]', 'layout');
    return { ok: true, affected: ids.length };
  } catch (err) {
    console.error('bulkEditTasksAction failed', err);
    return { ok: false, error: 'internal' };
  }
}

/** Bulk assign selected templates to one or more kids. ADDITIVE only — it
 *  enables (insert or re-enable) the (template, kid) assignments and never
 *  disables anything, so it's safe to run from a multi-select without
 *  accidentally un-assigning a kid's other tasks. */
export async function bulkAssignTemplatesToKidsAction(
  _prev: BulkOpResult | undefined,
  formData: FormData,
): Promise<BulkOpResult> {
  const admin = await adminOrError();
  if (!admin.ok) return admin;

  const db = getDb();
  const templateIds = await householdTemplateIds(
    db,
    admin.householdId,
    formData.getAll('templateId').map((v) => String(v)),
  );
  if (templateIds.length === 0) return { ok: false, error: 'none_selected' };

  const postedKidIds = formData.getAll('assignKidId').map((v) => String(v));
  if (postedKidIds.length === 0) return { ok: false, error: 'none_selected' };

  // Valid active kids in this household.
  const kids = await db
    .select({ id: kidTable.id })
    .from(kidTable)
    .where(
      and(
        eq(kidTable.householdId, admin.householdId),
        isNull(kidTable.archivedAt),
        inArray(kidTable.id, postedKidIds),
      ),
    );
  const kidIds = kids.map((k) => k.id);
  if (kidIds.length === 0) return { ok: false, error: 'none_selected' };

  try {
    // Existing rows for these templates + kids, keyed by "template|kid".
    const existing = await db
      .select({
        id: taskAssignment.id,
        templateId: taskAssignment.templateId,
        kidId: taskAssignment.kidId,
        enabled: taskAssignment.enabled,
        archivedAt: taskAssignment.archivedAt,
      })
      .from(taskAssignment)
      .where(
        and(
          inArray(taskAssignment.templateId, templateIds),
          inArray(taskAssignment.kidId, kidIds),
        ),
      );
    const existingByPair = new Map(existing.map((r) => [`${r.templateId}|${r.kidId}`, r]));

    let affected = 0;
    for (const templateId of templateIds) {
      for (const kidId of kidIds) {
        const row = existingByPair.get(`${templateId}|${kidId}`);
        if (!row) {
          await db
            .insert(taskAssignment)
            .values({ householdId: admin.householdId, templateId, kidId, enabled: true });
          affected += 1;
        } else if (!row.enabled || row.archivedAt) {
          await db
            .update(taskAssignment)
            .set({ enabled: true, archivedAt: null })
            .where(eq(taskAssignment.id, row.id));
          affected += 1;
        }
      }
    }

    await db.insert(auditLog).values({
      householdId: admin.householdId,
      actorUserId: admin.userId,
      action: 'task_assignment.bulk_assign',
      targetKind: 'task_template',
      targetId: templateIds[0]!,
      afterJson: { templateIds, kidIds, affected },
    });

    revalidatePath('/[lang]/admin', 'layout');
    revalidatePath('/[lang]', 'layout');
    return { ok: true, affected };
  } catch (err) {
    console.error('bulkAssignTemplatesToKidsAction failed', err);
    return { ok: false, error: 'internal' };
  }
}
