/**
 * Kid · avatar picker (Lily's Fix 11 — preset bank).
 *
 * Server fetches the kid + their current avatar key, hands off to the
 * client picker. Selecting a face POSTs `setKidAvatarAction` and
 * revalidates the kid surface so every header swaps to the new face.
 *
 * Full editor with hair/glasses/hat parts is intentionally deferred to a
 * later phase (see todo list); the preset bank covers v1's needs.
 */

import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, kid as kidTable } from '@reco/db';
import { requireKid, UnauthorizedError } from '../../../lib/auth/guards';
import { AvatarPickerView } from './_components/avatar-picker';

export const dynamic = 'force-dynamic';

export default async function AvatarPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  let principal;
  try {
    principal = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect(`/${lang}/pick`);
    throw err;
  }
  // Refresh kid from DB to make sure we have the latest avatar key (the
  // principal cache is fine but this is the editing surface — read direct).
  const rows = await getDb()
    .select({
      name: kidTable.name,
      color: kidTable.color,
      avatarKey: kidTable.avatarKey,
      theme: kidTable.theme,
    })
    .from(kidTable)
    .where(and(eq(kidTable.id, principal.kidId), isNull(kidTable.archivedAt)))
    .limit(1);
  const k = rows[0];
  if (!k) redirect(`/${lang}/pick`);

  return (
    <AvatarPickerView
      lang={lang as 'he' | 'en'}
      t={t}
      kidName={k.name}
      kidColor={k.color}
      initialKey={k.avatarKey ?? null}
      initialTheme={k.theme}
      backHref={`/${lang}`}
    />
  );
}
