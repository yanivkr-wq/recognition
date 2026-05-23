/**
 * Kid · badge collection client component.
 *
 * Grid of earned badges + section of locked-but-visible upcoming. Renders
 * a placeholder embroidered-patch (pastel tile + initial) until the SVG
 * family-3 emblems land in Phase 9. The dashed stitched border per
 * BRANDBOOK §5 will follow with the SVG ship.
 */

'use client';

import type { Dictionary } from '@reco/shared/i18n';
import { BottomNav } from '../../_components/bottom-nav';
import { Avatar } from '../../../../components/avatar';
import { arrowForward } from '../../../../lib/rtl';

export interface EarnedBadge {
  id: string;
  badgeId: string;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
  awardedAt: string;
  awardedForYear: number | null;
}

export interface LockedBadge {
  id: string;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  kidName: string;
  kidColor: string;
  kidAvatarKey: string | null;
  earned: EarnedBadge[];
  locked: LockedBadge[];
  homeHref: string;
  campaignsHref: string;
}

export function KidBadges(props: Props) {
  const { lang, t, kidName, kidColor, kidAvatarKey, earned, locked, homeHref, campaignsHref } = props;

  return (
    <>
    <main className="min-h-screen bg-bg pb-28">
      <header className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={kidName} color={kidColor} avatarKey={kidAvatarKey} size={48} />
          <h1 className="text-2xl font-bold text-ink">{t.campaign.badgesTitle}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a
            href={campaignsHref}
            className="text-pink-dark font-bold hover:underline"
          >
            {t.campaign.pageLinkCampaigns} {arrowForward(lang)}
          </a>
          <a href={homeHref} className="text-ink-soft hover:underline">
            {t.redeem.backToHome}
          </a>
        </div>
      </header>

      <section className="mx-5 mt-4">
        {earned.length === 0 && locked.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-6 text-center">
            <p className="font-bold text-ink">{t.campaign.badgesEmpty}</p>
            <p className="text-sm text-ink-soft mt-1">{t.campaign.badgesEmptyHint}</p>
          </div>
        ) : (
          <>
            {earned.length > 0 && (
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {earned.map((b) => (
                  <li key={b.id} className="flex flex-col items-center gap-1.5">
                    <Patch
                      color={b.color}
                      title={lang === 'he' ? b.titleHe : b.titleEn}
                      locked={false}
                    />
                    <p className="text-xs font-bold text-ink text-center truncate w-full">
                      {lang === 'he' ? b.titleHe : b.titleEn}
                    </p>
                    <p className="text-[10px] text-ink-soft num" dir="ltr">
                      {fmtDate(b.awardedAt, lang)}
                      {b.awardedForYear ? ` · ${b.awardedForYear}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {locked.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs uppercase tracking-wider text-ink-soft mb-3">
                  {t.campaign.locked}
                </h2>
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {locked.map((b) => (
                    <li key={b.id} className="flex flex-col items-center gap-1.5">
                      <Patch
                        color={b.color}
                        title={lang === 'he' ? b.titleHe : b.titleEn}
                        locked
                      />
                      <p className="text-xs font-bold text-ink-soft text-center truncate w-full">
                        {lang === 'he' ? b.titleHe : b.titleEn}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </main>
    <BottomNav lang={lang} t={t} />
    </>
  );
}

function Patch({
  color,
  title,
  locked,
}: {
  color: string;
  title: string;
  locked: boolean;
}) {
  return (
    <div
      className={`w-20 h-20 rounded-full flex items-center justify-center transition ${
        locked ? 'opacity-40 grayscale' : ''
      }`}
      style={{
        backgroundColor: color + '33', // ~20% alpha pastel ring
        border: `2px dashed ${color}`,
      }}
      aria-hidden="true"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <span
          className="text-2xl font-bold text-card"
          style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
        >
          {title.charAt(0)}
        </span>
      </div>
    </div>
  );
}

function fmtDate(iso: string, lang: 'he' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}
