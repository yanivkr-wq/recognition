/**
 * PWA standard 192x192 icon (Android / web manifest).
 *
 * Generated via ImageResponse so we don't ship binary PNGs. Design: the
 * RecoMark — embroidered patch + gold coin (BRANDBOOK §5), replacing the
 * old letter "R". Full-bleed pink-soft tile so Android's maskable circle /
 * iOS rounding never clips the mark.
 */

import { ImageResponse } from 'next/og';
import { RecoMark } from '../components/reco-mark';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <RecoMark size={192} />
      </div>
    ),
    { ...size },
  );
}
