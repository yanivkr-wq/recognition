/**
 * Per-locale layout. Pre-renders both /he and /en at build time.
 *
 * Renders the floating feedback button on every AUTHENTICATED surface: the
 * middleware sets x-reco-principal ('kid' | 'admin') on those requests and
 * leaves it absent on the public login/pick pages, so reading that header is
 * the gate. The seam also stays open for future per-locale providers.
 */

import { cookies, headers } from 'next/headers';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { FeedbackButton } from '../../components/feedback-button';
import { SplashIntro } from '../../components/splash-intro';
import { requireKid } from '../../lib/auth/guards';
import { ADMIN_THEME_COOKIE } from '../../lib/admin-theme/actions';
import { asTheme, DEFAULT_THEME, themeStatusBar, type ThemeId } from '../../lib/theme';
import { ThemeColorMeta } from '../../components/theme-color-meta';

export async function generateStaticParams(): Promise<Array<{ lang: Locale }>> {
  return [{ lang: 'he' }, { lang: 'en' }];
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const hdrs = await headers();
  const principal = hdrs.get('x-reco-principal');
  const authed = principal === 'kid' || principal === 'admin';

  // Player surfaces adopt the player's chosen app-wide theme (DB-backed on the
  // kid row, so it follows them across devices). Admin surfaces adopt the
  // admin theme cookie if set, per-device — both parents share one admin login
  // and a device-level preference is the natural granularity. Public surfaces
  // stay on the default (bubblegum). The `contents` wrapper produces no box
  // of its own, so it changes nothing about layout — it only scopes the
  // theme's CSS-variable overrides (see globals.css) down to the relevant tree.
  let theme: ThemeId = DEFAULT_THEME;
  if (principal === 'kid') {
    try {
      const k = await requireKid();
      theme = asTheme(k.theme);
    } catch {
      // Fall back to the default theme if the kid session can't be resolved.
    }
  } else if (principal === 'admin') {
    const adminTheme = (await cookies()).get(ADMIN_THEME_COOKIE)?.value;
    if (adminTheme) theme = asTheme(adminTheme);
  }

  return (
    <div className="contents" data-theme={theme}>
      <ThemeColorMeta color={themeStatusBar(theme)} />
      <SplashIntro />
      {children}
      {authed && <FeedbackButton t={t} />}
    </div>
  );
}
