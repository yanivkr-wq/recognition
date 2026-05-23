/**
 * Profile picker — the Netflix-style landing for kids + anonymous visitors.
 *
 * Public surface (middleware allows anonymous + kid; redirects authenticated
 * parents to /admin). Lists every non-archived kid in the household; each
 * card links to /[lang]/pick/<slug> for PIN entry. A small "Parent admin"
 * link at the bottom drops a parent over to /[lang]/login.
 *
 * Avatar art is a colored circle with the kid's first initial as a
 * placeholder — BRANDBOOK §4.1 specifies illustrated fox + bunny SVGs that
 * are sourced in Phase 9 polish.
 */

import Link from 'next/link';
import { isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable } from '@reco/db';
import { Avatar } from '../../../components/avatar';

export const dynamic = 'force-dynamic';

export default async function PickPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);

  const kids = await getDb()
    .select({
      id: kidTable.id,
      name: kidTable.name,
      slug: kidTable.slug,
      color: kidTable.color,
      avatarKey: kidTable.avatarKey,
    })
    .from(kidTable)
    .where(isNull(kidTable.archivedAt))
    .orderBy(kidTable.createdAt);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-bg p-4">
      <header className="text-center mb-10">
        <p
          className="text-5xl font-bold text-pink leading-none"
          style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          dir="ltr"
        >
          Reco
        </p>
        <h1 className="mt-6 text-3xl font-bold text-ink">{t.profilePicker.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t.profilePicker.subtitle}</p>
      </header>

      <div className="grid grid-cols-2 gap-5 max-w-md w-full">
        {kids.map((k) => (
          <Link
            key={k.id}
            href={`/${lang}/pick/${k.slug}`}
            className="flex flex-col items-center p-5 rounded-3xl bg-card shadow-card hover:-translate-y-1 active:translate-y-0 transition"
          >
            <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={96} />
            <p className="mt-3 text-base font-bold text-ink">{k.name}</p>
          </Link>
        ))}
      </div>

      <Link
        href={`/${lang}/login`}
        className="mt-12 text-sm text-ink-soft underline-offset-4 hover:underline transition"
      >
        {t.profilePicker.parentAdminLink}
      </Link>
    </main>
  );
}
