/**
 * Admin · Insights dashboard (2026-05-27 redesign, Lily's request:
 * "looks too colorful — make it a real dashboard with graphs").
 *
 * Restrained palette: white cards, ink text, a single pink primary accent
 * (#E94B7F) + one sky secondary (#3DA8DD). No rainbow tiles. Layout:
 *   1. KPI row — four monochrome stat tiles (coins, tasks, journeys, badges).
 *   2. Activity trend — two 14-day area charts (tasks/day, coins/day), inline
 *      SVG computed server-side (no client JS, no chart lib).
 *   3. Players — a compact table: balance (with inline bar), today, journeys,
 *      pending. Replaces the old per-kid pastel-tile cards.
 *   4. Needs attention — the pending approvals + redemptions queue, minimal.
 *
 * All figures derive live from ledger / completion / submission / redemption /
 * enrollment, scoped to the household's non-archived players.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, getPool, kid as kidTable } from '@reco/db';
import { auth } from '../../../../auth';
import { Avatar } from '../../../../components/avatar';
import { Coin } from '../../../../components/coin';
import { TrendChart } from './_components/trend-chart';

export const dynamic = 'force-dynamic';

const PINK = '#E94B7F';
const SKY = '#3DA8DD';

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

  if (kidIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink">{t.insights.heading}</h1>
        <p className="text-ink-soft">{t.admin.kids}: 0</p>
      </div>
    );
  }

  const toMap = (rows: CountRow[]) => new Map(rows.map((r) => [r.kid_id, Number(r.n)]));

  const [bal, appr, redem, journeys, tToday, tTodayActive, overall, latest, series] = await Promise.all([
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
        WHERE kid_id = ANY($1::uuid[])
          AND completion_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
          AND undone_at IS NULL AND approval_status IN ('approved','auto_approved')
        GROUP BY kid_id`,
      [kidIds],
    ),
    // Denominator for the "done today" stat: how many daily tasks the kid
    // is actually expected to do today (= active, non-archived daily
    // assignments). Matches what the kid sees on their home screen.
    pool.query<CountRow>(
      `SELECT ta.kid_id, count(*)::int AS n
         FROM task_assignment ta
         JOIN task_template tt ON tt.id = ta.template_id
        WHERE ta.kid_id = ANY($1::uuid[])
          AND ta.enabled = TRUE
          AND ta.archived_at IS NULL
          AND tt.archived_at IS NULL
          AND tt.kind = 'daily'
        GROUP BY ta.kid_id`,
      [kidIds],
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
    // 14-day daily series PER PLAYER: tasks completed + coins earned, IL dates,
    // zero-filled for every (day, player) so each player gets a continuous line.
    pool.query<{ day: string; kid_id: string; tasks: number; coins: number }>(
      `WITH days AS (
         SELECT generate_series(
           (now() AT TIME ZONE 'Asia/Jerusalem')::date - INTERVAL '13 days',
           (now() AT TIME ZONE 'Asia/Jerusalem')::date,
           INTERVAL '1 day'
         )::date AS day
       ),
       ppl AS (SELECT unnest($1::uuid[]) AS kid_id),
       tk AS (
         SELECT kid_id, completion_date AS day, count(*)::int AS n
           FROM task_completion
          WHERE kid_id = ANY($1::uuid[]) AND undone_at IS NULL
            AND approval_status IN ('approved','auto_approved')
            AND completion_date >= (now() AT TIME ZONE 'Asia/Jerusalem')::date - INTERVAL '13 days'
          GROUP BY kid_id, completion_date
       ),
       cn AS (
         SELECT kid_id, (created_at AT TIME ZONE 'Asia/Jerusalem')::date AS day, COALESCE(SUM(amount),0)::int AS n
           FROM ledger_entry
          WHERE kid_id = ANY($1::uuid[]) AND amount > 0
            AND (created_at AT TIME ZONE 'Asia/Jerusalem')::date >= (now() AT TIME ZONE 'Asia/Jerusalem')::date - INTERVAL '13 days'
          GROUP BY kid_id, (created_at AT TIME ZONE 'Asia/Jerusalem')::date
       )
       SELECT d.day::text AS day, p.kid_id,
              COALESCE(tk.n,0)::int AS tasks, COALESCE(cn.n,0)::int AS coins
         FROM days d
         CROSS JOIN ppl p
         LEFT JOIN tk ON tk.day = d.day AND tk.kid_id = p.kid_id
         LEFT JOIN cn ON cn.day = d.day AND cn.kid_id = p.kid_id
        ORDER BY d.day`,
      [kidIds],
    ),
  ]);

  const balMap = toMap(bal.rows);
  const apprMap = toMap(appr.rows);
  const redemMap = toMap(redem.rows);
  const journeyMap = toMap(journeys.rows);
  const todayMap = toMap(tToday.rows);
  const todayActiveMap = toMap(tTodayActive.rows);
  const o = overall.rows[0]!;
  const kidName = new Map(kids.map((k) => [k.id, k.name]));

  // Ordered unique day labels + per-(kid,day) lookup for building each
  // player's line.
  const dayLabels = [...new Set(series.rows.map((r) => r.day))];
  const cell = new Map(series.rows.map((r) => [`${r.kid_id}|${r.day}`, r]));
  const taskByPlayer = kids.map((k) => ({
    name: k.name,
    color: k.color,
    values: dayLabels.map((d) => Number(cell.get(`${k.id}|${d}`)?.tasks ?? 0)),
  }));
  const coinByPlayer = kids.map((k) => ({
    name: k.name,
    color: k.color,
    values: dayLabels.map((d) => Number(cell.get(`${k.id}|${d}`)?.coins ?? 0)),
  }));
  const journeysTotal = [...journeyMap.values()].reduce((a, b) => a + b, 0);
  const maxBal = Math.max(1, ...kids.map((k) => balMap.get(k.id) ?? 0));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.insights.heading}</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t.insights.totalCoins} value={o.coins} accent={PINK} icon={<Coin size={16} />} />
        <Kpi label={t.insights.totalTasks} value={o.tasks} accent={SKY} />
        <Kpi label={t.insights.activeJourneys} value={journeysTotal} accent="#B59FE5" href={`/${lang}/admin/journeys`} />
        <Kpi label={t.insights.badgesEarned} value={o.badges} accent="#E8B927" />
      </div>

      {/* Activity trend */}
      <section className="bg-card rounded-2xl border border-rule shadow-card p-4 sm:p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-4">
          {t.insights.activityTrend}
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <TrendChart
            title={t.insights.tasksPerDay}
            total={o.tasks}
            labels={dayLabels}
            series={taskByPlayer}
            lang={lang}
          />
          <TrendChart
            title={t.insights.coinsPerDay}
            total={o.coins}
            labels={dayLabels}
            series={coinByPlayer}
            lang={lang}
          />
        </div>
      </section>

      {/* Players — a responsive card list (no wide table to overflow on phones;
          every figure carries its own label so nothing is "out of reach"). */}
      <section className="bg-card rounded-2xl border border-rule shadow-card overflow-hidden">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-4 pt-4 pb-2">
          {t.insights.perPlayer}
        </h2>
        <ul className="divide-y divide-rule">
          {kids.map((k) => {
            const b = balMap.get(k.id) ?? 0;
            const pending = (apprMap.get(k.id) ?? 0) + (redemMap.get(k.id) ?? 0);
            return (
              <li key={k.id}>
                <Link
                  href={`/${lang}/admin/kids/${k.id}/ledger`}
                  className="block px-4 py-3 hover:bg-rule-soft transition"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-ink truncate leading-tight">{k.name}</p>
                        <span className="num text-sm font-bold text-ink inline-flex items-center gap-1 shrink-0" dir="ltr">
                          <Coin size={14} />
                          {b}
                        </span>
                      </div>
                      <span className="mt-1.5 block h-1.5 rounded-full bg-rule overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.round((b / maxBal) * 100)}%`, backgroundColor: PINK }}
                        />
                      </span>
                    </div>
                  </div>
                  {/* Labelled stat chips — wrap freely on narrow screens. */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft ps-[52px]">
                    <span className="inline-flex items-center gap-1.5">
                      {t.insights.tasksToday}
                      <span className="num font-bold text-ink" dir="ltr">
                        {todayMap.get(k.id) ?? 0}/{todayActiveMap.get(k.id) ?? 0}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {t.insights.activeJourneys}
                      <span className="num font-bold text-ink" dir="ltr">{journeyMap.get(k.id) ?? 0}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {t.insights.needsAttention}
                      {pending > 0 ? (
                        <span className="num inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-pink-pale text-pink-dark font-bold" dir="ltr">
                          {pending}
                        </span>
                      ) : (
                        <span className="text-ink-faded">—</span>
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Needs attention */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
          {t.insights.needsAttention}
        </h2>
        {latest.rows.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-5 text-center">
            <p className="text-ink-soft text-sm">{t.insights.noRequests}</p>
          </div>
        ) : (
          <ul className="bg-card rounded-2xl border border-rule shadow-card divide-y divide-rule overflow-hidden">
            {latest.rows.map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: r.kind === 'approval' ? PINK : SKY }}
                  aria-hidden="true"
                />
                <span className="text-[11px] uppercase tracking-wider text-ink-soft shrink-0 w-20 truncate">
                  {r.kind === 'approval' ? t.insights.pendingApprovals : t.insights.pendingRedemptions}
                </span>
                <span className="flex-1 min-w-0 break-words text-sm text-ink">
                  {lang === 'he' ? r.title_he : r.title_en}
                </span>
                <span className="text-xs text-ink-soft truncate hidden sm:inline">{kidName.get(r.kid_id)}</span>
                <Link
                  href={`/${lang}/admin/${r.kind === 'approval' ? 'approvals' : 'redemptions'}`}
                  className="text-pink-dark font-bold shrink-0"
                  aria-label={r.kind === 'approval' ? t.admin.approvals : t.admin.redemptions}
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

/** Monochrome KPI tile: big number + label + a thin accent rule on top.
 *  Renders as a link when `href` is given. */
function Kpi({
  label,
  value,
  accent,
  icon,
  href,
}: {
  label: string;
  value: number;
  accent: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="h-1" style={{ backgroundColor: accent }} aria-hidden="true" />
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-ink-soft">
          {icon}
          <span className="text-[11px] uppercase tracking-wider font-medium truncate">{label}</span>
        </div>
        <p className="num font-extrabold text-ink text-3xl leading-tight mt-1 text-start">
          <span dir="ltr">{value.toLocaleString('en-US')}</span>
        </p>
      </div>
    </>
  );
  const cls = 'bg-card rounded-2xl border border-rule shadow-card overflow-hidden block';
  return href ? (
    <Link href={href} className={`${cls} hover:border-ink-faded transition`}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

