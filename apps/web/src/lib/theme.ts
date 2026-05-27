/**
 * App-wide theme registry (Lily's request: "let players pick a theme that
 * recolors the entire app").
 *
 * A theme recolors two things only: the SURFACES (bg / card tint / rules) and
 * the ACTION ACCENT (the pink family — buttons, links, highlights). Semantic
 * colors stay fixed per BRANDBOOK: mint = success, yellow = currency,
 * lavender = campaigns, sky/peach = player identity. That keeps every theme
 * legible and on-brand while still feeling distinct.
 *
 * The actual color values live as CSS-variable overrides in globals.css under
 * `[data-theme="<id>"]`. This module is the single source of truth for the
 * theme id list, defaults, validation, and the swatch shown in the picker.
 */

export const THEME_IDS = ['bubblegum', 'ocean', 'sunset'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'bubblegum';

/** Narrow an arbitrary string (DB value, form input) to a valid theme id. */
export function asTheme(value: string | null | undefined): ThemeId {
  return THEME_IDS.includes(value as ThemeId) ? (value as ThemeId) : DEFAULT_THEME;
}

export interface ThemeMeta {
  id: ThemeId;
  labelHe: string;
  labelEn: string;
  /** Swatch trio for the picker preview: [accent, accentDark, surface]. */
  swatch: [string, string, string];
  /** OS status-bar / PWA theme-color for this theme (the accent-dark tone, so
   *  it matches the rest of the app's chrome). Kept in sync with globals.css. */
  statusBar: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'bubblegum',
    labelHe: 'מסטיק',
    labelEn: 'Bubblegum',
    swatch: ['#FF6B9D', '#E94B7F', '#FFF0F6'],
    statusBar: '#E94B7F',
  },
  {
    id: 'ocean',
    labelHe: 'אוקיינוס',
    labelEn: 'Ocean',
    swatch: ['#1EA7B5', '#137E8A', '#E9F8FA'],
    statusBar: '#137E8A',
  },
  {
    id: 'sunset',
    labelHe: 'שקיעה',
    labelEn: 'Sunset',
    swatch: ['#FF7A66', '#E8553F', '#FFF1EC'],
    statusBar: '#E8553F',
  },
];

/** Status-bar color for a theme id (defaults to bubblegum's). */
export function themeStatusBar(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.statusBar ?? '#E94B7F';
}
