/**
 * Avatar pip — renders the kid's chosen preset face on a circle filled
 * with their `kid.color` (Lily's Fix 11). Falls back to the initial-letter
 * pattern when no avatar key is set, so unmodified seed rows keep their
 * existing look until the kid edits.
 *
 * Used in every kid page header + the bottom-nav (eventually). The size
 * prop drives the circle diameter; the inner glyph scales proportionally.
 */

import { getAvatar } from './avatar-library';

interface Props {
  name: string;
  color: string;
  avatarKey: string | null | undefined;
  size?: number;
}

export function Avatar({ name, color, avatarKey, size = 48 }: Props) {
  const entry = getAvatar(avatarKey ?? null);
  const glyphSize = Math.round(size * 0.86);
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden text-ink"
      style={{ width: size, height: size, backgroundColor: color }}
      aria-hidden="true"
    >
      {entry ? (
        <entry.Component size={glyphSize} />
      ) : (
        <span
          className="font-bold text-card"
          style={{
            fontFamily: 'var(--font-fredoka), system-ui, sans-serif',
            fontSize: Math.round(size * 0.5),
            lineHeight: 1,
          }}
        >
          {name.trim().charAt(0) || '★'}
        </span>
      )}
    </div>
  );
}
