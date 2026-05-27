/**
 * Root layout.
 *
 * Wraps every Reco page. Reads the locale propagated from middleware via the
 * x-reco-locale header to set <html lang dir> server-side (no client flash).
 * Loads the three brandbook fonts (Heebo + Fredoka + Quicksand) via
 * next/font/google as CSS variables that globals.css references.
 */

import type { Metadata } from 'next';
import { Heebo, Fredoka, Quicksand } from 'next/font/google';
import { headers } from 'next/headers';
import { getDirection, type Locale } from '@reco/shared/i18n';
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
  title: 'TasKidz',
  description: 'TasKidz — kids earn coins for everyday wins.',
  // Hints for "Add to Home Screen". The manifest, icons, and apple-icon
  // are auto-discovered by Next.js from app/manifest.ts, icon*.tsx, and
  // apple-icon.tsx — we don't need to list them here.
  applicationName: 'TasKidz',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TasKidz',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  // Pink-dark tint on the OS status bar when launched as PWA.
  themeColor: '#E94B7F',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const locale = (h.get('x-reco-locale') ?? 'he') as Locale;
  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${heebo.variable} ${fredoka.variable} ${quicksand.variable}`}
    >
      <body className="bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
