/**
 * Apple touch icon (iOS "Add to Home Screen") — 180x180.
 *
 * The approved TasKidz logo (inlined PNG data URL) on a white tile; iOS rounds
 * the corners, and the padding keeps the mark clear of the rounding.
 */

import { ImageResponse } from 'next/og';
import { TASKIDZ_LOGO_DATA_URL } from '../lib/brand/taskidz-logo-data';

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
          background: '#FFFFFF',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TASKIDZ_LOGO_DATA_URL} width={158} height={132} alt="TasKidz" />
      </div>
    ),
    { ...size },
  );
}
