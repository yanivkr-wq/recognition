/**
 * PWA standard 192x192 icon (Android / web manifest).
 *
 * The Trophy mark (pink-soft tile + dashed pink ring + yellow hex + white
 * trophy) rendered to PNG by Satori via an inlined SVG data URL. The static
 * SVG (no animation) lives in lib/brand/trophy-mark-svg.ts and is the source
 * of truth for everywhere a flat PNG is needed.
 */

import { ImageResponse } from 'next/og';
import { TROPHY_MARK_DATA_URL } from '../lib/brand/trophy-mark-svg';

export const size = { width: 192, height: 192 };
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
        <img src={TROPHY_MARK_DATA_URL} width={192} height={192} alt="Trophy" />
      </div>
    ),
    { ...size },
  );
}
