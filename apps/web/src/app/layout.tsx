/**
 * Root layout.
 *
 * Wraps every Reco page. Reads the locale propagated from middleware via the
 * x-reco-locale header to set <html lang dir> server-side (no client flash).
 * Loads the three brandbook fonts (Heebo + Fredoka + Quicksand) via
 * next/font/google as CSS variables that globals.css references.
 */

import type { Metadata, Viewport } from 'next';
import { Heebo, Fredoka, Quicksand } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { getDirection, type Locale } from '@reco/shared/i18n';
import { ACTIVE_THEME_COOKIE } from '../lib/admin-theme/constants';
import { asTheme, DEFAULT_THEME, themeStatusBar } from '../lib/theme';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Trophy',
  description: 'Trophy — kids earn coins for everyday wins.',
  // Hints for "Add to Home Screen". The manifest, icons, and apple-icon
  // are auto-discovered by Next.js from app/manifest.ts, icon*.tsx, and
  // apple-icon.tsx — we don't need to list them here.
  applicationName: 'Trophy',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trophy',
  },
  formatDetection: {
    telephone: false,
  },
};

/**
 * Dynamic viewport — reads ACTIVE_THEME_COOKIE so the SSR <meta theme-color>
 * matches whatever theme will paint the chrome on this request. Critical for
 * iOS PWA, which reads theme-color exactly once at page load and ignores any
 * later JS updates; if SSR ships the bubblegum default for an ocean session,
 * the OS notification bar gets a residual pink tint Lily saw at the top edge.
 *
 * Both setAdminThemeAction and setKidThemeAction write this cookie when the
 * theme changes, so any subsequent SSR — including the cold-launch one — gets
 * the right value here without any DB hit. `viewport-fit: cover` is paired in
 * because the kid pages rely on env(safe-area-inset-top) padding.
 */
export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies();
  const themeId = asTheme(jar.get(ACTIVE_THEME_COOKIE)?.value);
  return {
    themeColor: themeStatusBar(themeId),
    viewportFit: 'cover',
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const locale = (h.get('x-reco-locale') ?? 'he') as Locale;
  const dir = getDirection(locale);

  // Pin `data-theme` to <html> at SSR time, before any client JS or :has()
  // cascade has a chance to run. iOS PWA paints the safe-area-inset region
  // from the html element's background colour at first paint — if html
  // doesn't yet know it's "ocean", that strip paints in the bubblegum
  // cream (--bg fallback), which shows up against the dark-teal status
  // bar as a thin warm-pink line at the seam. Reading the active-theme
  // cookie here applies the right --bg to html immediately.
  const jar = await cookies();
  const themeId = asTheme(jar.get(ACTIVE_THEME_COOKIE)?.value ?? DEFAULT_THEME);

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={themeId}
      className={`${heebo.variable} ${fredoka.variable} ${quicksand.variable}`}
    >
      <body className="bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
