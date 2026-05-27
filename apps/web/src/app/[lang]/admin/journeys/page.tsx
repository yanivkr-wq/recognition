/**
 * Admin · journeys status — a read-only overview of every player's journey
 * progress (Lily's request: "a look for admins to understand journey status").
 *
 * Grouped by player: each active enrolment shows a live progress bar
 * (value / target [unit] · %), kind chip, window + days left, and bonus; done
 * journeys appear muted below. Progress is re-derived live per render via
 * evaluateStreak / evaluateTotal (same source of truth as the kid view), so it
 * reflects the latest completions — not the possibly-stale cache fields.
 *
 * Linked from the admin menu, the Players page (a player's "active journeys"
 * stat), and the Insights "active journeys" KPI. An optional ?kid= filters to
 * one player.
 */

import { redirect } from 'next/navigation';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import {
  getDb,
  getPool,
  evaluateStreak,
  evaluateTotal,
  kid as kidTable,
  campaign as campaignTable,
  campaignEnrollment,
} from '@reco/db';
import { auth } from '../../../../auth';
import { Avatar } from '../../../../components/avatar';
import { Coin } from '../../../../components/coin';

export const dynamic = 'force-dynamic';

const MINT = '#2EB683';
const LAVENDER = '#8B72CE';

interface JourneyRow {
  enrollmentId: string;
  kidId: string;
  campaignId: string;
  titleHe: string;
  titleEn: string;
  kind: 'streak' | 'total';
  startDate: string;
  endDate: string;
  bonusCoins: number;
  streakTargetDays: number | null;
  totalTargetQuantity: number | null;
  measureUnit: string | null;
  cachedStreak: number;
  cachedTotal: number;
  completedAt: Date | null;
  completedKind: 'success' | 'incomplete' | 'cancelled' | null;
  value: number; // live
}

export default async function AdminJourneysPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ kid?: string }>;
}) {
  const { lang } = await params;
  const { kid: kidFilter } = await searchParams;
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

  const rows = await db
    .select({
      enrollmentId: campaignEnrollment.id,
      kidId: campaignEnrollment.kidId,
      campaignId: campaignTable.id,
      titleHe: campaignTable.titleHe,
      titleEn: campaignTable.titleEn,
      kind: campaignTable.kind,
      startDate: campaignTable.startDate,
      endDate: campaignTable.endDate,
      bonusCoins: campaignTable.bonusCoins,
      streakTargetDays: campaignTable.streakTargetDays,
      totalTargetQuantity: campaignTable.totalTargetQuantity,
      measureUnit: campaignTable.measureUnit,
      cachedStreak: campaignEnrollment.currentStreak,
      cachedTotal: campaignEnrollment.currentTotal,
      completedAt: campaignEnrollment.completedAt,
      completedKind: campaignEnrollment.completedKind,
    })
    .from(campaignEnrollment)
    .innerJoin(campaignTable, eq(campaignTable.id, campaignEnrollment.campaignId))
    .where(and(eq(campaignTable.householdId, householdId), isNull(campaignTable.archivedAt)))
    .orderBy(desc(campaignTable.startDate));

  // Re-derive live progress for ACTIVE enrolments (done ones keep their cache).
  const client = await getPool().connect();
  const journeys: JourneyRow[] = [];
  try {
    const todayRes = await client.query<{ today: string }>(
      `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text AS today`,
    );
    const today = todayRes.rows[0]!.today;
    for (const r of rows) {
      let value: number;
      if (r.completedAt != null) {
        value = r.kind === 'streak' ? r.cachedStreak : r.cachedTotal;
      } else if (r.kind === 'streak') {
        value = (await evaluateStreak(client, { kidId: r.kidId, campaignId: r.campaignId, asOfDate: today })).currentStreak;
      } else {
        value = (await evaluateTotal(client, { kidId: r.kidId, campaignId: r.campaignId, asOfDate: today })).currentTotal;
      }
      journeys.push({ ...r, value });
    }
  } finally {
    client.release();
  }

  const visibleKids = kidFilter ? kids.filter((k) => k.id === kidFilter) : kids;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.journeysStatus}</h1>

      {visibleKids.map((k) => {
        const mine = journeys.filter((j) => j.kidId === k.id);
        const active = mine.filter((j) => j.completedAt == null);
        const done = mine.filter((j) => j.completedAt != null);
        return (
          <section key={k.id} className="bg-card rounded-2xl border border-rule shadow-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={40} />
              <p className="font-bold text-ink">{k.name}</p>
              <span className="num text-xs text-ink-faded ms-auto" dir="ltr">
                {active.length} · {done.length}
              </span>
            </div>

            {active.length === 0 && done.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.campaign.noActive}</p>
            ) : (
              <ul className="space-y-3">
                {active.map((j) => (
                  <JourneyCard key={j.enrollmentId} j={j} lang={lang} t={t} />
                ))}
                {done.map((j) => (
                  <li
                    key={j.enrollmentId}
                    className="flex items-center gap-2 text-sm rounded-xl border border-rule px-3 py-2 opacity-70"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: j.completedKind === 'success' ? MINT : '#E94B7F' }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0 truncate text-ink">
                      {lang === 'he' ? j.titleHe : j.titleEn}
                    </span>
                    <span className={`text-xs font-bold ${j.completedKind === 'success' ? 'text-mint-dark' : 'text-pink-dark'}`}>
                      {j.completedKind === 'success' ? t.campaign.completedSuccess : t.campaign.completedIncomplete}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {visibleKids.every((k) => journeys.filter((j) => j.kidId === k.id).length === 0) && (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">{t.campaign.noActive}</p>
        </div>
      )}
    </div>
  );
}

function JourneyCard({
  j,
  lang,
  t,
}: {
  j: JourneyRow;
  lang: string;
  t: ReturnType<typeof getDictionary>;
}) {
  const title = lang === 'he' ? j.titleHe : j.titleEn;
  const isStreak = j.kind === 'streak';
  const target = isStreak ? j.streakTargetDays ?? 0 : j.totalTargetQuantity ?? 0;
  const pct = Math.min(100, Math.round((j.value / Math.max(1, target)) * 100));
  const accent = isStreak ? MINT : LAVENDER;

  return (
    <li className="rounded-xl border border-rule p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${
              isStreak ? 'bg-mint-pale text-mint-dark' : 'bg-lavender-pale text-lavender-dark'
            }`}
          >
            {isStreak ? t.admin.campaignKindStreak : t.admin.campaignKindTotal}
          </span>
          <span className="font-bold text-ink truncate">{title}</span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-[#7A5D10] num" dir="ltr">
          <Coin size={12} />+{j.bonusCoins}
        </span>
      </div>

      <div className="flex items-baseline justify-between text-xs text-ink-soft">
        <span>{pct}%</span>
        <span className="num font-bold text-ink" dir="ltr">
          {j.value} / {target}
          {!isStreak && j.measureUnit ? ` ${j.measureUnit}` : ''}
          {isStreak ? ` ${t.campaign.targetDays}` : ''}
        </span>
      </div>
      <span className="block h-2.5 w-full rounded-full bg-rule overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </span>
      <p className="text-[11px] text-ink-faded num" dir="ltr">
        {j.startDate} → {j.endDate}
      </p>
    </li>
  );
}
