/**
 * PWA standard 192x192 icon (Android / web manifest).
 *
 * Generated via ImageResponse from the approved TasKidz logo (inlined as a PNG
 * data URL so Satori can render it without a network fetch). White full-bleed
 * tile with padding so Android's maskable circle / iOS rounding never clips
 * the mark.
 */

import { ImageResponse } from 'next/og';
import { TASKIDZ_LOGO_DATA_URL } from '../lib/brand/taskidz-logo-data';

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
          background: '#FFFFFF',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TASKIDZ_LOGO_DATA_URL} width={168} height={140} alt="TasKidz" />
      </div>
    ),
    { ...size },
  );
}
