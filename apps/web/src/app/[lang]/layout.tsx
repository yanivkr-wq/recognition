/**
 * Per-locale layout. Pre-renders both /he and /en at build time.
 *
 * Renders the floating feedback button on every AUTHENTICATED surface: the
 * middleware sets x-reco-principal ('kid' | 'admin') on those requests and
 * leaves it absent on the public login/pick pages, so reading that header is
 * the gate. The seam also stays open for future per-locale providers.
 */

import { headers } from 'next/headers';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { FeedbackButton } from '../../components/feedback-button';

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

  return (
    <>
      {children}
      {authed && <FeedbackButton t={t} />}
    </>
  );
}
