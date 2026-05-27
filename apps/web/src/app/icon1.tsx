/**
 * PWA standard 512x512 icon (Android / web manifest / iOS, + maskable).
 *
 * The approved TasKidz logo (inlined PNG data URL) on a white tile with a
 * generous safe-zone margin so a circular maskable crop never clips the mark.
 */

import { ImageResponse } from 'next/og';
import { TASKIDZ_LOGO_DATA_URL } from '../lib/brand/taskidz-logo-data';

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
          background: '#FFFFFF',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TASKIDZ_LOGO_DATA_URL} width={380} height={317} alt="TasKidz" />
      </div>
    ),
    { ...size },
  );
}
