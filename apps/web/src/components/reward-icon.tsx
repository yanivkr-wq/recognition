/**
 * Reward icon — pastel tile + inline SVG glyph (Phase-7-polish, Lily's Fix 5).
 *
 * Mirrors TaskIcon: looks up `iconKey` in `icon-library.tsx` (the `rw-*`
 * family); falls back to the initial letter for unknown keys. Same tile
 * pattern as before so the shop grid layout is unchanged.
 */

import { getIcon } from './icon-library';

interface Props {
  iconKey: string;
  color: string;
  title: string;
  size?: number;
}

export function RewardIcon({ iconKey, color, title, size = 56 }: Props) {
  const entry = getIcon(iconKey);
  const glyphSize = Math.round(size * 0.55);
  return (
    <div
      className="rounded-2xl flex items-center justify-center shrink-0 text-ink"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      aria-hidden="true"
    >
      {entry ? (
        <entry.Component size={glyphSize} />
      ) : (
        <span
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heebo), system-ui, sans-serif' }}
        >
          {title.trim().charAt(0) || '★'}
        </span>
      )}
    </div>
  );
}
