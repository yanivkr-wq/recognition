/**
 * PWA standard 192x192 icon (Android / web manifest).
 *
 * Generated via ImageResponse so we don't ship binary PNGs in the repo.
 * Design: cream background, big pink "R" in the brandbook display font
 * (Fredoka loads via Google Fonts; ImageResponse handles fallback if
 * the font doesn't resolve at build time).
 */

import { ImageResponse } from 'next/og';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-html-link-for-pages
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
          fontSize: 140,
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
