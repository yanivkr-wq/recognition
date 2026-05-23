/**
 * Reward tile — single card in the shop grid (BRANDBOOK §12.2).
 *
 * Gating order (matches the server `redeemOperation` error precedence so
 * the optimistic UI never lies):
 *   1. out_of_stock — stockQuantity reached 0 globally
 *   2. per_day_cap_exceeded — usedToday >= maxPerKidPerDay for this kid
 *   3. insufficient_funds — spendable < coinCost
 * If any gate fails, the redeem button greys out and the reason text takes
 * over the cost row (or sits beneath it for the per-day-cap case).
 *
 * Successful redemption: balance pulses down to `balance - coinCost` via
 * the parent shop's `onBalance` callback. The server action's `revalidatePath`
 * will then re-fetch the next time the user navigates; for the immediate
 * post-redeem render we trust the optimistic update.
 */

'use client';

import { useActionState, useEffect } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { redeemAction, type RedeemState } from '../../../../lib/redeem/actions';
import { Coin } from '../../../../components/coin';
import { RewardIcon } from '../../../../components/reward-icon';
import { celebrate } from '../../../../lib/celebrate';
import type { ShopReward } from './shop';

interface Props {
  reward: ShopReward;
  lang: 'he' | 'en';
  t: Dictionary;
  balance: number;
  onBalance: (b: number) => void;
}

export function RewardTile({ reward, lang, t, balance, onBalance }: Props) {
  const title = lang === 'he' ? reward.titleHe : reward.titleEn;
  const description = lang === 'he' ? reward.descriptionHe : reward.descriptionEn;

  const [state, action, pending] = useActionState<RedeemState | undefined, FormData>(
    redeemAction,
    undefined,
  );

  // On success: optimistic balance decrement. The server returns the new
  // ledger balance via `coinCost`; we apply the delta locally rather than
  // re-fetch because the parent <Shop /> doesn't pass the absolute value
  // back to us — same delta-style pattern as the task card pulse.
  useEffect(() => {
    // Wallet pulse only — confetti fires from the button onClick (above)
    // because the action's revalidatePath can re-render the tile and the
    // effect timing becomes unreliable.
    if (state?.ok === true) {
      onBalance(balance - state.coinCost);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ---- Gating (mirrors redeemOperation precedence) --------------------------
  const stockEmpty = reward.stockQuantity !== null && reward.stockQuantity <= 0;
  const capReached =
    reward.maxPerKidPerDay !== null && reward.usedToday >= reward.maxPerKidPerDay;
  const cantAfford = balance < reward.coinCost;
  const disabled = stockEmpty || capReached || cantAfford || pending;

  // ---- Inline status line ---------------------------------------------------
  let statusLine: { text: string; tone: 'pink' | 'soft' } | null = null;
  if (state?.ok === true) {
    statusLine = { text: t.redeem.waitingForDelivery, tone: 'soft' };
  } else if (state?.ok === false) {
    if (state.error === 'insufficient_funds') {
      const need = state.meta?.coinCost ?? reward.coinCost;
      const have = state.meta?.spendable ?? balance;
      statusLine = {
        text: `${t.redeem.needsCoins} ${need - have}`,
        tone: 'pink',
      };
    } else if (state.error === 'out_of_stock') {
      statusLine = { text: t.redeem.outOfStock, tone: 'pink' };
    } else if (state.error === 'per_day_cap_exceeded') {
      statusLine = { text: t.redeem.alreadyGotToday, tone: 'pink' };
    } else if (state.error === 'unavailable' || state.error === 'not_found') {
      // The reward was archived/hidden between page load and tap. The server
      // revalidatePath will hide the tile on next render; show a soft error
      // until then.
      statusLine = { text: t.redeem.redeemError, tone: 'pink' };
    } else {
      statusLine = { text: t.redeem.redeemError, tone: 'pink' };
    }
  } else if (stockEmpty) {
    statusLine = { text: t.redeem.outOfStock, tone: 'pink' };
  } else if (capReached) {
    statusLine = { text: t.redeem.alreadyGotToday, tone: 'pink' };
  } else if (cantAfford) {
    statusLine = {
      text: `${t.redeem.needsCoins} ${reward.coinCost - balance}`,
      tone: 'pink',
    };
  } else if (
    reward.maxPerKidPerDay !== null &&
    reward.maxPerKidPerDay - reward.usedToday > 0
  ) {
    // Soft informational note for capped rewards the kid CAN still get.
    const remaining = reward.maxPerKidPerDay - reward.usedToday;
    statusLine = {
      text:
        reward.maxPerKidPerDay === 1
          ? t.redeem.todayOnly
          : `${remaining} / ${reward.maxPerKidPerDay} ${t.redeem.perDayLimit}`,
      tone: 'soft',
    };
  }

  return (
    <li className="bg-card rounded-2xl border border-rule shadow-card flex flex-col overflow-hidden">
      {/* Hero area: full-bleed photo when admin uploaded one (imageUrl),
          otherwise the original BRANDBOOK §12.2 grammar — pastel tile with a
          small RewardIcon centered. The image variant keeps the same
          aspect ratio as the icon variant so adjacent tiles align cleanly
          regardless of which they use. */}
      {reward.imageUrl ? (
        <div className="relative aspect-square w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reward.imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Cost chip floats top-corner so the kid still sees the price
              over a busy photo. */}
          <span className="absolute top-2 end-2 inline-flex items-center gap-1 bg-card/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold text-ink num shadow-card">
            <Coin size={14} />
            <span dir="ltr">{reward.coinCost}</span>
          </span>
        </div>
      ) : (
        <div
          className="rounded-t-2xl p-4 flex items-center justify-center"
          style={{ backgroundColor: reward.color }}
        >
          <RewardIcon iconKey={reward.iconKey} color={reward.color} title={title} />
        </div>
      )}
      <div className="p-3 flex flex-col gap-2 grow">
        <h3 className="font-bold text-ink text-sm leading-tight truncate">{title}</h3>
        {description && (
          <p className="text-[11px] text-ink-soft leading-snug line-clamp-2">
            {description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          {/* Coin cost lives inline on the original icon variant; on the
              photo variant the chip already floats over the hero, so we
              drop the inline copy to avoid double-showing the cost. */}
          {!reward.imageUrl && (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-ink num">
              <Coin size={16} />
              <span dir="ltr">{reward.coinCost}</span>
            </span>
          )}
          <form action={action} className={reward.imageUrl ? 'w-full' : ''}>
            <input type="hidden" name="rewardItemId" value={reward.id} />
            <button
              type="submit"
              disabled={disabled}
              onClick={(e) => {
                // Fix 4a: confetti at tap time before the action navigates
                // state. If the server rejects (insufficient_funds, etc.)
                // the gating in this component already caught it client-
                // side via `disabled`, so a real click means we expect
                // success.
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                void celebrate({
                  intensity: 'medium',
                  origin: {
                    x: (r.left + r.width / 2) / window.innerWidth,
                    y: (r.top + r.height / 2) / window.innerHeight,
                  },
                });
              }}
              className={`${reward.imageUrl ? 'w-full' : ''} font-bold rounded-full py-1.5 px-3 text-xs transition shadow-cta-pink ${
                disabled
                  ? 'bg-ink-faded text-card opacity-60 cursor-not-allowed shadow-none'
                  : 'bg-pink text-card hover:-translate-y-px active:translate-y-0'
              }`}
            >
              {pending
                ? t.redeem.redeeming
                : state?.ok === true
                  ? t.redeem.redeemedTitle
                  : t.redeem.redeem}
            </button>
          </form>
        </div>
        {statusLine && (
          <p
            className={`text-[11px] leading-snug ${
              statusLine.tone === 'pink' ? 'text-pink-dark' : 'text-ink-soft'
            }`}
          >
            {statusLine.text}
          </p>
        )}
      </div>
    </li>
  );
}
