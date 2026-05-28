/**
 * Parent login page (server component).
 *
 * Renders the brandbook-styled login card and delegates the form interaction
 * to ./login-form (client component) so the page stays a server component
 * with no client JS for the static parts.
 */

import { getDictionary, type Locale } from '@reco/shared/i18n';
import { LoginForm } from './login-form';
import { TrophyMark } from '../../../components/trophy-mark';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg p-4">
      <section className="w-full max-w-sm bg-card rounded-3xl shadow-card p-8">
        <header className="text-center mb-8">
          <div className="flex justify-center leading-none">
            <TrophyMark size={104} />
          </div>
          <p className="mt-3 text-sm text-ink-soft">{t.auth.parentLogin}</p>
        </header>

        <LoginForm lang={lang} t={t} />
      </section>
    </main>
  );
}
