/**
 * TrophyMark — the in-app brand badge (replaces the older TasKidzLogo).
 *
 * Three layers:
 *   1. Pink-soft circle fill — themed via `var(--pink-soft)`, so it adopts the
 *      active app theme (bubblegum, ocean, sunset).
 *   2. Dashed stitched ring — themed via `var(--pink)`, matches the
 *      embroidered-patch badge family in BRANDBOOK §5.
 *   3. Yellow hexagon containing the RewardHex animated emblem cycle (gift /
 *      star / trophy / crown / medal / heart / gem). The hex itself stays gold
 *      and the emblems stay white at every theme — they're brand-constant,
 *      since yellow = currency and white reads on yellow regardless of theme.
 *
 * No wordmark. The badge IS the mark. Sized by the `size` prop (px); pass
 * `animated={false}` to hold on the trophy emblem (useful for static contexts
 * where the cycle would distract, e.g. embedded inside a screenshot).
 */

'use client';

import { RewardHex } from './reward-hex';

interface Props {
  /** Outer size in px. The full badge fits within this square. */
  size?: number;
  /** Cycle through the 7 emblems (default). When false, holds on the trophy. */
  animated?: boolean;
  className?: string;
}

export function TrophyMark({ size = 44, animated = true, className }: Props) {
  // Inner RewardHex sits at ~62% of the outer size so it nests INSIDE the
  // dashed ring without touching it. The ring sits at r=38/100 = ~76% of the
  // outer radius, so the hex (which inscribes at ~r=36/50 ≈ 0.72 of its own
  // size) leaves a comfortable pink-soft margin between hex and ring.
  const innerSize = Math.round(size * 0.62);

  return (
    <span
      className={className}
      role="img"
      aria-label="Trophy"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        lineHeight: 0,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ display: 'block', position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        {/* Pink-soft fill — themed. */}
        <circle cx="50" cy="50" r="50" fill="var(--pink-soft)" />
        {/* Dashed pink ring — themed. */}
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="var(--pink)"
          strokeWidth="3.3"
          strokeDasharray="4 3.3"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <RewardHex size={innerSize} animated={animated} />
      </span>
    </span>
  );
}
