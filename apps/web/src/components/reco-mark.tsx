/**
 * RecoMark — the app mark: the embroidered patch (BRANDBOOK §5) wrapping a
 * gold coin with a white heart. This is the chosen launcher identity
 * (Option 1, refined to an icon instead of a letter; emblem swapped from a
 * star to a heart per Lily's pick).
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
      {/* White heart, centered in the coin (Lily's pick over the star) */}
      <g transform="translate(50 50) scale(0.62) translate(-12 -11.2)">
        <path
          d="M12 21S2.6 14.5 2.6 8.6c0-3 2.4-5.1 5-5.1 1.9 0 3.4 1.1 4.4 2.6 1-1.5 2.5-2.6 4.4-2.6 2.6 0 5 2.1 5 5.1C21.4 14.5 12 21 12 21z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}
