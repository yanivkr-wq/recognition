/**
 * Admin · edit an existing daily task template + archive toggle.
 *
 * The archive toggle is a standalone form (POST) so a parent can archive
 * without editing other fields. Archiving doesn't delete completion history
 * — it just hides the template from the kid's home and prevents new
 * assignments.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, taskTemplate, taskAssignment, kid as kidTable } from '@reco/db';
import { auth } from '../../../../../../auth';
import { TaskForm } from '../../_components/task-form';
import { toggleArchiveTaskTemplateAction } from '../../../../../../lib/admin-tasks/actions';
import { arrowBack } from '../../../../../../lib/rtl';

export const dynamic = 'force-dynamic';

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const db = getDb();
  const rows = await db
    .select()
    .from(taskTemplate)
    .where(and(eq(taskTemplate.id, id), eq(taskTemplate.householdId, session.user.householdId)))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  // Active kids + whether this template is currently assigned (enabled +
  // non-archived) to each. Feeds the assignment checkboxes folded into the
  // form below (replaces the old standalone /assign page).
  const kRows = await db
    .select({
      id: kidTable.id,
      name: kidTable.name,
      color: kidTable.color,
      assignmentId: taskAssignment.id,
      enabled: taskAssignment.enabled,
      assignmentArchivedAt: taskAssignment.archivedAt,
    })
    .from(kidTable)
    .leftJoin(
      taskAssignment,
      and(eq(taskAssignment.kidId, kidTable.id), eq(taskAssignment.templateId, id)),
    )
    .where(
      and(
        eq(kidTable.householdId, session.user.householdId),
        isNull(kidTable.archivedAt),
      ),
    )
    .orderBy(kidTable.createdAt);

  const assignKids = kRows.map((k) => ({
    id: k.id,
    name: k.name,
    color: k.color,
    assigned: k.assignmentId != null && k.enabled === true && k.assignmentArchivedAt == null,
  }));

  return (
    <div className="space-y-6">
      <Link
        href={`/${lang}/admin/tasks`}
        className="text-sm text-ink-soft underline-offset-4 hover:underline"
      >
        {arrowBack(lang as 'he' | 'en')} {t.admin.tasksHeading}
      </Link>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t.admin.editTask}</h1>
        <form action={toggleArchiveTaskTemplateAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            className="text-xs font-bold underline-offset-4 hover:underline text-ink-soft"
          >
            {row.archivedAt ? t.admin.unarchive : t.admin.archive}
          </button>
        </form>
      </header>

      <TaskForm
        mode="edit"
        initial={{
          id: row.id,
          kind: row.kind,
          titleHe: row.titleHe,
          titleEn: row.titleEn,
          descriptionHe: row.descriptionHe,
          descriptionEn: row.descriptionEn,
          iconKey: row.iconKey,
          color: row.color,
          coinValue: row.coinValue,
          evidenceRequired: row.evidenceRequired,
          displayOrder: row.displayOrder,
          longTermUnitLabelHe: row.longTermUnitLabelHe,
          longTermUnitLabelEn: row.longTermUnitLabelEn,
          longTermPerUnitCoins: row.longTermPerUnitCoins,
          longTermGoalQuantity: row.longTermGoalQuantity,
          longTermBonusOnComplete: row.longTermBonusOnComplete,
          deadlineTime: row.deadlineTime,
          maxPerDay: row.maxPerDay,
        }}
        lang={lang}
        t={t}
        submitLabel={t.common.save}
        assignKids={assignKids}
      />
    </div>
  );
}
