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
import { ACTIVE_THEME_COOKIE, ADMIN_THEME_COOKIE } from './constants';

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
    const opts = {
      path: '/',
      maxAge: ONE_YEAR_S,
      sameSite: 'lax' as const,
      // Not HttpOnly — non-sensitive, and the active-theme cookie has to be
      // readable by the root layout's generateViewport() server-side anyway.
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    };
    jar.set(ADMIN_THEME_COOKIE, theme, opts);
    // Mirror to the active-theme cookie so the next SSR sets <meta theme-color>
    // to the picked tone before any client JS has a chance to override it.
    // Otherwise iOS PWA reads the (stale, default-pink) SSR meta and ignores
    // later JS updates, leaving a pink stripe on the OS notification bar.
    jar.set(ACTIVE_THEME_COOKIE, theme, opts);
  } catch (err) {
    console.error('setAdminThemeAction failed', err);
    return { ok: false, error: 'internal' };
  }

  // The theme is read in the [lang] layout, so revalidate the whole admin
  // surface to recolor every page on next navigation.
  revalidatePath('/[lang]', 'layout');
  return { ok: true, theme: theme as ThemeId };
}
