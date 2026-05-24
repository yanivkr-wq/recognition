/**
 * Apple touch icon (iOS "Add to Home Screen") — 180x180.
 *
 * iOS auto-rounds the corners of whatever it gets, so the RecoMark's
 * full-bleed pink-soft tile is intentional. Without this file iOS falls back
 * to a page screenshot.
 */

import { ImageResponse } from 'next/og';
import { RecoMark } from '../components/reco-mark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <RecoMark size={180} />
      </div>
    ),
    { ...size },
  );
}
