/**
 * PWA standard 512x512 icon (Android / web manifest / iOS, + maskable).
 *
 * Same RecoMark as icon0 at the largest standard size. The full-bleed
 * pink-soft tile satisfies the maskable safe-zone (the mark sits well inside
 * the center, so a circular mask won't clip the coin or stitched ring).
 */

import { ImageResponse } from 'next/og';
import { RecoMark } from '../components/reco-mark';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <RecoMark size={512} />
      </div>
    ),
    { ...size },
  );
}
