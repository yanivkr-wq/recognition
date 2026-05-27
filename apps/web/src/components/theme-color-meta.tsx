/**
 * Keeps the OS status-bar / PWA "notification header" color in sync with the
 * active app theme (Lily: "you forgot to apply the theme on the app's actual
 * notification header").
 *
 * The root layout ships a static <meta name="theme-color">; the per-player
 * theme is only known once we render the [lang] layout, so this tiny client
 * component rewrites (or creates) that meta tag to the theme's accent-dark
 * tone. Runs on mount and whenever the color prop changes.
 */

'use client';

import { useEffect } from 'react';

export function ThemeColorMeta({ color }: { color: string }) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  }, [color]);

  return null;
}
