/**
 * Admin · per-kid bulk task assignment.
 *
 * Lists every active task template in the household with a checkbox each.
 * The form submits to `bulkAssignTasksAction` which diffs the checked set
 * against the kid's current assignments and applies the changes in one go
 * (INSERT new, re-enable disabled, disable un-checked).
 *
 * Built for the "I just bulk-loaded 30 new tasks and want to assign them
 * to one kid in 10 seconds" case. The single-toggle action on
 * /admin/tasks/[id]/assign still exists for fine-grained per-template work.
 */

import { redirect } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  kid as kidTable,
  taskTemplate,
  taskAssignment,
} from '@reco/db';
import { auth } from '../../../../../../auth';
import { KidTasksForm } from './_components/kid-tasks-form';

export const dynamic = 'force-dynamic';

export default async function AdminKidTasksPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id: kidId } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const db = getDb();

  // Verify kid belongs to this household + grab name for the heading.
  const kRows = await db
    .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
    .from(kidTable)
    .where(
      and(
        eq(kidTable.id, kidId),
        eq(kidTable.householdId, session.user.householdId),
        isNull(kidTable.archivedAt),
      ),
    )
    .limit(1);
  const k = kRows[0];
  if (!k) redirect(`/${lang}/admin/kids`);

  // All active task templates in the household, ordered the way the kid
  // would see them (display_order, then title for tie-break).
  const templates = await db
    .select({
      id: taskTemplate.id,
      titleHe: taskTemplate.titleHe,
      titleEn: taskTemplate.titleEn,
      iconKey: taskTemplate.iconKey,
      color: taskTemplate.color,
      coinValue: taskTemplate.coinValue,
      kind: taskTemplate.kind,
      displayOrder: taskTemplate.displayOrder,
    })
    .from(taskTemplate)
    .where(
      and(
        eq(taskTemplate.householdId, session.user.householdId),
        isNull(taskTemplate.archivedAt),
      ),
    )
    .orderBy(asc(taskTemplate.displayOrder), asc(taskTemplate.titleHe));

  // Current "enabled and not archived" assignments for this kid — the set
  // of templateIds that should start out checked.
  const currentAssignments = await db
    .select({ templateId: taskAssignment.templateId })
    .from(taskAssignment)
    .where(
      and(
        eq(taskAssignment.kidId, kidId),
        eq(taskAssignment.enabled, true),
        isNull(taskAssignment.archivedAt),
      ),
    );
  const initiallyChecked = new Set(currentAssignments.map((a) => a.templateId));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center text-card font-bold"
          style={{ backgroundColor: k.color }}
          aria-hidden="true"
        >
          {k.name.charAt(0)}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {t.admin.assignedKids} — {k.name}
          </h1>
          <p className="text-xs text-ink-soft">{t.admin.bulkAssignHint}</p>
        </div>
      </header>

      <KidTasksForm
        kidId={kidId}
        lang={lang as 'he' | 'en'}
        t={t}
        templates={templates}
        initiallyChecked={Array.from(initiallyChecked)}
      />
    </div>
  );
}
