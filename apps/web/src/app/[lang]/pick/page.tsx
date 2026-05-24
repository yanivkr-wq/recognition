/**
 * Profile picker — the "who's playing?" landing for kids + anonymous visitors.
 *
 * Public surface (middleware allows anonymous + kid; redirects authenticated
 * parents to /admin). Lists every non-archived kid; each card links to
 * /[lang]/pick/<slug> for PIN entry. A small parent-admin link drops a parent
 * to /[lang]/login.
 *
 * Revamped to the Plush brand: RecoMark + wordmark header on the warm cream
 * background, each kid in a soft tile tinted to her own color (peach = Lia,
 * sky = Yael) with a colored avatar ring. Mobile-first, big tap targets.
 */

import Link from 'next/link';
import { isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable } from '@reco/db';
import { Avatar } from '../../../components/avatar';
import { RecoMark } from '../../../components/reco-mark';

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
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-bg px-5 py-10"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(45,42,74,0.045) 1px, transparent 0)',
        backgroundSize: '22px 22px',
      }}
    >
      <header className="flex flex-col items-center text-center mb-9">
        <div className="motion-safe:animate-[recoPickPop_.5s_cubic-bezier(.34,1.56,.64,1)]">
          <RecoMark size={88} />
        </div>
        <p
          className="mt-4 text-4xl font-bold text-pink leading-none"
          style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          dir="ltr"
        >
          Reco
        </p>
        <h1 className="mt-5 text-3xl font-bold text-ink">{t.profilePicker.title}</h1>
        <p className="mt-1.5 text-sm text-ink-soft">{t.profilePicker.subtitle}</p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:gap-5 max-w-md w-full">
        {kids.map((k) => (
          <Link
            key={k.id}
            href={`/${lang}/pick/${k.slug}`}
            className="group flex flex-col items-center gap-3 p-6 rounded-3xl bg-card border shadow-card hover:-translate-y-1 active:translate-y-0 transition"
            style={{ borderColor: k.color + '40' }}
          >
            {/* Soft colored ring around the avatar in the kid's color */}
            <span
              className="rounded-full p-1.5 transition group-hover:scale-105"
              style={{ backgroundColor: k.color + '24' }}
            >
              <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={88} />
            </span>
            <p className="text-lg font-bold text-ink">{k.name}</p>
          </Link>
        ))}
      </div>

      <Link
        href={`/${lang}/login`}
        className="mt-11 text-sm text-ink-soft underline-offset-4 hover:underline transition"
      >
        {t.profilePicker.parentAdminLink}
      </Link>

      <style>{`@keyframes recoPickPop { 0% { transform: scale(.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </main>
  );
}
