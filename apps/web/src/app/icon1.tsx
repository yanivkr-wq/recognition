/**
 * PWA standard 512x512 icon (Android / web manifest / iOS, + maskable).
 *
 * The Trophy mark, full-bleed at 512×512. The SVG already includes the
 * pink-soft rounded-square tile, so it survives Android's circular maskable
 * crop and iOS rounding without clipping the dashed ring or yellow hex.
 */

import { ImageResponse } from 'next/og';
import { TROPHY_MARK_DATA_URL } from '../lib/brand/trophy-mark-svg';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFF0F6',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TROPHY_MARK_DATA_URL} width={512} height={512} alt="Trophy" />
      </div>
    ),
    { ...size },
  );
}
