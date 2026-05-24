/**
 * The locked set of badge emblem keys (BRANDBOOK §5 / CLAUDE.md §6).
 *
 * Badges render as the placeholder Embroidered Patch (pastel ring + dashed
 * border + initial) until the family-3 SVG emblems land in Phase 9, but the
 * iconKey is still constrained to this set so a future SVG swap is a no-op.
 * No emoji as emblems — only these keys.
 *
 * Shared by the badge admin form (the picker grid) and the server action
 * (allow-list validation), so it carries no 'use client'/'use server' marker.
 */

export interface EmblemEntry {
  key: string;
  labelHe: string;
  labelEn: string;
}

export const BADGE_EMBLEMS: EmblemEntry[] = [
  { key: 'em-crown', labelHe: 'כתר', labelEn: 'Crown' },
  { key: 'em-trophy', labelHe: 'גביע', labelEn: 'Trophy' },
  { key: 'em-medal', labelHe: 'מדליה', labelEn: 'Medal' },
  { key: 'em-diamond', labelHe: 'יהלום', labelEn: 'Diamond' },
  { key: 'em-cert', labelHe: 'תעודה', labelEn: 'Certificate' },
  { key: 'em-gift', labelHe: 'מתנה', labelEn: 'Gift' },
  { key: 'em-star', labelHe: 'כוכב', labelEn: 'Star' },
  { key: 'em-torch', labelHe: 'לפיד', labelEn: 'Torch' },
];

export const BADGE_EMBLEM_KEYS = BADGE_EMBLEMS.map((e) => e.key);

export function isBadgeEmblem(key: string): boolean {
  return BADGE_EMBLEM_KEYS.includes(key);
}
