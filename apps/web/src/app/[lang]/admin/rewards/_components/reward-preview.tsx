/**
 * Admin · kid-eye reward preview tile.
 *
 * Renders a static (non-interactive) tile that matches the real reward
 * tile a kid sees in the shop (see apps/web/src/app/[lang]/redeem/_components/
 * reward-tile.tsx) — same color, icon, title, description, coin chip,
 * redeem-button glyph. Updates live as the admin edits the form so they
 * see what the kid will see before saving.
 *
 * Image preview is included when an image URL is supplied (admin uploaded
 * a photo via RewardImagePicker). When no image is set, the pastel-tile +
 * icon variant renders, matching the shop's fallback rendering.
 */

'use client';

import type { Dictionary } from '@reco/shared/i18n';
import { RewardIcon } from '../../../../../components/reward-icon';
import { Coin } from '../../../../../components/coin';

interface Props {
  titleHe: string;
  titleEn: string;
  descriptionHe: string;
  descriptionEn: string;
  iconKey: string;
  color: string;
  coinCost: number;
  imageUrl: string | null;
  lang: 'he' | 'en';
  t: Dictionary;
}

export function RewardPreview({
  titleHe,
  titleEn,
  descriptionHe,
  descriptionEn,
  iconKey,
  color,
  coinCost,
  imageUrl,
  lang,
  t,
}: Props) {
  const title = (lang === 'he' ? titleHe : titleEn).trim() || (lang === 'he' ? '(ללא כותרת)' : '(no title)');
  const description = (lang === 'he' ? descriptionHe : descriptionEn).trim();
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#FFF0F6';

  return (
    <div className="bg-bg rounded-2xl border border-rule p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-bold text-ink text-sm">{t.admin.rewardPreviewHeading}</p>
        <span className="text-[10px] uppercase tracking-wider text-ink-faded">
          {t.admin.rewardPreviewKidEye}
        </span>
      </div>

      {/* The actual tile — same DOM grammar as reward-tile.tsx but no button
          state. Wrapped in a centered narrow column to look like one card
          in the shop grid rather than a full-width form section. */}
      <div className="max-w-[180px] mx-auto">
        <div className="bg-card rounded-2xl border border-rule shadow-card flex flex-col overflow-hidden">
          {imageUrl ? (
            <div className="relative aspect-square w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <span className="absolute top-2 end-2 inline-flex items-center gap-1 bg-card/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold text-ink num shadow-card">
                <Coin size={14} />
                <span dir="ltr">{coinCost}</span>
              </span>
            </div>
          ) : (
            <div
              className="rounded-t-2xl p-4 flex items-center justify-center"
              style={{ backgroundColor: safeColor }}
            >
              <RewardIcon iconKey={iconKey} color={safeColor} title={title} />
            </div>
          )}
          <div className="p-3 flex flex-col gap-2 grow">
            <h3 className="font-bold text-ink text-sm leading-tight truncate">
              {title}
            </h3>
            {description && (
              <p className="text-[11px] text-ink-soft leading-snug line-clamp-2">
                {description}
              </p>
            )}
            <div className="mt-auto flex items-center justify-between gap-2">
              {!imageUrl && (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-ink num">
                  <Coin size={16} />
                  <span dir="ltr">{coinCost}</span>
                </span>
              )}
              {/* Static "redeem" pill — matches the live button visual */}
              <span
                className={`${imageUrl ? 'w-full text-center' : ''} bg-pink text-card font-bold rounded-full py-1.5 px-3 text-xs shadow-cta-pink`}
              >
                {t.redeem.redeem}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
