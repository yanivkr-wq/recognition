/**
 * Admin · per-kid assignment toggles for one task template.
 *
 * Renders a checkbox row per non-archived kid. Submit hits
 * toggleAssignmentAction which UPSERTs the task_assignment row (creating
 * if missing, flipping `enabled`+`archived_at` if present). The action is
 * the only mutation on this page, so for simplicity we render one form
 * PER kid — clicking the inline submit immediately revalidates the layout.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  taskTemplate,
  taskAssignment,
  kid as kidTable,
} from '@reco/db';
import { auth } from '../../../../../../auth';
import { toggleAssignmentFormAction } from '../../../../../../lib/admin-tasks/actions';
import { arrowBack } from '../../../../../../lib/rtl';

export const dynamic = 'force-dynamic';

export default async function AssignPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const db = getDb();
  const tRows = await db
    .select()
    .from(taskTemplate)
    .where(
      and(eq(taskTemplate.id, id), eq(taskTemplate.householdId, session.user.householdId)),
    )
    .limit(1);
  const template = tRows[0];
  if (!template) notFound();

  // Pull every active kid + whether they have an active assignment for this template.
  const kRows = await db
    .select({
      kidId: kidTable.id,
      name: kidTable.name,
      color: kidTable.color,
      assignmentId: taskAssignment.id,
      enabled: taskAssignment.enabled,
      archivedAt: taskAssignment.archivedAt,
    })
    .from(kidTable)
    .leftJoin(
      taskAssignment,
      and(
        eq(taskAssignment.kidId, kidTable.id),
        eq(taskAssignment.templateId, id),
      ),
    )
    .where(
      and(
        eq(kidTable.householdId, session.user.householdId),
        isNull(kidTable.archivedAt),
      ),
    )
    .orderBy(kidTable.createdAt);

  const title = lang === 'he' ? template.titleHe : template.titleEn;

  return (
    <div className="space-y-6">
      <Link
        href={`/${lang}/admin/tasks`}
        className="text-sm text-ink-soft underline-offset-4 hover:underline"
      >
        {arrowBack(lang as 'he' | 'en')} {t.admin.tasksHeading}
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-ink">{t.admin.assignTo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{title}</p>
      </header>

      <ul className="space-y-3">
        {kRows.map((k) => {
          const isActive = k.assignmentId != null && k.enabled && k.archivedAt == null;
          return (
            <li
              key={k.kidId}
              className="bg-card rounded-2xl shadow-card border border-rule p-4 flex items-center gap-4"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: k.color }}
                aria-hidden="true"
              >
                <span
                  className="text-lg font-bold text-card"
                  style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
                >
                  {k.name.charAt(0)}
                </span>
              </div>
              <span className="font-bold text-ink flex-1">{k.name}</span>
              <form action={toggleAssignmentFormAction}>
                <input type="hidden" name="templateId" value={id} />
                <input type="hidden" name="kidId" value={k.kidId} />
                <button
                  type="submit"
                  className={`px-3 py-2 rounded-full text-xs font-bold transition ${
                    isActive
                      ? 'bg-mint-pale text-mint-dark hover:bg-mint-soft'
                      : 'bg-rule text-ink-soft hover:bg-rule-soft'
                  }`}
                >
                  {isActive ? t.common.yes : t.common.no}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
