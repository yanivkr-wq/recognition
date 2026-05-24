/**
 * Admin · task templates list.
 *
 * Lists every template in the household (active + archived). Each row links
 * to edit / assign. The "+ New" CTA opens the create form. Archived rows are
 * visually muted but remain in the list so a parent can unarchive — and so
 * their history (completions referencing an archived template) is still
 * comprehensible.
 *
 * Phase 4 adds the long-term-only fields to the create form; Phase 3 keeps
 * the create form daily-only (the seed already has a long-term template
 * which renders fine in this list even though the create form can't make a
 * new one yet).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, taskTemplate } from '@reco/db';
import { auth } from '../../../../auth';
import { Coin } from '../../../../components/coin';
import { TaskIcon } from '../../../../components/task-icon';

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

  const rows = await getDb()
    .select()
    .from(taskTemplate)
    .where(eq(taskTemplate.householdId, session.user.householdId))
    .orderBy(taskTemplate.displayOrder, desc(taskTemplate.createdAt));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t.admin.tasksHeading}</h1>
        <Link
          href={`/${lang}/admin/tasks/new`}
          className="bg-pink text-card font-bold rounded-full py-2 px-4 text-sm shadow-cta-pink hover:-translate-y-px transition"
        >
          + {t.admin.newTask}
        </Link>
      </header>

      <ul className="space-y-3">
        {rows.map((r) => {
          const title = lang === 'he' ? r.titleHe : r.titleEn;
          const archived = r.archivedAt != null;
          return (
            <li
              key={r.id}
              className={`bg-card rounded-2xl shadow-card border border-rule p-4 space-y-3 ${
                archived ? 'opacity-50' : ''
              }`}
            >
              {/* Top: icon + full (wrapping) title. The title gets the whole
                  row width — coin + actions live in the footer below — so it's
                  fully readable on a phone instead of truncated to one line. */}
              <div className="flex items-start gap-3">
                {/* Real task icon (was a single-letter placeholder pre-2026-05-23).
                    Matches what the kid sees on /he, so admin previews the
                    full task identity at a glance. */}
                <TaskIcon iconKey={r.iconKey} color={r.color} title={title} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink leading-snug break-words">{title}</p>
                  <p className="text-xs text-ink-soft mt-1">
                    {r.kind} · {r.evidenceRequired ? t.admin.evidenceRequired : '—'}
                    {archived && (
                      <span className="ms-2 inline-block text-[10px] uppercase tracking-wider text-ink-faded">
                        {t.admin.archived}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Footer: coin value + actions, divided from the title block.
                  Actions get comfortable tap targets on mobile. */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-rule/60">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-xs font-bold num">
                  <Coin size={14} />
                  <span dir="ltr">{r.coinValue}</span>
                </span>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/${lang}/admin/tasks/${r.id}/edit`}
                    className="text-sm text-pink-dark underline-offset-2 hover:underline font-bold py-1"
                  >
                    {t.common.edit}
                  </Link>
                  <Link
                    href={`/${lang}/admin/tasks/${r.id}/assign`}
                    className="text-sm text-sky-dark underline-offset-2 hover:underline font-bold py-1"
                  >
                    {t.admin.assignments}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
