/**
 * Coin glyph — Reco's most-repeated UI element.
 *
 * Per BRANDBOOK §6.8 the coin glyph crosses icon-family boundaries and shows
 * up wherever a balance / reward / cost is displayed. The canonical
 * `<symbol id="ic-coin">` will land alongside the rest of the SVG library in
 * Phase 9; for now this inline render gives us the right gold/yellow tokens
 * and tabular spacing without depending on an external sprite.
 */

import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
}

export function Coin({ size = 18, className, style, ariaHidden = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden={ariaHidden}
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="14" fill="var(--yellow)" />
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--yellow-dark)" strokeWidth="2" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="var(--yellow-dark)" strokeWidth="1.3" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill="var(--yellow-dark)"
        fontFamily="var(--font-heebo), system-ui, sans-serif"
      >
        ¢
      </text>
    </svg>
  );
}
