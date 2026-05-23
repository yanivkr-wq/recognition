/**
 * Per-locale layout. Pre-renders both /he and /en at build time.
 *
 * Currently just passes children through — the root layout already handled
 * <html lang dir>. The seam exists for future per-locale providers (date
 * formatting, number formatting, kid-vs-admin context flag).
 */

import type { Locale } from '@reco/shared/i18n';

export async function generateStaticParams(): Promise<Array<{ lang: Locale }>> {
  return [{ lang: 'he' }, { lang: 'en' }];
}

export default function LangLayout({ children }: { children: React.ReactNode }) {
  return children;
}
