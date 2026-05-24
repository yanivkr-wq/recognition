/**
 * Apple touch icon (iOS "Add to Home Screen").
 *
 * iOS specifically looks for /apple-icon at 180x180. Without this file,
 * iOS falls back to a screenshot of the page — usually not pretty.
 *
 * iOS also ignores `maskable` purpose and the `borderRadius` we put on
 * the inner div: iOS auto-rounds the corners of whatever it gets. So
 * the design here is intentionally full-bleed.
 */

import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          color: '#E94B7F',
          fontSize: 130,
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
