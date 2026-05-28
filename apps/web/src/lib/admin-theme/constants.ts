/**
 * Admin theme — shared constants.
 *
 * Lives in its own file (not inside actions.ts) because Next's "use server"
 * directive only permits async-function exports. A plain `export const` from
 * actions.ts causes Turbopack to reject the entire module at build time, so
 * the cookie name (read by middleware-equivalent code in [lang]/layout.tsx
 * and the menu page) is hosted here instead.
 */

export const ADMIN_THEME_COOKIE = 'reco-admin-theme';
