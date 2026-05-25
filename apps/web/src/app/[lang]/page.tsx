/**
 * Reco home — dispatches by principal.
 *
 *   kid    → KidHome (Phase 3): wallet card + today's daily-task list with
 *            tap-to-complete + same-day undo. Server-side fetches the
 *            kid's daily assignments and today's completion state.
 *   admin  → redirect straight to /[lang]/admin (its layout is the admin home).
 *
 * Force-dynamic so the kid sees fresh state every navigation; the server
 * actions also `revalidatePath('/[lang]', 'layout')` after a coin event.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  kid as kidTable,
  taskAssignment,
  taskTemplate,
  taskCompletion,
  longTermProgress,
  submission,
} from '@reco/db';
import { auth } from '../../auth';
import {
  KidHome,
  type KidHomeTask,
  type KidHomeLongTermTask,
} from './_components/kid-home';

export const dynamic = 'force-dynamic';

const HOUSEHOLD_TZ = 'Asia/Jerusalem';

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const hdrs = await headers();
  const principal = hdrs.get('x-reco-principal');

  if (principal === 'kid') {
    const kidId = hdrs.get('x-reco-kid-id');
    if (!kidId) redirect(`/${lang}/pick`);
    return <KidView kidId={kidId} lang={lang as 'he' | 'en'} t={t} />;
  }

  // Admins land straight on the admin dashboard — its layout carries the Reco
  // mark, parent name, and sign out, so no interstitial is needed.
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);
  redirect(`/${lang}/admin`);
}

async function KidView({
  kidId,
  lang,
  t,
}: {
  kidId: string;
  lang: 'he' | 'en';
  t: ReturnType<typeof getDictionary>;
}) {
  const db = getDb();
  const kRows = await db
    .select({ name: kidTable.name, color: kidTable.color, avatarKey: kidTable.avatarKey })
    .from(kidTable)
    .where(and(eq(kidTable.id, kidId), isNull(kidTable.archivedAt)))
    .limit(1);
  const k = kRows[0];
  if (!k) redirect(`/${lang}/pick`);

  // Today (Asia/Jerusalem) as ISO date string.
  const today = await getPool()
    .query<{ today: string }>(`SELECT (now() AT TIME ZONE $1)::date::text AS today`, [
      HOUSEHOLD_TZ,
    ])
    .then((r) => r.rows[0]!.today);

  // Pull DAILY assignments + the active (non-undone) completion for today,
  // if any. The LEFT JOIN respects the partial unique index — at most one
  // row per (assignment, today) is active. A second LEFT JOIN to submission
  // surfaces the evidence state (submission row exists? denied with reason?)
  // for evidence-required completions.
  const dailyRows = await db
    .select({
      assignmentId: taskAssignment.id,
      titleHe: taskTemplate.titleHe,
      titleEn: taskTemplate.titleEn,
      iconKey: taskTemplate.iconKey,
      color: taskTemplate.color,
      coinValue: taskTemplate.coinValue,
      evidenceRequired: taskTemplate.evidenceRequired,
      deadlineTime: taskTemplate.deadlineTime,
      displayOrder: taskTemplate.displayOrder,
      completionId: taskCompletion.id,
      approvalStatus: taskCompletion.approvalStatus,
      evidenceSubmissionId: taskCompletion.evidenceSubmissionId,
      submissionStatus: submission.status,
      submissionDenyReason: submission.denyReason,
    })
    .from(taskAssignment)
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskAssignment.templateId))
    .leftJoin(
      taskCompletion,
      and(
        eq(taskCompletion.assignmentId, taskAssignment.id),
        eq(taskCompletion.completionDate, today),
        isNull(taskCompletion.undoneAt),
      ),
    )
    .leftJoin(submission, eq(submission.id, taskCompletion.evidenceSubmissionId))
    .where(
      and(
        eq(taskAssignment.kidId, kidId),
        eq(taskAssignment.enabled, true),
        isNull(taskAssignment.archivedAt),
        isNull(taskTemplate.archivedAt),
        eq(taskTemplate.kind, 'daily'),
      ),
    )
    .orderBy(taskTemplate.displayOrder, taskTemplate.titleHe);

  // Phase 7.5: compute "is this task locked right now?" for each daily
  // assignment with a deadline. Server-derived so the kid card doesn't have
  // to ask "what time is it in IL?" at render. We do one tiny query for
  // current IL time and reuse it across all the rows.
  const nowRes = await getPool().query<{ now_il: string }>(
    `SELECT to_char(now() AT TIME ZONE $1, 'HH24:MI:SS') AS now_il`,
    [HOUSEHOLD_TZ],
  );
  const nowIl = nowRes.rows[0]!.now_il;

  const tasks: KidHomeTask[] = dailyRows.map((r) => {
    let status: KidHomeTask['status'] = 'todo';
    if (r.completionId) {
      if (r.approvalStatus === 'denied') status = 'denied';
      else if (r.approvalStatus === 'pending') {
        // Two pending sub-states based on whether a submission row exists:
        //   - no submission yet → kid still needs to upload a photo
        //   - submission exists → waiting for parent approval
        status = r.evidenceSubmissionId ? 'pending' : 'needsPhoto';
      } else status = 'done';
    } else if (r.deadlineTime && nowIl > r.deadlineTime) {
      // Past the deadline and no active completion = locked. Admin can
      // still complete on the kid's behalf via the admin reopen action.
      status = 'locked';
    }
    return {
      assignmentId: r.assignmentId,
      completionId: r.completionId,
      status,
      titleHe: r.titleHe,
      titleEn: r.titleEn,
      iconKey: r.iconKey,
      color: r.color,
      coinValue: r.coinValue,
      evidenceRequired: r.evidenceRequired,
      denyReason: r.submissionDenyReason,
      deadlineTime: r.deadlineTime,
    };
  });

  // Pull LONG-TERM assignments + current total + today's individual entries.
  // Two follow-up queries on a single set of long-term assignment IDs so we
  // don't fan-out the LEFT JOIN into a Cartesian explosion when a kid has
  // many active entries.
  const longTermAssignments = await db
    .select({
      assignmentId: taskAssignment.id,
      longTermCompletedAt: taskAssignment.longTermCompletedAt,
      titleHe: taskTemplate.titleHe,
      titleEn: taskTemplate.titleEn,
      iconKey: taskTemplate.iconKey,
      color: taskTemplate.color,
      perUnitCoins: taskTemplate.longTermPerUnitCoins,
      goalQuantity: taskTemplate.longTermGoalQuantity,
      bonusOnComplete: taskTemplate.longTermBonusOnComplete,
      unitLabelHe: taskTemplate.longTermUnitLabelHe,
      unitLabelEn: taskTemplate.longTermUnitLabelEn,
      displayOrder: taskTemplate.displayOrder,
    })
    .from(taskAssignment)
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskAssignment.templateId))
    .where(
      and(
        eq(taskAssignment.kidId, kidId),
        eq(taskAssignment.enabled, true),
        isNull(taskAssignment.archivedAt),
        isNull(taskTemplate.archivedAt),
        eq(taskTemplate.kind, 'long_term'),
      ),
    )
    .orderBy(taskTemplate.displayOrder, taskTemplate.titleHe);

  const longTermAssignmentIds = longTermAssignments.map((a) => a.assignmentId);

  // Aggregate sum per assignment (active rows only). Empty result iff no logs yet.
  const totalsByAssignment = new Map<string, number>();
  if (longTermAssignmentIds.length > 0) {
    const totalsRes = await getPool().query<{ assignment_id: string; total: string }>(
      `SELECT assignment_id, COALESCE(SUM(quantity), 0)::text AS total
       FROM long_term_progress
       WHERE assignment_id = ANY($1::uuid[])
         AND undone_at IS NULL
         AND approval_status IN ('auto_approved', 'approved')
       GROUP BY assignment_id`,
      [longTermAssignmentIds],
    );
    for (const row of totalsRes.rows) {
      totalsByAssignment.set(row.assignment_id, Number(row.total));
    }
  }

  // Today's individual entries (for the inline undo chips).
  const todaysEntriesByAssignment = new Map<
    string,
    { progressId: string; quantity: number }[]
  >();
  if (longTermAssignmentIds.length > 0) {
    const entriesRows = await db
      .select({
        id: longTermProgress.id,
        assignmentId: longTermProgress.assignmentId,
        quantity: longTermProgress.quantity,
        loggedAt: longTermProgress.loggedAt,
      })
      .from(longTermProgress)
      .where(
        and(
          inArray(longTermProgress.assignmentId, longTermAssignmentIds),
          eq(longTermProgress.progressDate, today),
          isNull(longTermProgress.undoneAt),
        ),
      )
      .orderBy(longTermProgress.loggedAt);
    for (const r of entriesRows) {
      const list = todaysEntriesByAssignment.get(r.assignmentId) ?? [];
      list.push({ progressId: r.id, quantity: r.quantity });
      todaysEntriesByAssignment.set(r.assignmentId, list);
    }
  }

  const longTermTasks: KidHomeLongTermTask[] = longTermAssignments.map((a) => ({
    assignmentId: a.assignmentId,
    titleHe: a.titleHe,
    titleEn: a.titleEn,
    iconKey: a.iconKey,
    color: a.color,
    perUnitCoins: a.perUnitCoins ?? 0,
    goalQuantity: a.goalQuantity ?? 0,
    bonusOnComplete: a.bonusOnComplete,
    unitLabelHe: a.unitLabelHe ?? '',
    unitLabelEn: a.unitLabelEn ?? '',
    currentTotal: totalsByAssignment.get(a.assignmentId) ?? 0,
    completed: a.longTermCompletedAt != null,
    todaysEntries: todaysEntriesByAssignment.get(a.assignmentId) ?? [],
  }));

  // Wallet balance — derived view, never a stored counter (per SCHEMA.md §7).
  const balanceRes = await getPool().query<{ balance: string | null }>(
    `SELECT GREATEST(0, COALESCE(SUM(amount), 0))::text AS balance
     FROM ledger_entry WHERE kid_id = $1`,
    [kidId],
  );
  const balance = Number(balanceRes.rows[0]?.balance ?? 0);

  // Fix 12b: unread bell-event count for the bell chip in the header. We
  // count `state='pending'` rows targeting this kid on the bell channel —
  // those are the events Phase 7 wrote (campaign_completed,
  // sibling_badge_earned, streak_broken, streak_freeze_used). Phase 8 will
  // shift them to `state='sent'` when the kid taps "mark all read".
  const unreadRes = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM notification_event
      WHERE recipient_kid_id = $1
        AND channel = 'bell'
        AND state = 'pending'`,
    [kidId],
  );
  const unreadCount = Number(unreadRes.rows[0]?.n ?? 0);

  return (
    <KidHome
      lang={lang}
      t={t}
      kidName={k.name}
      kidColor={k.color}
      initialBalance={balance}
      tasks={tasks}
      longTermTasks={longTermTasks}
      logoutUrl="/api/kid-session/logout"
      walletHref={`/${lang}/wallet`}
      shopHref={`/${lang}/redeem`}
      campaignsHref={`/${lang}/campaigns`}
      badgesHref={`/${lang}/badges`}
      notificationsHref={`/${lang}/notifications`}
      unreadCount={unreadCount}
      avatarKey={k.avatarKey}
      avatarHref={`/${lang}/avatar`}
    />
  );
}

void sql;
