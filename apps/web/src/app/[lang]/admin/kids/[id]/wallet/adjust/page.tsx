/**
 * Admin · joker wallet adjustment page (per kid).
 *
 * Server fetches the kid's name + current display balance so the form
 * shows the right context ("Lia: 12 coins"). The form itself is a client
 * component because the credit/debit toggle is interactive (changes the
 * sign on the amount input) + we surface the action state inline.
 */

import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, getPool, kid as kidTable } from '@reco/db';
import { auth } from '../../../../../../../auth';
import { JokerForm } from './_components/joker-form';

export const dynamic = 'force-dynamic';

export default async function JokerPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const db = getDb();
  const kRows = await db
    .select({
      id: kidTable.id,
      name: kidTable.name,
      color: kidTable.color,
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
  const k = kRows[0];
  if (!k) redirect(`/${lang}/admin/kids`);

  const balanceRes = await getPool().query<{ balance: string | null }>(
    `SELECT GREATEST(0, COALESCE(SUM(amount), 0))::text AS balance
       FROM ledger_entry WHERE kid_id = $1`,
    [id],
  );
  const balance = Number(balanceRes.rows[0]?.balance ?? 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">
        {t.admin.jokerHeading} — {k.name}
      </h1>
      <p className="text-sm text-ink-soft max-w-xl">{t.admin.jokerIntro}</p>
      <JokerForm
        kidId={k.id}
        kidName={k.name}
        kidColor={k.color}
        balance={balance}
        lang={lang as 'he' | 'en'}
        t={t}
      />
    </div>
  );
}
