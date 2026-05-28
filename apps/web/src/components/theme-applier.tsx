/**
 * ThemeApplier — pins the active theme to <html> so it survives soft navs.
 *
 * Why this exists:
 *   The [lang] layout sets `data-theme` on a `<div className="contents">`
 *   wrapper. That works for SSR / refresh, but Next's segment cache can
 *   re-serve a prefetched RSC where the admin theme cookie hadn't been read
 *   yet — and the `<div data-theme>` snaps back to the default (bubblegum)
 *   on soft nav. The OS status-bar `<meta name="theme-color">` rides along
 *   for the same reason.
 *
 *   Mirroring both to `<html>` from a client effect fixes it: the document
 *   element is never unmounted by the router, so once the effect has run
 *   the attribute (and meta) persist across every soft nav until the next
 *   theme change or a hard refresh — which re-runs SSR + this effect with
 *   the new value anyway.
 *
 * Replaces the older ThemeColorMeta (which only handled the status-bar meta
 * and was bitten by the same cache-staleness for visual chrome).
 */

'use client';

import { useEffect } from 'react';

interface Props {
  /** 'bubblegum' | 'ocean' | 'sunset' — the active theme id. */
  themeId: string;
  /** Hex color for the OS / PWA status bar that matches the theme. */
  statusBarColor: string;
}

export function ThemeApplier({ themeId, statusBarColor }: Props) {
  useEffect(() => {
    // 1) data-theme on <html> — beats any stale data-theme on a deeper
    //    wrapper because every CSS rule reads var(--*) from the closest
    //    ancestor with a matching [data-theme="…"] rule, and <html> is the
    //    outermost element with one.
    document.documentElement.setAttribute('data-theme', themeId);

    // 2) <meta name="theme-color"> — drives the OS / PWA status-bar tint.
    //    The root layout ships a static bubblegum-pink meta as a default;
    //    we overwrite it (and create the node if a build pipeline ever
    //    strips it) so the tint follows the live theme.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', statusBarColor);
  }, [themeId, statusBarColor]);

  return null;
}
