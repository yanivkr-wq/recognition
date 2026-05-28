/**
 * Apple touch icon (iOS "Add to Home Screen") — 180x180.
 *
 * The Trophy mark, full-bleed at 180×180. iOS applies its own corner rounding
 * to whatever PNG it gets, so the SVG's rounded-square tile is what produces
 * the visible badge on the Home Screen.
 */

import { ImageResponse } from 'next/og';
import { TROPHY_MARK_DATA_URL } from '../lib/brand/trophy-mark-svg';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        <img src={TROPHY_MARK_DATA_URL} width={180} height={180} alt="Trophy" />
      </div>
    ),
    { ...size },
  );
}
