/**
 * Per-kid PIN entry. Lands here from /[lang]/pick after a kid card tap.
 *
 * Server-renders the kid's avatar + name; the keypad + submit logic lives in
 * the client component so we can buffer digits + animate without round-trips.
 * If the URL slug doesn't match any kid (typo / archived kid), redirect back
 * to /[lang]/pick so the kid lands on a known surface.
 */

import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable } from '@reco/db';
import { PinEntryForm } from './pin-entry-form';

export const dynamic = 'force-dynamic';

export default async function PinEntryPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const t = getDictionary(lang as Locale);

  const rows = await getDb()
    .select({
      id: kidTable.id,
      name: kidTable.name,
      slug: kidTable.slug,
      color: kidTable.color,
    })
    .from(kidTable)
    .where(and(eq(kidTable.slug, slug), isNull(kidTable.archivedAt)))
    .limit(1);
  const k = rows[0];
  if (!k) redirect(`/${lang}/pick`);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-bg p-4">
      <header className="text-center mb-8">
        <div
          className="w-24 h-24 mx-auto rounded-full flex items-center justify-center"
          style={{ backgroundColor: k.color }}
          aria-hidden="true"
        >
          <span
            className="text-5xl font-bold text-card"
            style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          >
            {k.name.charAt(0)}
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink">{k.name}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t.pin.enterPin}</p>
      </header>

      <PinEntryForm kidId={k.id} kidName={k.name} lang={lang} t={t} />
    </main>
  );
}
