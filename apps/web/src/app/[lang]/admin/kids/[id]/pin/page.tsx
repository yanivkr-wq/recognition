/**
 * Set / reset a kid's PIN.
 *
 * Server-renders the form (parent-only via middleware). The form posts back
 * through the co-located server action which hashes with Argon2id, UPDATEs
 * the row, clears any failed-attempt counter / lockout, and appends an
 * audit_log entry. Success surfaces a "PIN set" flash and links back to the
 * kids list.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable } from '@reco/db';
import { auth } from '../../../../../../auth';
import { SetPinForm } from './set-pin-form';

export const dynamic = 'force-dynamic';

export default async function SetPinPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { lang, id } = await params;
  const { ok } = await searchParams;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const rows = await getDb()
    .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
    .from(kidTable)
    .where(
      and(
        eq(kidTable.id, id),
        eq(kidTable.householdId, session.user.householdId),
        isNull(kidTable.archivedAt),
      ),
    )
    .limit(1);
  const k = rows[0];
  if (!k) redirect(`/${lang}/admin/kids`);

  return (
    <div className="max-w-md space-y-6">
      <nav className="text-xs text-ink-soft">
        <Link href={`/${lang}/admin/kids`} className="hover:underline">
          {t.admin.kids}
        </Link>
        <span className="mx-2">·</span>
        <span className="text-ink">{k.name}</span>
      </nav>

      <header className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: k.color }}
          aria-hidden="true"
        >
          <span
            className="text-2xl font-bold text-card"
            style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          >
            {k.name.charAt(0)}
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">{t.admin.setPin}</h1>
          <p className="text-sm text-ink-soft">{k.name}</p>
        </div>
      </header>

      {ok === '1' && (
        <p
          role="status"
          className="text-sm text-mint-dark bg-mint-pale rounded-xl px-4 py-3"
        >
          {t.admin.pinSet}
        </p>
      )}

      <SetPinForm kidId={k.id} lang={lang} t={t} />
    </div>
  );
}
