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
  longTermProgress,
} from '@reco/db';
import { auth } from '../../auth';
import {
  KidHome,
  type KidHomeTask,
  type KidHomeLongTermTask,
} from './_components/kid-home';
import { PlayerMessagePopup } from './_components/player-message-popup';
import { getKidAttention } from '../../lib/notifications/kid-attention';

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
    .select({
      name: kidTable.name,
      color: kidTable.color,
      avatarKey: kidTable.avatarKey,
      householdId: kidTable.householdId,
    })
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
      maxPerDay: taskTemplate.maxPerDay,
    })
    .from(taskAssignment)
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskAssignment.templateId))
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

  // Today's active completions for these assignments, aggregated per
  // assignment so a repeatable task can hold several at once (each its own
  // approval). One row per occurrence; we bucket by state in JS.
  const dailyIds = dailyRows.map((r) => r.assignmentId);
  type OccRow = {
    assignment_id: string;
    id: string;
    approval_status: string;
    evidence_submission_id: string | null;
    deny_reason: string | null;
  };
  const occByAssignment = new Map<
    string,
    { approved: OccRow[]; waiting: OccRow[]; needsPhoto: OccRow[]; denied: OccRow[] }
  >();
  if (dailyIds.length > 0) {
    const occRes = await getPool().query<OccRow>(
      `SELECT tc.assignment_id, tc.id, tc.approval_status, tc.evidence_submission_id,
              s.deny_reason
         FROM task_completion tc
         LEFT JOIN submission s ON s.id = tc.evidence_submission_id
        WHERE tc.kid_id = $1 AND tc.completion_date = $2 AND tc.undone_at IS NULL
          AND tc.assignment_id = ANY($3::uuid[])
        ORDER BY tc.occurrence_ordinal`,
      [kidId, today, dailyIds],
    );
    for (const o of occRes.rows) {
      let b = occByAssignment.get(o.assignment_id);
      if (!b) {
        b = { approved: [], waiting: [], needsPhoto: [], denied: [] };
        occByAssignment.set(o.assignment_id, b);
      }
      if (o.approval_status === 'denied') b.denied.push(o);
      else if (o.approval_status === 'pending') {
        if (o.evidence_submission_id) b.waiting.push(o);
        else b.needsPhoto.push(o);
      } else b.approved.push(o);
    }
  }

  // Phase 7.5: compute "is this task locked right now?" for each daily
  // assignment with a deadline. One tiny query for current IL time.
  const nowRes = await getPool().query<{ now_il: string }>(
    `SELECT to_char(now() AT TIME ZONE $1, 'HH24:MI:SS') AS now_il`,
    [HOUSEHOLD_TZ],
  );
  const nowIl = nowRes.rows[0]!.now_il;

  const tasks: KidHomeTask[] = dailyRows.map((r) => {
    const occ = occByAssignment.get(r.assignmentId) ?? {
      approved: [],
      waiting: [],
      needsPhoto: [],
      denied: [],
    };
    // Slot usage: approved + waiting + open-needs-photo count; denied frees a
    // slot (retry). NULL maxPerDay = unlimited.
    const capUsed = occ.approved.length + occ.waiting.length + occ.needsPhoto.length;
    const doneToday = occ.approved.length + occ.waiting.length;
    const locked = !!(r.deadlineTime && nowIl > r.deadlineTime);
    const underCap = r.maxPerDay == null || capUsed < r.maxPerDay;
    const canDoAgain = underCap && !locked;

    let status: KidHomeTask['status'];
    let completionId: string | null = null;
    let denyReason: string | null = null;
    if (occ.needsPhoto.length > 0) {
      status = 'needsPhoto';
      completionId = occ.needsPhoto[0]!.id;
    } else if (occ.denied.length > 0 && canDoAgain) {
      const d = occ.denied[occ.denied.length - 1]!;
      status = 'denied';
      completionId = d.id;
      denyReason = d.deny_reason;
    } else if (capUsed === 0) {
      status = locked ? 'locked' : 'todo';
    } else if (occ.approved.length > 0) {
      status = 'done';
      completionId = occ.approved[occ.approved.length - 1]!.id;
    } else {
      status = 'pending';
      completionId = occ.waiting[occ.waiting.length - 1]!.id;
    }

    return {
      assignmentId: r.assignmentId,
      completionId,
      status,
      titleHe: r.titleHe,
      titleEn: r.titleEn,
      iconKey: r.iconKey,
      color: r.color,
      coinValue: r.coinValue,
      evidenceRequired: r.evidenceRequired,
      denyReason,
      deadlineTime: r.deadlineTime,
      maxPerDay: r.maxPerDay,
      doneToday,
      canDoAgain,
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

  // Kid bell / app-badge — "anything that needs me" (pending task, pending
  // denial, active pop-up message, and unread event news). Computed by the
  // shared helper so the bell number always matches what the kid sees on the
  // notifications page (and the OS app-icon badge). The helper also resolves
  // the active popup so we don't query it twice.
  const attention = await getKidAttention(kidId, k.householdId, lang);
  const attentionCount = attention.count;
  const popupMessage = attention.popup;

  return (
    <>
      {popupMessage && (
        <PlayerMessagePopup
          messageId={popupMessage.id}
          title={popupMessage.title}
          body={popupMessage.body}
          t={t}
        />
      )}
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
      unreadCount={attentionCount}
      avatarKey={k.avatarKey}
      avatarHref={`/${lang}/avatar`}
    />
    </>
  );
}

void sql;
