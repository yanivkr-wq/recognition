/**
 * PWA standard 512x512 icon (Android / web manifest / iOS).
 *
 * Same design as icon0 but at the largest standard PWA size. iOS and
 * splash screens prefer this size on hi-DPI displays.
 */

import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FAF8F5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '24%',
          color: '#E94B7F',
          fontSize: 380,
          fontWeight: 800,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          letterSpacing: '-0.04em',
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
