/**
 * Admin · approval queue.
 *
 * Lists every pending submission in the household, newest first. The
 * `submission_pending` partial index in 0001_init.sql §17 makes this query
 * fast. Each item renders an ApprovalCard with the photo + approve/deny
 * buttons; FCFS race is handled in the server actions (the first parent's
 * UPDATE wins; the loser gets `already_resolved`).
 *
 * Photo rendering uses `/api/evidence/<id>`, the session-gated streaming
 * route that authorizes admin (this parent's household) before opening
 * the file. No public URLs ever.
 */

import { redirect } from 'next/navigation';
import { eq, desc, and } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  submission,
  evidence,
  taskCompletion,
  taskAssignment,
  taskTemplate,
  kid as kidTable,
} from '@reco/db';
import { auth } from '../../../../auth';
import { ApprovalCard } from './_components/approval-card';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage({
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
      submissionId: submission.id,
      evidenceId: submission.evidenceId,
      submittedAt: submission.submittedAt,
      kidName: kidTable.name,
      kidColor: kidTable.color,
      titleHe: taskTemplate.titleHe,
      titleEn: taskTemplate.titleEn,
      coinValue: taskTemplate.coinValue,
    })
    .from(submission)
    .innerJoin(kidTable, eq(kidTable.id, submission.kidId))
    .innerJoin(taskCompletion, eq(taskCompletion.id, submission.taskCompletionId))
    .innerJoin(taskAssignment, eq(taskAssignment.id, taskCompletion.assignmentId))
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskAssignment.templateId))
    .where(
      and(
        eq(submission.householdId, session.user.householdId),
        eq(submission.status, 'pending'),
      ),
    )
    .orderBy(desc(submission.submittedAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.approvalsHeading}</h1>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">{t.admin.noPendingApprovals}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <ApprovalCard
              key={r.submissionId}
              submissionId={r.submissionId}
              evidenceId={r.evidenceId}
              kidName={r.kidName}
              kidColor={r.kidColor}
              taskTitleHe={r.titleHe}
              taskTitleEn={r.titleEn}
              coinValue={r.coinValue}
              submittedAt={r.submittedAt.toISOString().slice(0, 16).replace('T', ' ')}
              lang={lang as Locale}
              t={t}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
