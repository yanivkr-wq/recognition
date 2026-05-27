/**
 * Kid avatar — set/clear actions (Lily's Fix 11).
 *
 * Only the kid (kid principal) can change their own avatar. Admins can
 * NOT impersonate via this action — they pick the kid's color + name via
 * the admin kids page (Phase 2 surface), and the kid picks their avatar
 * from the bank themselves.
 *
 * `setKidAvatarAction` accepts an `avatarKey` form field; an empty value
 * clears the kid's avatar back to the initial-letter fallback.
 *
 * Validation: the key must exist in the inline AVATAR_LIBRARY — anything
 * else gets rejected so the DB column never holds garbage.
 */

'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, kid as kidTable } from '@reco/db';
import { AVATAR_LIBRARY } from '../../components/avatar-library';
import { requireKid, UnauthorizedError } from '../auth/guards';
import { THEME_IDS, type ThemeId } from '../theme';

export type SetAvatarState =
  | { ok: true; avatarKey: string | null }
  | { ok: false; error: 'forbidden' | 'invalid_key' | 'internal' };

const VALID_KEYS = new Set(AVATAR_LIBRARY.map((a) => a.key));

/** Kid-pickable accent color palette. The Reco brandbook §2 saturated tones
 *  plus a couple of friendly extras. Validated server-side so the column
 *  never holds garbage. */
const VALID_COLORS = new Set([
  '#FF6B9D', // pink
  '#FF9F7A', // peach
  '#FFD75E', // yellow
  '#7CE0B5', // mint
  '#6EC9F4', // sky
  '#B59FE5', // lavender
  '#FF8AAB', // rose
  '#A8D67F', // apple green
]);

export type SetColorState =
  | { ok: true; color: string }
  | { ok: false; error: 'forbidden' | 'invalid_color' | 'internal' };

export async function setKidAvatarAction(
  _prev: SetAvatarState | undefined,
  formData: FormData,
): Promise<SetAvatarState> {
  const raw = String(formData.get('avatarKey') ?? '').trim();
  // Empty string = clear.
  const next: string | null = raw === '' ? null : raw;
  if (next !== null && !VALID_KEYS.has(next)) {
    return { ok: false, error: 'invalid_key' };
  }

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  try {
    await getDb().update(kidTable).set({ avatarKey: next }).where(eq(kidTable.id, kid.kidId));
  } catch (err) {
    console.error('setKidAvatarAction failed', err);
    return { ok: false, error: 'internal' };
  }
  // Avatar pip shows up across every kid page header → revalidate the
  // entire kid surface so the new face renders everywhere on next nav.
  revalidatePath('/[lang]', 'layout');
  return { ok: true, avatarKey: next };
}

/** Kid changes their accent color. Validated against the brandbook palette
 *  whitelist; the kid principal already gates the call to the kid's own row. */
export async function setKidColorAction(
  _prev: SetColorState | undefined,
  formData: FormData,
): Promise<SetColorState> {
  const color = String(formData.get('color') ?? '').trim().toUpperCase();
  if (!VALID_COLORS.has(color)) {
    return { ok: false, error: 'invalid_color' };
  }

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  try {
    await getDb().update(kidTable).set({ color }).where(eq(kidTable.id, kid.kidId));
  } catch (err) {
    console.error('setKidColorAction failed', err);
    return { ok: false, error: 'internal' };
  }
  // Color drives every avatar pip — same revalidate as setKidAvatarAction.
  revalidatePath('/[lang]', 'layout');
  return { ok: true, color };
}

export type SetThemeState =
  | { ok: true; theme: ThemeId }
  | { ok: false; error: 'forbidden' | 'invalid_theme' | 'internal' };

const VALID_THEMES = new Set<string>(THEME_IDS);

/** Kid picks an app-wide theme. Validated against the theme registry; the kid
 *  principal gates the write to the kid's own row. The chosen theme recolors
 *  every player surface (read back in the [lang] layout). */
export async function setKidThemeAction(
  _prev: SetThemeState | undefined,
  formData: FormData,
): Promise<SetThemeState> {
  const theme = String(formData.get('theme') ?? '').trim();
  if (!VALID_THEMES.has(theme)) {
    return { ok: false, error: 'invalid_theme' };
  }

  let kid;
  try {
    kid = await requireKid();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  try {
    await getDb().update(kidTable).set({ theme }).where(eq(kidTable.id, kid.kidId));
  } catch (err) {
    console.error('setKidThemeAction failed', err);
    return { ok: false, error: 'internal' };
  }
  // The theme is read in the [lang] layout, so revalidate the whole kid surface
  // to recolor every page on next navigation.
  revalidatePath('/[lang]', 'layout');
  return { ok: true, theme: theme as ThemeId };
}
