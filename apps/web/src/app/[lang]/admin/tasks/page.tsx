/**
 * Admin · task templates manager.
 *
 * Loads every template in the household plus the active per-kid assignments,
 * and hands them to the client TasksManager — which shows the assigned-kid
 * chips, client-side filters (kid / kind / photo / status), and bulk
 * operations (archive, edit, assign-to-kids) over a multi-select.
 *
 * Assignment chips reflect ACTIVE assignments only (enabled + not archived,
 * and the kid not archived) so the list matches what the kid actually sees.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, taskTemplate, taskAssignment, kid as kidTable } from '@reco/db';
import { auth } from '../../../../auth';
import { TasksManager, type ManagerTask, type ManagerKid } from './_components/tasks-manager';

export const dynamic = 'force-dynamic';

export default async function AdminTasksPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);
  const householdId = session.user.householdId;
  const db = getDb();

  const [rows, kids, assignmentRows] = await Promise.all([
    db
      .select()
      .from(taskTemplate)
      .where(eq(taskTemplate.householdId, householdId))
      .orderBy(taskTemplate.displayOrder, desc(taskTemplate.createdAt)),
    db
      .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
      .from(kidTable)
      .where(and(eq(kidTable.householdId, householdId), isNull(kidTable.archivedAt)))
      .orderBy(kidTable.createdAt),
    db
      .select({
        templateId: taskAssignment.templateId,
        kidId: kidTable.id,
        kidName: kidTable.name,
        kidColor: kidTable.color,
      })
      .from(taskAssignment)
      .innerJoin(kidTable, eq(kidTable.id, taskAssignment.kidId))
      .where(
        and(
          eq(taskAssignment.householdId, householdId),
          eq(taskAssignment.enabled, true),
          isNull(taskAssignment.archivedAt),
          isNull(kidTable.archivedAt),
        ),
      ),
  ]);

  // template id → assigned kid chips.
  const assignedByTemplate = new Map<string, ManagerKid[]>();
  for (const a of assignmentRows) {
    const list = assignedByTemplate.get(a.templateId) ?? [];
    list.push({ id: a.kidId, name: a.kidName, color: a.kidColor });
    assignedByTemplate.set(a.templateId, list);
  }

  const tasks: ManagerTask[] = rows.map((r) => ({
    id: r.id,
    titleHe: r.titleHe,
    titleEn: r.titleEn,
    iconKey: r.iconKey,
    color: r.color,
    coinValue: r.coinValue,
    kind: r.kind as 'daily' | 'long_term',
    evidenceRequired: r.evidenceRequired,
    archived: r.archivedAt != null,
    assignedKids: assignedByTemplate.get(r.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t.admin.tasksHeading}</h1>
        <Link
          href={`/${lang}/admin/tasks/new`}
          className="btn-admin"
        >
          + {t.admin.newTask}
        </Link>
      </header>

      <TasksManager lang={lang as 'he' | 'en'} t={t} tasks={tasks} kids={kids} />
    </div>
  );
}
