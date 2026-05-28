/**
 * Trophy — the locked app mark.
 *
 * Pink-soft rounded-square tile, pink dashed stitched ring, yellow hexagon,
 * white trophy centred inside the hex. This is the STATIC variant used for
 * the OS launcher icons (icon0 / icon1 / apple-icon). The animated in-app
 * version (cycling emblem inside the hex) lives in `components/trophy-mark.tsx`
 * and re-colors per theme via CSS vars; this file uses HARDCODED bubblegum
 * tokens because the installed app icon is permanent.
 *
 * Exported in two shapes:
 *   - TROPHY_MARK_SVG     — raw SVG markup string (152×152 viewBox).
 *   - TROPHY_MARK_DATA_URL — data:image/svg+xml URL safe to drop into Satori
 *                            (next/og ImageResponse), which only accepts SVG
 *                            via the <img src=…> path.
 *
 * Geometry (kept as named constants so tweaks stay in one place):
 *   tile: 152 × 152, corner radius 34 — sized to match a 152px launcher icon
 *         and the docs/app-icon-option-2-emblems.html preview Lily approved.
 *   ring: r=58 around centre (76,76); 5px stroke; 6/5 dash; round caps.
 *   hex:  flat-top regular hexagon, r=36, centred on (76,76).
 *   trophy: cup + handles + stem + base, sitting in the hex's upper half.
 */

export const TROPHY_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 152 152">
  <rect width="152" height="152" rx="34" fill="#FFF0F6"/>
  <circle cx="76" cy="76" r="58" fill="none" stroke="#FF6B9D" stroke-width="5" stroke-dasharray="6 5" stroke-linecap="round"/>
  <polygon points="76,40 107.18,58 107.18,94 76,112 44.82,94 44.82,58" fill="#FFD75E" stroke="#E8B927" stroke-width="2.5" stroke-linejoin="round"/>
  <g fill="#FFFFFF" stroke="#FFFFFF" stroke-linejoin="round" stroke-linecap="round">
    <path d="M68 66 H84 V77 C84 81 80 84 76 84 C72 84 68 81 68 77 Z" stroke-width="1"/>
    <path d="M68 69 C64.5 69 64 71 64 73 C64 75 66 76 68 76" fill="none" stroke-width="1.8"/>
    <path d="M84 69 C87.5 69 88 71 88 73 C88 75 86 76 84 76" fill="none" stroke-width="1.8"/>
    <rect x="73" y="84" width="6" height="3"/>
    <rect x="69" y="87" width="14" height="3" rx="0.5"/>
  </g>
</svg>`;

/** Base64-encoded data URL — avoids URL-encoding pitfalls with `#` in colour
 *  literals and gives Satori a clean inline SVG to rasterise. */
export const TROPHY_MARK_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(
  TROPHY_MARK_SVG,
).toString('base64')}`;
