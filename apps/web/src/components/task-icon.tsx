/**
 * Task icon — pastel tile + inline SVG glyph (Phase-7-polish, Lily's Fix 1).
 *
 * If `iconKey` matches an entry in `icon-library.tsx` (the `ic-*` family),
 * we render the SVG centered on the colored tile. Otherwise we fall back
 * to the initial-letter pattern that's been in place since Phase 3 — so
 * existing templates with unknown keys still render gracefully.
 */

import { getIcon } from './icon-library';

interface Props {
  iconKey: string;
  color: string;
  title: string;
  size?: number;
}

export function TaskIcon({ iconKey, color, title, size = 40 }: Props) {
  const entry = getIcon(iconKey);
  const glyphSize = Math.round(size * 0.6);
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
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-heebo), system-ui, sans-serif' }}
        >
          {title.trim().charAt(0) || '★'}
        </span>
      )}
    </div>
  );
}
