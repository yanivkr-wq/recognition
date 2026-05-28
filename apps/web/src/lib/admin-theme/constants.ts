/**
 * Theme cookies — shared constants.
 *
 * Two cookies, each serves a different consumer:
 *
 *   - ADMIN_THEME_COOKIE ('reco-admin-theme') — the admin's chosen theme,
 *     written by setAdminThemeAction, read by [lang]/layout.tsx to compute
 *     `data-theme` for the admin's wrapper. Kids ignore it.
 *
 *   - ACTIVE_THEME_COOKIE ('reco-active-theme') — whatever theme is currently
 *     painting the chrome (admin's pick OR the active kid's DB-backed theme),
 *     written by BOTH setAdminThemeAction AND setKidThemeAction, read by the
 *     root layout's generateViewport() to set the SSR <meta name="theme-color">
 *     to the right color BEFORE any client JS runs. iOS PWA reads theme-color
 *     once at load and ignores later updates, so getting this right at SSR is
 *     what eliminates the residual pink stripe at the top of the OS status bar
 *     when the active theme is ocean / sunset.
 *
 * Hosted here (not in actions.ts) because "use server" files may only export
 * async functions — a plain `export const` from actions.ts breaks the build.
 */

export const ADMIN_THEME_COOKIE = 'reco-admin-theme';
export const ACTIVE_THEME_COOKIE = 'reco-active-theme';
