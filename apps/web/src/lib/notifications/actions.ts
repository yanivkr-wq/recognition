/**
 * Kid-side notifications actions (Lily's Fix 12b shell).
 *
 * Phase 8 will land the full dispatcher (WhatsApp + quiet hours + rate
 * limits + reminder cron). For now this gives the kid a working bell:
 *   - The page reads `state='pending'` bell events targeting them.
 *   - `markAllReadAction` flips them to `state='sent'` with `sent_at=now()`
 *     so they leave the unread chip.
 *
 * Idempotent — re-running the action when nothing's pending is a no-op.
 */

'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { getPool } from '@reco/db';
import { requireKid, UnauthorizedError } from '../auth/guards';

export async function markAllReadAction(): Promise<void> {
  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return;
    throw err;
  }
  await getPool().query(
    `UPDATE notification_event
        SET state = 'sent', sent_at = now()
      WHERE recipient_kid_id = $1
        AND channel = 'bell'
        AND state = 'pending'`,
    [kid.kidId],
  );
  revalidatePath('/[lang]', 'layout');
}
