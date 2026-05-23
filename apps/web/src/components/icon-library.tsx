/**
 * Reco icon library — v1 inline SVG set.
 *
 * Two families per BRANDBOOK §4:
 *   - `ic-*` task icons (family 2)
 *   - `rw-*` reward icons (family 4)
 *
 * Design rules (held until Phase 9's full Flaticon swap):
 *   - 24×24 viewBox so the same path scales from 32px (history row) to 56px
 *     (shop tile) without resampling artefacts.
 *   - `currentColor` for stroke/fill so the parent's text color drives the
 *     glyph color. The existing pastel tile sits behind the SVG; the glyph
 *     inherits `--ink` from the tile's text color contract.
 *   - Stroke-only or fill-only — no gradients (BRANDBOOK §5 forbids them).
 *   - Hand-drawn approximations until the real pack lands. The keys here
 *     MUST match the icon_key values in 0002_seed_household.sql so the
 *     existing seed wires up automatically; new keys are additive.
 *
 * Renderers (TaskIcon, RewardIcon, IconPicker) all import `getIcon()` and
 * fall back to a centered initial letter when the key isn't recognized —
 * same fallback shape that's been in place since Phase 3.
 */

import type { ComponentType, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 24): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

// ─── task icons (ic-*) ────────────────────────────────────────────────────────

const IcBed = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 18V8" />
    <path d="M3 13h18v5" />
    <path d="M21 18v-4a3 3 0 0 0-3-3h-7v4" />
    <path d="M7 11a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z" />
  </svg>
);

const IcBrush = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="9" y="14" width="6" height="6" rx="1" />
    <path d="M9 14V6h6v8" />
    <path d="M10 6V3.5M12 6V3.5M14 6V3.5" />
  </svg>
);

const IcMeal = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 12a9 9 0 0 0 18 0" />
    <path d="M2 12h20" />
    <path d="M12 4v4" />
    <path d="M9 5l1 3M15 5l-1 3" />
  </svg>
);

const IcClothes = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M7 4l-4 3 2 3 2-1v11h10V9l2 1 2-3-4-3-3 2h-4z" />
  </svg>
);

const IcHomework = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z" />
    <path d="M8 8h6M8 12h6M8 16h4" />
    <path d="M18 6l2-2 2 2-2 2-2-2z" />
  </svg>
);

const IcBook = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 5v14" />
    <path d="M4 5c3-1 6-1 8 1v14c-2-2-5-2-8-1" />
    <path d="M20 5v14" />
    <path d="M20 5c-3-1-6-1-8 1v14c2-2 5-2 8-1" />
  </svg>
);

const IcBroom = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M14 4l6 6" />
    <path d="M11 7l6 6-6 6-4-4 4-8z" />
    <path d="M7 13l-4 8M9 14l-3 7M13 15l-2 7" />
  </svg>
);

const IcMusic = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="16" r="2" />
  </svg>
);

const IcPet = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="6" cy="9" r="1.8" />
    <circle cx="18" cy="9" r="1.8" />
    <circle cx="9" cy="5" r="1.8" />
    <circle cx="15" cy="5" r="1.8" />
    <path d="M12 11c-3 0-5 2-5 5 0 3 2 4 5 4s5-1 5-4c0-3-2-5-5-5z" />
  </svg>
);

const IcPlant = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M8 20h8l-1-7H9l-1 7z" />
    <path d="M12 13V8" />
    <path d="M12 8c-3-1-4-3-4-5 3 0 5 2 5 5" />
    <path d="M12 8c3-1 4-3 4-5-3 0-5 2-5 5" />
  </svg>
);

const IcSoap = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="4" y="9" width="16" height="10" rx="3" />
    <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    <circle cx="9" cy="13" r="1" fill="currentColor" />
    <circle cx="13" cy="15" r="1" fill="currentColor" />
  </svg>
);

const IcPencil = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 20l3-1 11-11-2-2L5 17l-1 3z" />
    <path d="M14 6l4 4" />
  </svg>
);

const IcBike = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="6" cy="17" r="3.5" />
    <circle cx="18" cy="17" r="3.5" />
    <path d="M6 17l3-7h6l3 7" />
    <path d="M9 10h4l-1-4h2" />
  </svg>
);

const IcWater = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3c0 0-7 7-7 12a7 7 0 0 0 14 0c0-5-7-12-7-12z" />
  </svg>
);

const IcSun = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
  </svg>
);

const IcStar = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1 3-6z" />
  </svg>
);

const IcBell = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

const IcHouse = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9z" />
  </svg>
);

const IcWalletNav = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 7a2 2 0 0 1 2-2h14v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    <path d="M3 9h18" />
    <circle cx="17" cy="14" r="1.4" fill="currentColor" />
  </svg>
);

const IcMedal = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="14" r="6" />
    <path d="M8 3l4 8 4-8" />
    <path d="M10 12l2 4 2-4" />
  </svg>
);

const IcQuest = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 4l5 2 2-2 4 5 2-2 3 5-5 3 2 2-5 4-2-2-3 5-5-2 2-5z" />
  </svg>
);

/** Fix 2 · Option A — Pathway: a winding road with a flag at the end. */
const IcQuestPathway = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M5 20c2-2 0-5 3-7s5 2 7-1 1-5 4-7" />
    <path d="M19 5l-3 1v3l3-1z" fill="currentColor" />
    <circle cx="5" cy="20" r="1.4" fill="currentColor" />
  </svg>
);

/** Fix 2 · Option B — Finish-line flag: a checkered flag on a pole. */
const IcQuestFlag = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M5 3v18" />
    <path d="M5 4h12v8H5z" />
    <path d="M5 4h3v4h3v-4M11 8h3v4h-3M8 8v4H5" fill="currentColor" stroke="none" />
  </svg>
);

/** Fix 2 · Option C — Compass: 4-pointed star inside a circle. */
const IcQuestCompass = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 4v8l5 8-5-4-5 4 5-8V4z" />
  </svg>
);

/** Fix 2 · Option D — Two mountain peaks with a flag at the taller summit.
 *  Iterated per Lily's third illustration: two clearly distinct peaks
 *  (smaller foreground peak on the left, taller right peak), a thin
 *  vertical pole rising above the right summit, and a bold right-pointing
 *  triangular pennant. Filled silhouette so the shape reads at 22px in
 *  the bottom-nav and 80px+ in the sandbox preview. */
const IcQuestClimb = ({ size, ...rest }: IconProps) => (
  <svg
    width={size ?? 24}
    height={size ?? 24}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...rest}
  >
    {/* Mountains: a single closed shape with two peaks. The valley between
        them at (9.5, 18) gives the silhouette its "two distinct peaks"
        read. The right summit lands at (15, 8) so the flag pole has clear
        sky above it. */}
    <path d="M2 22 L6.5 14 L9.5 18 L15 8 L22 22 Z" />
    {/* Flag pole — rises 6 units above the summit at x=15. */}
    <rect x="14.7" y="2" width="0.6" height="6" />
    {/* Pennant — bold right-pointing triangle attached to the upper portion
        of the pole. Sized to dominate so the "flag" reading survives at
        small sizes. */}
    <path d="M15.3 2.5 L21 4 L15.3 5.5 Z" />
  </svg>
);

const IcShop = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 7h16l-1 13H5L4 7z" />
    <path d="M8 7a4 4 0 0 1 8 0" />
  </svg>
);

/** Section-header glyphs — replace ✨ / ✅ emojis in kid-home so the
 *  copy matches BRANDBOOK §13 ("never use emoji as production glyphs"). */
const IcSparkle = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3l1.5 6 6 1.5-6 1.5-1.5 6-1.5-6-6-1.5 6-1.5z" />
    <path d="M19 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
);

const IcCheckCircle = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l3 3 5-6.5" />
  </svg>
);

const IcParty = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    {/* Cone */}
    <path d="M4 21l4-14 11 4z" />
    {/* Confetti */}
    <circle cx="18" cy="4" r="1" fill="currentColor" />
    <circle cx="20" cy="8" r="1" fill="currentColor" />
    <circle cx="13" cy="3" r="1" fill="currentColor" />
    <circle cx="15" cy="6" r="0.8" fill="currentColor" />
  </svg>
);

// ─── reward icons (rw-*) ─────────────────────────────────────────────────────

const RwCandy = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <ellipse cx="12" cy="12" rx="5" ry="3" />
    <path d="M7 12l-4-2 2 2-2 2 4-2z" />
    <path d="M17 12l4-2-2 2 2 2-4-2z" />
    <path d="M10 11l1 2M12 10l1 4M14 11l1 2" />
  </svg>
);

const RwPhone = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="7" y="3" width="10" height="18" rx="2" />
    <path d="M11 18h2" />
    <path d="M9 6h6v9H9z" />
  </svg>
);

const RwIcecream = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="8" r="4" />
    <circle cx="9" cy="6" r="2.5" />
    <circle cx="15" cy="6" r="2.5" />
    <path d="M8 11l4 9 4-9" />
  </svg>
);

const RwPillow = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="6" width="18" height="12" rx="3" />
    <path d="M7 9l3 3-3 3M17 9l-3 3 3 3" />
  </svg>
);

const RwMovie = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M4 6h12l2 3-2 3 2 3-2 3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    <path d="M18 6v12" strokeDasharray="2 2" />
  </svg>
);

const RwController = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M6 8h12a4 4 0 0 1 4 4v4a3 3 0 0 1-5 2l-2-2H9l-2 2a3 3 0 0 1-5-2v-4a4 4 0 0 1 4-4z" />
    <path d="M8 12v3M6.5 13.5h3" />
    <circle cx="15" cy="13" r="0.8" fill="currentColor" />
    <circle cx="17" cy="15" r="0.8" fill="currentColor" />
  </svg>
);

const RwPizza = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3l9 16H3l9-16z" />
    <circle cx="10" cy="13" r="1" fill="currentColor" />
    <circle cx="14" cy="13" r="1" fill="currentColor" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

const RwGift = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="9" width="18" height="12" rx="1" />
    <path d="M3 13h18M12 9v12" />
    <path d="M12 9c-2-3-5-3-5-1s2 1 5 1zM12 9c2-3 5-3 5-1s-2 1-5 1z" />
  </svg>
);

const RwCookie = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="8" cy="10" r="1" fill="currentColor" />
    <circle cx="14" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="14" r="1" fill="currentColor" />
    <circle cx="9" cy="15" r="1" fill="currentColor" />
  </svg>
);

const RwBalloon = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <ellipse cx="12" cy="9" rx="5" ry="6" />
    <path d="M12 15v6" />
    <path d="M11 15h2l-1 1z" />
  </svg>
);

const RwToy = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="10" r="6" />
    <circle cx="8" cy="6" r="2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="10" r="0.8" fill="currentColor" />
    <circle cx="14" cy="10" r="0.8" fill="currentColor" />
    <path d="M10 13c1 1 3 1 4 0" />
    <rect x="6" y="16" width="12" height="5" rx="1" />
  </svg>
);

const RwTrophy = ({ size, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M7 5h10v4a5 5 0 0 1-10 0V5z" />
    <path d="M7 7H5v2a2 2 0 0 0 2 2M17 7h2v2a2 2 0 0 1-2 2" />
    <path d="M10 14h4l1 4h-6l1-4z" />
    <path d="M7 21h10" />
  </svg>
);

// ─── library map + lookup ─────────────────────────────────────────────────────

export interface IconEntry {
  key: string;
  /** Bilingual short labels for the picker grid. */
  labelHe: string;
  labelEn: string;
  /** Family — drives the picker grouping. */
  family: 'task' | 'reward';
  Component: ComponentType<IconProps>;
}

export const ICON_LIBRARY: IconEntry[] = [
  // Tasks — match the seed icon_keys first.
  { key: 'ic-bed', labelHe: 'מיטה', labelEn: 'Bed', family: 'task', Component: IcBed },
  { key: 'ic-brush', labelHe: 'מברשת', labelEn: 'Brush', family: 'task', Component: IcBrush },
  { key: 'ic-meal', labelHe: 'ארוחה', labelEn: 'Meal', family: 'task', Component: IcMeal },
  { key: 'ic-clothes', labelHe: 'בגדים', labelEn: 'Clothes', family: 'task', Component: IcClothes },
  { key: 'ic-homework', labelHe: 'שיעורי בית', labelEn: 'Homework', family: 'task', Component: IcHomework },
  { key: 'ic-book', labelHe: 'ספר', labelEn: 'Book', family: 'task', Component: IcBook },
  { key: 'ic-broom', labelHe: 'מטאטא', labelEn: 'Broom', family: 'task', Component: IcBroom },
  { key: 'ic-music', labelHe: 'מוזיקה', labelEn: 'Music', family: 'task', Component: IcMusic },
  { key: 'ic-pet', labelHe: 'חיית מחמד', labelEn: 'Pet', family: 'task', Component: IcPet },
  { key: 'ic-plant', labelHe: 'צמח', labelEn: 'Plant', family: 'task', Component: IcPlant },
  { key: 'ic-soap', labelHe: 'סבון', labelEn: 'Soap', family: 'task', Component: IcSoap },
  { key: 'ic-pencil', labelHe: 'עפרון', labelEn: 'Pencil', family: 'task', Component: IcPencil },
  { key: 'ic-bike', labelHe: 'אופניים', labelEn: 'Bike', family: 'task', Component: IcBike },
  { key: 'ic-water', labelHe: 'מים', labelEn: 'Water', family: 'task', Component: IcWater },
  { key: 'ic-sun', labelHe: 'שמש', labelEn: 'Sun', family: 'task', Component: IcSun },
  { key: 'ic-star', labelHe: 'כוכב', labelEn: 'Star', family: 'task', Component: IcStar },
  { key: 'ic-bell', labelHe: 'פעמון', labelEn: 'Bell', family: 'task', Component: IcBell },
  { key: 'ic-house', labelHe: 'בית', labelEn: 'House', family: 'task', Component: IcHouse },
  { key: 'ic-wallet', labelHe: 'ארנק', labelEn: 'Wallet', family: 'task', Component: IcWalletNav },
  { key: 'ic-medal', labelHe: 'מדליה', labelEn: 'Medal', family: 'task', Component: IcMedal },
  { key: 'ic-quest', labelHe: 'מסע', labelEn: 'Quest', family: 'task', Component: IcQuest },
  { key: 'ic-quest-pathway', labelHe: 'מסלול', labelEn: 'Pathway', family: 'task', Component: IcQuestPathway },
  { key: 'ic-quest-flag', labelHe: 'דגל סיום', labelEn: 'Finish flag', family: 'task', Component: IcQuestFlag },
  { key: 'ic-quest-compass', labelHe: 'מצפן', labelEn: 'Compass', family: 'task', Component: IcQuestCompass },
  { key: 'ic-quest-climb', labelHe: 'מטפס', labelEn: 'Climber', family: 'task', Component: IcQuestClimb },
  { key: 'ic-shop', labelHe: 'חנות', labelEn: 'Shop', family: 'task', Component: IcShop },
  { key: 'ic-sparkle', labelHe: 'נצנוץ', labelEn: 'Sparkle', family: 'task', Component: IcSparkle },
  { key: 'ic-check-circle', labelHe: 'אישור', labelEn: 'Check', family: 'task', Component: IcCheckCircle },
  { key: 'ic-party', labelHe: 'חגיגה', labelEn: 'Party', family: 'task', Component: IcParty },

  // Rewards — match the seed rw-* keys first.
  { key: 'rw-candy', labelHe: 'סוכריה', labelEn: 'Candy', family: 'reward', Component: RwCandy },
  { key: 'rw-phone', labelHe: 'טלפון', labelEn: 'Phone', family: 'reward', Component: RwPhone },
  { key: 'rw-icecream', labelHe: 'גלידה', labelEn: 'Ice cream', family: 'reward', Component: RwIcecream },
  { key: 'rw-pillow', labelHe: 'כרית', labelEn: 'Pillow', family: 'reward', Component: RwPillow },
  { key: 'rw-movie', labelHe: 'סרט', labelEn: 'Movie', family: 'reward', Component: RwMovie },
  { key: 'rw-controller', labelHe: 'משחק', labelEn: 'Game', family: 'reward', Component: RwController },
  { key: 'rw-pizza', labelHe: 'פיצה', labelEn: 'Pizza', family: 'reward', Component: RwPizza },
  { key: 'rw-gift', labelHe: 'מתנה', labelEn: 'Gift', family: 'reward', Component: RwGift },
  { key: 'rw-cookie', labelHe: 'עוגייה', labelEn: 'Cookie', family: 'reward', Component: RwCookie },
  { key: 'rw-balloon', labelHe: 'בלון', labelEn: 'Balloon', family: 'reward', Component: RwBalloon },
  { key: 'rw-toy', labelHe: 'בובה', labelEn: 'Toy', family: 'reward', Component: RwToy },
  { key: 'rw-trophy', labelHe: 'גביע', labelEn: 'Trophy', family: 'reward', Component: RwTrophy },
];

/** Compatibility aliases — early seed used different short names for the
 *  same glyphs. Resolving these in `getIcon()` means the existing seed
 *  renders correctly without a backfill migration. New templates should
 *  use the canonical keys above (`ic-brush`, `ic-meal`, `ic-clothes`). */
const ICON_ALIASES: Record<string, string> = {
  'ic-tooth': 'ic-brush',
  'ic-food': 'ic-meal',
  'ic-shirt': 'ic-clothes',
};

const LIBRARY_BY_KEY = new Map(ICON_LIBRARY.map((e) => [e.key, e]));

export function getIcon(key: string): IconEntry | null {
  return (
    LIBRARY_BY_KEY.get(key) ??
    (ICON_ALIASES[key] ? LIBRARY_BY_KEY.get(ICON_ALIASES[key]) ?? null : null)
  );
}

export function iconsByFamily(family: 'task' | 'reward'): IconEntry[] {
  return ICON_LIBRARY.filter((e) => e.family === family);
}
