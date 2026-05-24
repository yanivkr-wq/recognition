/**
 * RecoMark — the app mark: the embroidered patch (BRANDBOOK §5) wrapping a
 * gold coin with a white star. This is the chosen launcher identity
 * (Option 1, refined to an icon instead of a letter).
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
      {/* White star, centered in the coin */}
      <g transform="translate(50 50) scale(0.62) translate(-12 -11.7)">
        <path
          d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 18.9 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}
