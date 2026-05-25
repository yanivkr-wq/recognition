/**
 * Server action — admin edits a kid's identity (name, accent color, birthday).
 *
 * Signature matches React 19's useActionState contract: (prevState, FormData),
 * so the client form passes it straight to useActionState (no client wrapper
 * that would strip its server-action-ness). Parent-only, household-scoped.
 *
 * The slug is intentionally NOT touched — it backs the /pick/<slug> URL and is
 * unique per household; renaming shouldn't break a bookmarked picker link.
 * Avatar face stays kid-owned (the /[lang]/avatar page). Birthday is optional
 * and drives the yearly birthday badge (daily reset cron).
 */

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, kid as kidTable, auditLog } from '@reco/db';
import { auth } from '../../../../../../auth';

export type EditKidError = 'invalid_name' | 'invalid_color' | 'invalid_birthday' | 'not_found' | 'forbidden';

export async function updateKidAction(
  _prev: EditKidError | undefined,
  formData: FormData,
): Promise<EditKidError | undefined> {
  const kidId = String(formData.get('kidId') ?? '');
  const lang = String(formData.get('lang') ?? 'he');
  const name = String(formData.get('name') ?? '').trim();
  const color = String(formData.get('color') ?? '').trim();
  const birthdayRaw = String(formData.get('birthday') ?? '').trim();

  if (!name || name.length > 40) return 'invalid_name';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return 'invalid_color';
  let birthdate: string | null = null;
  if (birthdayRaw !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw)) return 'invalid_birthday';
    birthdate = birthdayRaw;
  }

  const session = await auth();
  if (!session?.user) return 'forbidden';

  const db = getDb();
  const rows = await db
    .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color, birthdate: kidTable.birthdate })
    .from(kidTable)
    .where(and(eq(kidTable.id, kidId), eq(kidTable.householdId, session.user.householdId)))
    .limit(1);
  const before = rows[0];
  if (!before) return 'not_found';

  await db
    .update(kidTable)
    .set({ name, color, birthdate, updatedAt: new Date() })
    .where(eq(kidTable.id, kidId));

  const hdrs = await headers();
  await db.insert(auditLog).values({
    householdId: session.user.householdId,
    actorUserId: session.user.id,
    action: 'kid.updated',
    targetKind: 'kid',
    targetId: kidId,
    beforeJson: before,
    afterJson: { name, color, birthdate },
    requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: hdrs.get('user-agent') ?? null,
  });

  // Name/color show in every kid header + the admin lists; revalidate both
  // the admin layout and the kid surfaces so the change lands without refresh.
  revalidatePath('/[lang]/admin', 'layout');
  revalidatePath('/[lang]', 'layout');
  redirect(`/${lang}/admin/kids`);
}
