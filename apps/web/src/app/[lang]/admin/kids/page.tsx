/**
 * Players — admin surface (re-imagined: data-first).
 *
 * Each player card leads with the numbers a parent actually manages — wallet
 * balance, tasks done today, active journeys, badges, and a highlighted
 * "needs action" count (pending approvals + redemptions) that links straight to
 * the queue. Below sits the quick-action row (Edit / Tasks / PIN / Devices /
 * Ledger / Joker). All figures derive live from the ledger / completions /
 * submissions / redemptions / enrolments, scoped to the household.
 */

import Link from 'next/link';
import { eq, isNull, and } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, getPool, kid as kidTable } from '@reco/db';
import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import { Avatar } from '../../../../components/avatar';
import { Coin } from '../../../../components/coin';

export const dynamic = 'force-dynamic';

interface CountRow {
  kid_id: string;
  n: number;
}

export default async function AdminKidsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const kids = await getDb()
    .select({
      id: kidTable.id,
      name: kidTable.name,
      slug: kidTable.slug,
      color: kidTable.color,
      avatarKey: kidTable.avatarKey,
    })
    .from(kidTable)
    .where(
      and(eq(kidTable.householdId, session.user.householdId), isNull(kidTable.archivedAt)),
    )
    .orderBy(kidTable.createdAt);

  const ids = kids.map((k) => k.id);
  const pool = getPool();
  const toMap = (rows: CountRow[]) => new Map(rows.map((r) => [r.kid_id, Number(r.n)]));

  let balance = new Map<string, number>();
  let today = new Map<string, number>();
  let appr = new Map<string, number>();
  let redem = new Map<string, number>();
  let journeys = new Map<string, number>();
  let badges = new Map<string, number>();

  if (ids.length > 0) {
    const [balRes, todayRes, apprRes, redemRes, journeyRes, badgeRes] = await Promise.all([
      pool.query<CountRow>(
        `SELECT kid_id, GREATEST(0, COALESCE(SUM(amount), 0))::int AS n
           FROM ledger_entry WHERE kid_id = ANY($1::uuid[]) GROUP BY kid_id`,
        [ids],
      ),
      pool.query<CountRow>(
        `SELECT kid_id, count(*)::int AS n FROM task_completion
          WHERE kid_id = ANY($1::uuid[])
            AND completion_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
            AND undone_at IS NULL AND approval_status IN ('approved','auto_approved')
          GROUP BY kid_id`,
        [ids],
      ),
      pool.query<CountRow>(
        `SELECT kid_id, count(*)::int AS n FROM submission
          WHERE kid_id = ANY($1::uuid[]) AND status='pending' GROUP BY kid_id`,
        [ids],
      ),
      pool.query<CountRow>(
        `SELECT kid_id, count(*)::int AS n FROM redemption
          WHERE kid_id = ANY($1::uuid[]) AND status='pending_delivery' GROUP BY kid_id`,
        [ids],
      ),
      pool.query<CountRow>(
        `SELECT e.kid_id, count(*)::int AS n
           FROM campaign_enrollment e JOIN campaign c ON c.id = e.campaign_id
          WHERE e.kid_id = ANY($1::uuid[]) AND e.completed_at IS NULL AND c.archived_at IS NULL
          GROUP BY e.kid_id`,
        [ids],
      ),
      pool.query<CountRow>(
        `SELECT kid_id, count(*)::int AS n FROM kid_badge
          WHERE kid_id = ANY($1::uuid[]) GROUP BY kid_id`,
        [ids],
      ),
    ]);
    balance = toMap(balRes.rows);
    today = toMap(todayRes.rows);
    appr = toMap(apprRes.rows);
    redem = toMap(redemRes.rows);
    journeys = toMap(journeyRes.rows);
    badges = toMap(badgeRes.rows);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.kids}</h1>

      <ul className="space-y-4">
        {kids.map((k) => {
          const needs = (appr.get(k.id) ?? 0) + (redem.get(k.id) ?? 0);
          return (
            <li key={k.id} className="bg-card rounded-3xl shadow-card border border-rule p-4 space-y-4">
              {/* Identity row — avatar + name + wallet balance. */}
              <div className="flex items-center gap-3">
                <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={56} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-lg truncate">{k.name}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-ink-soft num">
                    <Coin size={16} />
                    <span dir="ltr">{balance.get(k.id) ?? 0}</span>
                    <span className="font-medium text-ink-faded">{t.wallet.coins}</span>
                  </span>
                </div>
                {/* Needs-action badge → straight to the approvals queue. */}
                {needs > 0 && (
                  <Link
                    href={`/${lang}/admin/approvals`}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-pink-pale text-pink-dark font-bold text-xs px-3 py-2"
                  >
                    <span className="num" dir="ltr">{needs}</span>
                    {t.insights.needsAttention}
                  </Link>
                )}
              </div>

              {/* At-a-glance stats. Active-journeys tile opens the journey
                  status view filtered to this player. */}
              <div className="grid grid-cols-4 gap-2">
                <Stat label={t.insights.tasksToday} value={today.get(k.id) ?? 0} />
                <Stat
                  label={t.insights.activeJourneys}
                  value={journeys.get(k.id) ?? 0}
                  href={`/${lang}/admin/journeys?kid=${k.id}`}
                />
                <Stat label={t.insights.badgesEarned} value={badges.get(k.id) ?? 0} />
                <Stat label={t.insights.needsAttention} value={needs} alert={needs > 0} />
              </div>

              {/* Quick actions — neutral monochrome chips (Option C). */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <ActionChip href={`/${lang}/admin/kids/${k.id}/edit`} label={t.common.edit} icon={<PencilIcon />} />
                <ActionChip href={`/${lang}/admin/kids/${k.id}/tasks`} label={t.admin.tasks} icon={<ListIcon />} />
                <ActionChip href={`/${lang}/admin/kids/${k.id}/pin`} label={t.admin.setPin} icon={<LockIcon />} />
                <ActionChip href={`/${lang}/admin/kids/${k.id}/devices`} label={t.admin.devices} icon={<DeviceIcon />} />
                <ActionChip href={`/${lang}/admin/kids/${k.id}/ledger`} label={t.admin.ledger} icon={<ReceiptIcon />} />
                <ActionChip href={`/${lang}/admin/kids/${k.id}/wallet/adjust`} label={t.admin.joker} icon={<WandIcon />} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A compact labelled stat tile. Highlights when it needs the admin's action.
 *  Renders as a link when `href` is given. */
function Stat({
  label,
  value,
  alert,
  href,
}: {
  label: string;
  value: number;
  alert?: boolean;
  href?: string;
}) {
  const cls = `rounded-xl border px-2 py-2 text-center block ${
    alert ? 'bg-pink-pale border-pink-pale' : 'bg-rule-soft border-rule'
  } ${href ? 'hover:border-ink-faded transition' : ''}`;
  const inner = (
    <>
      <p className={`num text-xl font-extrabold leading-none ${alert ? 'text-pink-dark' : 'text-ink'}`} dir="ltr">
        {value}
      </p>
      <p className={`text-[10px] leading-tight mt-1 ${alert ? 'text-pink-dark' : 'text-ink-soft'}`}>{label}</p>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function ActionChip({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 text-[11px] font-semibold text-center bg-rule-soft border border-rule text-ink-soft hover:bg-rule hover:text-ink transition"
    >
      <span aria-hidden="true">{icon}</span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}

// ─── Action chip icons (20px stroke, currentColor) ─────────────────────────

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16.5 4.5l3 3L8 19l-4 1 1-4 11.5-11.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h12v18l-3-1.5L12 21l-3-1.5L6 21V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19l9-9M14.5 5.5l1 1M18 4l.01.01M19 9l1 1M9 4l.5 1.5L11 6l-1.5.5L9 8l-.5-1.5L7 6l1.5-.5L9 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
