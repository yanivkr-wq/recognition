/**
 * Admin app-wide theme — per-device, cookie-backed.
 *
 * Kid theme is stored on the kid row because every kid has their own DB-backed
 * profile and we want it to follow them across devices. Admin doesn't: both
 * parents share one login, and "Mom likes ocean on her phone but Dad likes
 * bubblegum on his" is the natural ask. So the admin theme lives in a cookie
 * scoped to the device that picked it, and isn't persisted server-side.
 *
 * Set via this server action; read server-side in [lang]/layout.tsx via the
 * `cookies()` helper and applied as `data-theme` on the layout wrapper.
 */

'use server';

import 'server-only';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '../../auth';
import { THEME_IDS, type ThemeId } from '../theme';

export const ADMIN_THEME_COOKIE = 'reco-admin-theme';
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export type SetAdminThemeState =
  | { ok: true; theme: ThemeId }
  | { ok: false; error: 'forbidden' | 'invalid_theme' | 'internal' };

const VALID_THEMES = new Set<string>(THEME_IDS);

export async function setAdminThemeAction(
  _prev: SetAdminThemeState | undefined,
  formData: FormData,
): Promise<SetAdminThemeState> {
  const theme = String(formData.get('theme') ?? '').trim();
  if (!VALID_THEMES.has(theme)) {
    return { ok: false, error: 'invalid_theme' };
  }

  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: 'forbidden' };
  }

  try {
    const jar = await cookies();
    jar.set(ADMIN_THEME_COOKIE, theme, {
      path: '/',
      maxAge: ONE_YEAR_S,
      sameSite: 'lax',
      // Not HttpOnly — the value is non-sensitive and a future client hook
      // could read it for instant local preview without a round-trip.
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  } catch (err) {
    console.error('setAdminThemeAction failed', err);
    return { ok: false, error: 'internal' };
  }

  // The theme is read in the [lang] layout, so revalidate the whole admin
  // surface to recolor every page on next navigation.
  revalidatePath('/[lang]', 'layout');
  return { ok: true, theme: theme as ThemeId };
}
