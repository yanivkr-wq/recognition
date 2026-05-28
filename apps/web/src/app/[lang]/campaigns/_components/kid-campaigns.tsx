/**
 * Kid · campaigns view (client-rendered, but data fetched in the server page).
 *
 * Two sections: active + completed. Active uses a brandbook-locked progress
 * card grammar: streak shows a chain count "X / N days" plus tiny dots for
 * the chain visual; total shows a lavender progress bar (BRANDBOOK §6.4
 * pattern matches the long-term task card).
 */

'use client';

import type { Dictionary } from '@reco/shared/i18n';
import { Coin } from '../../../../components/coin';
import { BottomNav } from '../../_components/bottom-nav';
import { Avatar } from '../../../../components/avatar';
import { BadgeEmblem } from '../../../../components/badge-emblem';
import { arrowForward } from '../../../../lib/rtl';

export interface KidCampaign {
  enrollmentId: string;
  campaignId: string;
  titleHe: string;
  titleEn: string;
  kind: 'streak' | 'total';
  startDate: string;
  endDate: string;
  bonusCoins: number;
  streakTargetDays: number | null;
  streakFreezesAllowed: number;
  totalTargetQuantity: number | null;
  /** Display unit for a 'total' journey (hours / pages / …). null = none. */
  measureUnit: string | null;
  currentStreak: number;
  freezesUsed: number;
  currentTotal: number;
  completedAt: string | null;
  completedKind: 'success' | 'incomplete' | 'cancelled' | null;
  /** Optional badge the kid will earn on completion. All null when the
   *  admin didn't link a badge to this campaign. */
  badgeId: string | null;
  badgeTitleHe: string | null;
  badgeTitleEn: string | null;
  badgeIconKey: string | null;
  badgeColor: string | null;
  badgeImageUrl: string | null;
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  kidName: string;
  kidColor: string;
  kidAvatarKey: string | null;
  campaigns: KidCampaign[];
  homeHref: string;
  badgesHref: string;
}

export function KidCampaigns(props: Props) {
  const { lang, t, kidName, kidColor, kidAvatarKey, campaigns, homeHref, badgesHref } = props;
  const active = campaigns.filter((c) => c.completedAt == null);
  const done = campaigns.filter((c) => c.completedAt != null);

  return (
    <>
    <main className="min-h-screen bg-bg pb-28">
      <header
        className="px-5 pb-3 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center gap-3">
          <Avatar name={kidName} color={kidColor} avatarKey={kidAvatarKey} size={48} />
          <h1 className="text-2xl font-bold text-ink">
            {t.campaign.sectionTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href={badgesHref} className="text-pink-dark font-bold hover:underline">
            {t.campaign.pageLinkBadges} {arrowForward(lang)}
          </a>
          <a href={homeHref} className="text-ink-soft hover:underline">
            {t.redeem.backToHome}
          </a>
        </div>
      </header>

      <section className="mx-5 mt-4 space-y-3">
        {active.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-6 text-center">
            <p className="font-bold text-ink">{t.campaign.noActive}</p>
            <p className="text-sm text-ink-soft mt-1">{t.campaign.noActiveHint}</p>
          </div>
        ) : (
          active.map((c) => <CampaignCard key={c.enrollmentId} c={c} lang={lang} t={t} />)
        )}
      </section>

      {done.length > 0 && (
        <section className="mx-5 mt-8 space-y-3">
          <h2 className="text-base font-bold text-ink">
            {t.campaign.completedSuccess}
          </h2>
          {done.map((c) => (
            <CompletedCard key={c.enrollmentId} c={c} lang={lang} t={t} />
          ))}
        </section>
      )}
    </main>
    <BottomNav lang={lang} t={t} />
    </>
  );
}

function CampaignCard({
  c,
  lang,
  t,
}: {
  c: KidCampaign;
  lang: 'he' | 'en';
  t: Dictionary;
}) {
  const title = lang === 'he' ? c.titleHe : c.titleEn;
  const isStreak = c.kind === 'streak';
  const target = isStreak ? c.streakTargetDays ?? 0 : c.totalTargetQuantity ?? 0;
  const value = isStreak ? c.currentStreak : c.currentTotal;
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));

  return (
    <div
      className={`rounded-2xl border shadow-card p-4 space-y-3 ${
        isStreak
          ? 'bg-mint-soft border-mint-pale'
          : 'bg-lavender-soft border-lavender-pale'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-ink text-base truncate">{title}</h3>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-xs font-bold num shrink-0">
          <Coin size={14} />
          +<span dir="ltr">{c.bonusCoins}</span>
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs text-ink-soft">
          <span>
            {isStreak ? t.campaign.streakChain : t.campaign.progress}
          </span>
          {/* Fix 9: always show numeric breakdown — N / target [unit] · X% */}
          <span className="num font-bold text-ink" dir="ltr">
            {value} / {target}
            {!isStreak && c.measureUnit ? ` ${c.measureUnit}` : ''} · {pct}%
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-card overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isStreak ? 'bg-mint' : 'bg-lavender'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-ink-soft pt-0.5">
          {/* Fix 8: funny encouragement copy that changes with progress. */}
          <span className="text-ink leading-tight">
            {encouragementFor(pct, t)}
          </span>
          <span className="num" dir="ltr">
            {Math.max(0, target - value)}{' '}
            {isStreak ? t.campaign.targetDays : t.campaign.targetTotal}{' '}
            {t.campaign.toGoLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-ink-soft">
        <span dir="ltr" className="num">
          {c.startDate} → {c.endDate}
        </span>
        {isStreak && c.streakFreezesAllowed > 0 && (
          <span className="num" dir="ltr">
            {t.campaign.freezesUsed}: {c.freezesUsed} / {c.streakFreezesAllowed}
          </span>
        )}
      </div>

      {/* Badge preview — only when the campaign has a linked badge_id.
          Mirrors the embroidered-patch grammar from /[lang]/badges (pastel
          ring + dashed border + inner tile + initial letter), shrunk to
          40px so it sits comfortably next to the badge name. */}
      {c.badgeId && c.badgeTitleHe && c.badgeColor && (
        <div className="flex items-center gap-2 pt-2 border-t border-rule/60">
          <BadgeEmblem
            iconKey={c.badgeIconKey ?? ''}
            color={c.badgeColor}
            title={lang === 'he' ? c.badgeTitleHe : c.badgeTitleEn ?? c.badgeTitleHe}
            imageUrl={c.badgeImageUrl}
            size={40}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-ink-soft">
              {t.campaign.winBadge}
            </p>
            <p className="text-sm font-bold text-ink truncate">
              {lang === 'he' ? c.badgeTitleHe : c.badgeTitleEn ?? c.badgeTitleHe}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pick a single encouragement line based on progress bucket. */
function encouragementFor(pct: number, t: Dictionary): string {
  if (pct === 0) return t.campaign.encourage0;
  if (pct < 25) return t.campaign.encourage25;
  if (pct < 50) return t.campaign.encourage50;
  if (pct < 75) return t.campaign.encourage75;
  return t.campaign.encourage99;
}

function CompletedCard({
  c,
  lang,
  t,
}: {
  c: KidCampaign;
  lang: 'he' | 'en';
  t: Dictionary;
}) {
  const title = lang === 'he' ? c.titleHe : c.titleEn;
  const success = c.completedKind === 'success';
  return (
    <div
      className={`rounded-2xl border p-3 flex items-center gap-3 ${
        success
          ? 'bg-mint-soft border-mint-pale'
          : 'bg-pink-soft border-pink-pale'
      }`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          success ? 'bg-mint-dark' : 'bg-pink-dark'
        }`}
        aria-hidden="true"
      />
      <p className="flex-1 font-bold text-ink text-sm truncate">{title}</p>
      <span className={`text-xs font-bold ${success ? 'text-mint-dark' : 'text-pink-dark'}`}>
        {success ? t.campaign.completedSuccess : t.campaign.completedIncomplete}
      </span>
    </div>
  );
}
