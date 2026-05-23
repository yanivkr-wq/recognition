/**
 * Server action — admin sets/resets a kid's PIN.
 *
 * Signature matches React 19's useActionState contract: (prevState, FormData).
 * That way the client form can pass the action straight to useActionState
 * and React handles the wire format itself — no client-side wrapper that
 * would silently swallow the server-action-ness.
 *
 * Authorization: requires parent session, household-scoped. Side effects:
 *   1. UPDATE kid set pin_hash + reset failed-count + clear lockout
 *   2. INSERT audit_log (action='kid.pin_reset')
 * Returns a typed error key on validation failure; on success calls Next's
 * redirect to /admin/kids/<id>/pin?ok=1 (server-renders a flash).
 */

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hash } from '@node-rs/argon2';
import { and, eq } from 'drizzle-orm';
import { getDb, kid as kidTable, auditLog } from '@reco/db';
import { auth } from '../../../../../../auth';

export type SetPinError = 'invalid_format' | 'not_found' | 'forbidden';

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export async function setKidPinAction(
  _prev: SetPinError | undefined,
  formData: FormData,
): Promise<SetPinError | undefined> {
  const kidId = String(formData.get('kidId') ?? '');
  const pin = String(formData.get('pin') ?? '');
  const lang = String(formData.get('lang') ?? 'he');

  if (!/^\d{4}$/.test(pin)) return 'invalid_format';

  const session = await auth();
  if (!session?.user) return 'forbidden';

  const db = getDb();
  const rows = await db
    .select({ id: kidTable.id, householdId: kidTable.householdId })
    .from(kidTable)
    .where(and(eq(kidTable.id, kidId), eq(kidTable.householdId, session.user.householdId)))
    .limit(1);
  const k = rows[0];
  if (!k) return 'not_found';

  const newHash = await hash(pin, ARGON2_OPTIONS);
  const now = new Date();
  await db
    .update(kidTable)
    .set({
      pinHash: newHash,
      pinFailedCount: 0,
      pinLockedUntil: null,
      updatedAt: now,
    })
    .where(eq(kidTable.id, kidId));

  const hdrs = await headers();
  await db.insert(auditLog).values({
    householdId: session.user.householdId,
    actorUserId: session.user.id,
    action: 'kid.pin_reset',
    targetKind: 'kid',
    targetId: kidId,
    requestIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: hdrs.get('user-agent') ?? null,
  });

  redirect(`/${lang}/admin/kids/${kidId}/pin?ok=1`);
}
