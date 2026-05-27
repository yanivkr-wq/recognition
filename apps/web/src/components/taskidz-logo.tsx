/**
 * TasKidzLogo — the approved TasKidz mark (monogram + wordmark), rendered from
 * the exact asset (/taskidz-logo.svg, which embeds the approved PNG so the
 * design is pixel-faithful).
 *
 * The asset's gold gift badge is baked into the raster, so when `animated` is
 * set we overlay a vector RewardHex exactly over it — that makes the gold icon
 * cycle through the seven rewards while the rest of the logo stays the exact
 * approved artwork. The overlay is positioned as a % of the logo box (constants
 * below) so it scales with any height; nudge GIFT_* if it drifts.
 *
 * `height` drives the size; width follows the asset's 289:241 ratio.
 */

'use client';

import { RewardHex } from './reward-hex';

const ASPECT = 289 / 241; // width / height of the asset
// Gift-badge placement within the logo box, as fractions (center + size).
const GIFT_CX = 0.735;
const GIFT_CY = 0.149;
const GIFT_W = 0.2; // a touch larger than the baked badge so it fully covers it

export function TasKidzLogo({
  height = 44,
  animated = false,
  className,
}: {
  height?: number;
  animated?: boolean;
  className?: string;
}) {
  const width = Math.round(height * ASPECT);
  const hexSize = Math.round(width * GIFT_W);

  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-block', width, height, lineHeight: 0 }}
      role="img"
      aria-label="TasKidz"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/taskidz-logo.svg"
        alt="TasKidz"
        width={width}
        height={height}
        style={{ display: 'block', width, height }}
      />
      {animated && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${GIFT_CX * 100}%`,
            top: `${GIFT_CY * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <RewardHex size={hexSize} />
        </span>
      )}
    </span>
  );
}
