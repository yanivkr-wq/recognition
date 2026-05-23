/**
 * Admin · create a new daily task template.
 *
 * Long-term task creation (per-unit coins + goal + bonus) lands in Phase 4
 * — until then the create form hard-codes `kind = 'daily'` server-side.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { auth } from '../../../../../auth';
import { TaskForm } from '../_components/task-form';
import { arrowBack } from '../../../../../lib/rtl';

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  return (
    <div className="space-y-6">
      <Link
        href={`/${lang}/admin/tasks`}
        className="text-sm text-ink-soft underline-offset-4 hover:underline"
      >
        {arrowBack(lang as 'he' | 'en')} {t.admin.tasksHeading}
      </Link>
      <h1 className="text-2xl font-bold text-ink">{t.admin.newTask}</h1>
      <TaskForm mode="create" lang={lang} t={t} submitLabel={t.admin.create} />
    </div>
  );
}
