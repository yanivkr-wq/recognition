/**
 * Kid reward shop — client shell. Mirrors the kid-home layout grammar
 * (BRANDBOOK §12.2) but the hero card here is read-only ("here's what you
 * have to spend") and the grid below is reward tiles.
 *
 * The balance number animates on each successful redemption — same pulse
 * idiom as the home page (BRANDBOOK §9.3) but in the reverse direction
 * (coins leaving). The pink pulse colors the surrounding chip; the number
 * itself only does scale, not color, to keep continuity with home.
 */

'use client';

import { useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { Coin } from '../../../../components/coin';
import { RewardTile } from './reward-tile';
import { BottomNav } from '../../_components/bottom-nav';
import { Avatar } from '../../../../components/avatar';
import { arrowForward } from '../../../../lib/rtl';

export interface ShopReward {
  id: string;
  titleHe: string;
  titleEn: string;
  descriptionHe: string | null;
  descriptionEn: string | null;
  iconKey: string;
  color: string;
  /** Optional full-bleed image URL (admin-uploaded). Resolved server-side:
   *  legacy http(s) URLs pass through unchanged; uploaded files route through
   *  the session-gated `/api/reward-images/<reward-id>`. When non-null, the
   *  tile's hero renders the photo instead of the pastel-tile + icon. */
  imageUrl: string | null;
  coinCost: number;
  stockQuantity: number | null;
  maxPerKidPerDay: number | null;
  usedToday: number;
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  kidName: string;
  kidColor: string;
  kidAvatarKey: string | null;
  initialBalance: number;
  rewards: ShopReward[];
  homeHref: string;
  historyHref: string;
}

export function Shop(props: Props) {
  const { lang, t, kidName, kidColor, kidAvatarKey, initialBalance, rewards, homeHref, historyHref } =
    props;
  const [balance, setBalance] = useState<number>(initialBalance);

  return (
    <>
    <main className="min-h-screen bg-bg pb-28">
      <header className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={kidName} color={kidColor} avatarKey={kidAvatarKey} size={48} />
          <div>
            <h1 className="text-2xl font-bold text-ink">{t.redeem.title}</h1>
            <p className="text-xs text-ink-soft">{t.redeem.subtitle}</p>
          </div>
        </div>
        <a
          href={homeHref}
          className="text-xs text-ink-soft underline-offset-4 hover:underline"
        >
          {t.redeem.backToHome}
        </a>
      </header>

      {/* Compact balance + history link strip */}
      <section className="mx-5 mt-2">
        <div className="bg-card rounded-2xl shadow-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coin size={22} />
            <span className="text-2xl font-extrabold text-ink num" dir="ltr">
              {balance}
            </span>
            <span className="text-xs text-ink-soft">{t.wallet.coins}</span>
          </div>
          <a
            href={historyHref}
            className="text-xs text-pink-dark font-bold hover:underline"
          >
            {t.redeem.historyLink} {arrowForward(lang)}
          </a>
        </div>
      </section>

      {/* Reward grid */}
      <section className="mx-5 mt-6">
        {rewards.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-6 text-center">
            <p className="font-bold text-ink">{t.redeem.noRewards}</p>
            <p className="text-sm text-ink-soft mt-1">{t.redeem.noRewardsHint}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {rewards.map((reward) => (
              <RewardTile
                key={reward.id}
                reward={reward}
                lang={lang}
                t={t}
                balance={balance}
                onBalance={setBalance}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
    <BottomNav lang={lang} t={t} />
    </>
  );
}
