/**
 * Admin · edit a kid's identity (name, accent color, birthday).
 *
 * Parent-only via middleware. Loads the kid and hands the editable fields to
 * the client form. The avatar face itself stays kid-owned (the /[lang]/avatar
 * page); this page covers the bits a parent legitimately manages.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable } from '@reco/db';
import { auth } from '../../../../../../auth';
import { arrowBack } from '../../../../../../lib/rtl';
import { EditKidForm } from './edit-kid-form';

export const dynamic = 'force-dynamic';

export default async function EditKidPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const rows = await getDb()
    .select({
      id: kidTable.id,
      name: kidTable.name,
      color: kidTable.color,
      birthdate: kidTable.birthdate,
      avatarKey: kidTable.avatarKey,
    })
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
    <div className="space-y-6">
      <Link
        href={`/${lang}/admin/kids`}
        className="text-sm text-ink-soft underline-offset-4 hover:underline"
      >
        {arrowBack(lang as 'he' | 'en')} {t.admin.kids}
      </Link>
      <h1 className="text-2xl font-bold text-ink">{t.admin.editKid}</h1>

      <EditKidForm
        kidId={k.id}
        lang={lang as 'he' | 'en'}
        t={t}
        initialName={k.name}
        initialColor={k.color}
        initialBirthday={k.birthdate}
        avatarKey={k.avatarKey}
      />
    </div>
  );
}
