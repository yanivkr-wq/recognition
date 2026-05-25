/**
 * RecoMark — the app mark: the embroidered patch (BRANDBOOK §5) wrapping a
 * gold coin with a white crown. This is the chosen launcher identity
 * (Option 1, refined to an icon instead of a letter; emblem swapped from a
 * star to a crown per Lily's pick).
 *
 * Pure inline SVG, no hooks — safe in server + client components AND inside
 * Next's ImageResponse (the PWA icon routes render it). In a browser the
 * dashed ring shows its stitches; if a renderer (Satori) can't dash a stroke
 * it degrades to a solid ring, which is still on-brand.
 *
 * Colors are inlined hex (not CSS vars) so it renders identically wherever
 * it's used, including the icon PNGs where CSS variables don't resolve.
 */

interface Props {
  size?: number;
  /** Tile background. Defaults to pink-soft; pass a value for other surfaces. */
  bg?: string;
  title?: string;
}

export function RecoMark({ size = 96, bg = '#FFF0F6', title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Patch tile */}
      <rect x="2" y="2" width="96" height="96" rx="26" fill={bg} />
      {/* Stitched ring */}
      <circle
        cx="50"
        cy="50"
        r="34"
        fill="none"
        stroke="#FF6B9D"
        strokeWidth="3"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      {/* Coin */}
      <circle cx="50" cy="50" r="19" fill="#FFD75E" stroke="#E8B927" strokeWidth="3" />
      {/* White crown, centered in the coin (Lily's pick over the star) */}
      <path
        d="M38.5 57.5L41 43.5l6 6.5 3-9.5 3 9.5 6-6.5 2.5 14z"
        fill="#FFFFFF"
      />
      <rect x="40" y="58" width="20" height="3" rx="1.5" fill="#FFFFFF" />
    </svg>
  );
}
