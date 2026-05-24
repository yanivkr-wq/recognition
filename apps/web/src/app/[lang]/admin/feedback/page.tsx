/**
 * Admin · feedback triage list.
 *
 * Lists every feedback row in the household, newest first. The client
 * component handles the multi-select status filter, copy-to-clipboard, and
 * the per-row status control (which posts updateFeedbackStatusAction).
 */

import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, feedback } from '@reco/db';
import { auth } from '../../../../auth';
import { FeedbackList, type FeedbackRow } from './_components/feedback-list';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const rows = await getDb()
    .select({
      id: feedback.id,
      category: feedback.category,
      body: feedback.body,
      status: feedback.status,
      submitterLabel: feedback.submitterLabel,
      imagePath: feedback.imagePath,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(eq(feedback.householdId, session.user.householdId))
    .orderBy(desc(feedback.createdAt));

  const items: FeedbackRow[] = rows.map((r) => ({
    id: r.id,
    category: r.category,
    body: r.body,
    status: r.status,
    submitterLabel: r.submitterLabel,
    imageUrl: r.imagePath ? `/api/feedback-images/${r.id}` : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.feedback.heading}</h1>
      <FeedbackList lang={lang as 'he' | 'en'} t={t} items={items} />
    </div>
  );
}
