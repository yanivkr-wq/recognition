/**
 * Admin · quick insights.
 *
 * A read-only, at-a-glance dashboard: a card per player (balance, tasks today,
 * active journeys, pending approvals + redemptions), an overall-stats strip
 * (coins earned, tasks completed, redemptions, badges), and a "latest
 * requests" list of the things waiting on the admin (pending approvals +
 * pending redemptions, newest first).
 *
 * All numbers are derived live from the ledger / completion / submission /
 * redemption tables, scoped to the household's kids. Mobile-first grid.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, getPool, kid as kidTable } from '@reco/db';
import { auth } from '../../../../auth';
import { Avatar } from '../../../../components/avatar';
import { Coin } from '../../../../components/coin';

export const dynamic = 'force-dynamic';

interface CountRow {
  kid_id: string;
  n: number;
}

export default async function AdminInsightsPage({
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
  const kids = await db
    .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color, avatarKey: kidTable.avatarKey })
    .from(kidTable)
    .where(and(eq(kidTable.householdId, householdId), isNull(kidTable.archivedAt)))
    .orderBy(asc(kidTable.name));
  const kidIds = kids.map((k) => k.id);

  const pool = getPool();
  const today = (
    await pool.query<{ today: string }>(
      `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text AS today`,
    )
  ).rows[0]!.today;

  // Empty-household short circuit (no kids → no aggregates to run).
  if (kidIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink">{t.insights.heading}</h1>
        <p className="text-ink-soft">{t.admin.kids}: 0</p>
      </div>
    );
  }

  const toMap = (rows: CountRow[]) => new Map(rows.map((r) => [r.kid_id, Number(r.n)]));

  const [bal, appr, redem, journeys, tToday, overall, latest] = await Promise.all([
    pool.query<CountRow>(
      `SELECT kid_id, GREATEST(0, COALESCE(SUM(amount),0))::int AS n
         FROM ledger_entry WHERE kid_id = ANY($1::uuid[]) GROUP BY kid_id`,
      [kidIds],
    ),
    pool.query<CountRow>(
      `SELECT kid_id, count(*)::int AS n FROM submission
        WHERE kid_id = ANY($1::uuid[]) AND status='pending' GROUP BY kid_id`,
      [kidIds],
    ),
    pool.query<CountRow>(
      `SELECT kid_id, count(*)::int AS n FROM redemption
        WHERE kid_id = ANY($1::uuid[]) AND status='pending_delivery' GROUP BY kid_id`,
      [kidIds],
    ),
    pool.query<CountRow>(
      `SELECT e.kid_id, count(*)::int AS n
         FROM campaign_enrollment e JOIN campaign c ON c.id = e.campaign_id
        WHERE e.kid_id = ANY($1::uuid[]) AND e.completed_at IS NULL AND c.archived_at IS NULL
        GROUP BY e.kid_id`,
      [kidIds],
    ),
    pool.query<CountRow>(
      `SELECT kid_id, count(*)::int AS n FROM task_completion
        WHERE kid_id = ANY($1::uuid[]) AND completion_date = $2::date
          AND undone_at IS NULL AND approval_status IN ('approved','auto_approved')
        GROUP BY kid_id`,
      [kidIds, today],
    ),
    pool.query<{ coins: number; tasks: number; redemptions: number; badges: number }>(
      `SELECT
         (SELECT COALESCE(SUM(amount),0)::int FROM ledger_entry WHERE kid_id = ANY($1::uuid[]) AND amount > 0) AS coins,
         (SELECT count(*)::int FROM task_completion WHERE kid_id = ANY($1::uuid[]) AND undone_at IS NULL AND approval_status IN ('approved','auto_approved')) AS tasks,
         (SELECT count(*)::int FROM redemption WHERE kid_id = ANY($1::uuid[]) AND status IN ('pending_delivery','received')) AS redemptions,
         (SELECT count(*)::int FROM kid_badge WHERE kid_id = ANY($1::uuid[])) AS badges`,
      [kidIds],
    ),
    pool.query<{ kind: string; kid_id: string; title_he: string; title_en: string; at: string }>(
      `(SELECT 'approval' AS kind, s.kid_id, tt.title_he, tt.title_en, s.submitted_at::text AS at
          FROM submission s
          JOIN task_completion tc ON tc.id = s.task_completion_id
          JOIN task_assignment ta ON ta.id = tc.assignment_id
          JOIN task_template tt ON tt.id = ta.template_id
         WHERE s.kid_id = ANY($1::uuid[]) AND s.status = 'pending')
       UNION ALL
       (SELECT 'redemption' AS kind, r.kid_id, ri.title_he, ri.title_en, r.redeemed_at::text AS at
          FROM redemption r
          JOIN reward_item ri ON ri.id = r.reward_item_id
         WHERE r.kid_id = ANY($1::uuid[]) AND r.status = 'pending_delivery')
       ORDER BY at DESC
       LIMIT 8`,
      [kidIds],
    ),
  ]);

  const balMap = toMap(bal.rows);
  const apprMap = toMap(appr.rows);
  const redemMap = toMap(redem.rows);
  const journeyMap = toMap(journeys.rows);
  const todayMap = toMap(tToday.rows);
  const o = overall.rows[0]!;
  const kidName = new Map(kids.map((k) => [k.id, k.name]));

  return (
    <div className="space-y-7">
      <h1 className="text-2xl font-bold text-ink">{t.insights.heading}</h1>

      {/* Per-player cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {kids.map((k) => (
          <div key={k.id} className="bg-card rounded-2xl shadow-card border border-rule p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={44} />
              <span className="font-bold text-ink text-lg flex-1 min-w-0 truncate">{k.name}</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-sm font-bold num">
                <Coin size={15} />
                <span dir="ltr">{balMap.get(k.id) ?? 0}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t.insights.tasksToday} value={todayMap.get(k.id) ?? 0} tone="mint" />
              <Stat label={t.insights.activeJourneys} value={journeyMap.get(k.id) ?? 0} tone="lavender" />
              <Stat label={t.insights.pendingApprovals} value={apprMap.get(k.id) ?? 0} tone="pink" />
              <Stat label={t.insights.pendingRedemptions} value={redemMap.get(k.id) ?? 0} tone="sky" />
            </div>
            <Link
              href={`/${lang}/admin/kids/${k.id}/ledger`}
              className="inline-block text-xs text-pink-dark font-bold underline-offset-2 hover:underline"
            >
              {t.insights.viewLedger}
            </Link>
          </div>
        ))}
      </div>

      {/* Overall stats */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
          {t.insights.overall}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t.insights.totalCoins} value={o.coins} tone="yellow" big />
          <Stat label={t.insights.totalTasks} value={o.tasks} tone="mint" big />
          <Stat label={t.insights.totalRedemptions} value={o.redemptions} tone="sky" big />
          <Stat label={t.insights.badgesEarned} value={o.badges} tone="lavender" big />
        </div>
      </section>

      {/* Latest requests */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
          {t.insights.latestRequests}
        </h2>
        {latest.rows.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-5 text-center">
            <p className="text-ink-soft">{t.insights.noRequests}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {latest.rows.map((r, i) => (
              <li
                key={i}
                className="bg-card rounded-2xl border border-rule p-3 flex items-center gap-3"
              >
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                    r.kind === 'approval' ? 'bg-pink-pale text-pink-dark' : 'bg-sky-pale text-sky-dark'
                  }`}
                >
                  {r.kind === 'approval' ? t.insights.pendingApprovals : t.insights.pendingRedemptions}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-ink">
                  {lang === 'he' ? r.title_he : r.title_en}
                </span>
                <span className="text-xs text-ink-soft truncate">{kidName.get(r.kid_id)}</span>
                <Link
                  href={`/${lang}/admin/${r.kind === 'approval' ? 'approvals' : 'redemptions'}`}
                  className="text-xs text-pink-dark font-bold shrink-0"
                >
                  →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const TONE: Record<string, string> = {
  mint: 'bg-mint-soft text-mint-dark',
  lavender: 'bg-lavender-soft text-lavender-dark',
  pink: 'bg-pink-soft text-pink-dark',
  sky: 'bg-sky-soft text-sky-dark',
  yellow: 'bg-yellow-pale text-[#7A5D10]',
};

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE | string;
  big?: boolean;
}) {
  return (
    <div className={`rounded-xl px-3 py-2 ${TONE[tone] ?? 'bg-bg text-ink'}`}>
      <p className={`num font-bold ${big ? 'text-2xl' : 'text-lg'}`} dir="ltr">
        {value}
      </p>
      <p className="text-[11px] leading-tight opacity-80">{label}</p>
    </div>
  );
}
