/**
 * Reco — Design Tokens (canonical TypeScript source)
 *
 * This file is the SINGLE SOURCE OF TRUTH for every visual primitive in Reco.
 * It encodes the locked BRANDBOOK.md v1.0 (2026-05-21) as immutable constants.
 *
 * Consumers:
 *   - Tailwind preset (./tailwind-preset.ts) — Reco's tailwind.config.ts extends from here.
 *   - CSS variables (./css-variables.ts) — generates the :root rule injected via globals.css.
 *   - Component code — imports specific tokens for inline styles where Tailwind utilities don't fit.
 *
 * RULE: Never edit colors/fonts/sizes in Tailwind configs or component CSS directly.
 * Always update this file FIRST, then propagate. Editing the brandbook also requires
 * updating /docs/BRANDBOOK.md (canonical spec) and bumping the version (see §14).
 */

// ──────────────────────────────────────────────────────────────────────────────
// COLOR TOKENS (BRANDBOOK §2)
// ──────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Brand · Pink (primary CTA, brand mark)
  pink: '#FF6B9D',
  pinkDark: '#E94B7F',
  pinkPale: '#FFE0EB',
  pinkSoft: '#FFF0F6',

  // Kid identity · Lia
  peach: '#FF9F7A',
  peachPale: '#FFE5D8',

  // Kid identity · Yael
  sky: '#6EC9F4',
  skyDark: '#3DA8DD',
  skyPale: '#DBEFFB',
  skySoft: '#EDF6FD',

  // Semantic · Success
  mint: '#4ED9A5',
  mintDark: '#2EB683',
  mintPale: '#D6F5E8',
  mintSoft: '#EBFAF3',

  // Semantic · Currency
  yellow: '#FFD75E',
  yellowDark: '#E8B927',
  yellowPale: '#FFF3D6',

  // Semantic · Campaigns / long-term
  lavender: '#B59FE5',
  lavenderDark: '#8B72CE',
  lavenderPale: '#ECE4F8',
  lavenderSoft: '#F6F1FC',

  // Surfaces
  bg: '#FAF8F5',
  card: '#FFFFFF',

  // Text · Ink scale
  ink: '#2D2A4A',
  inkSoft: '#6E6B89',
  inkFaded: '#A8A6BB',

  // Rules / hairlines
  rule: '#EFEDF5',
  ruleSoft: '#F7F5FA',
} as const;

export type ColorToken = keyof typeof colors;

// ──────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY TOKENS (BRANDBOOK §3)
// ──────────────────────────────────────────────────────────────────────────────

export const fonts = {
  // Latin display (Reco wordmark, English headlines, all numbers in tabular contexts)
  displayLatin: ['Fredoka', 'system-ui', 'sans-serif'],
  // Hebrew display (Hebrew headlines)
  displayHebrew: ['Heebo', 'system-ui', 'sans-serif'],
  // Latin body
  bodyLatin: ['Quicksand', 'Fredoka', 'system-ui', 'sans-serif'],
  // Hebrew body (same Heebo family at lighter weights)
  bodyHebrew: ['Heebo', 'system-ui', 'sans-serif'],
  // Tabular numerals — Heebo with font-feature-settings: 'tnum'
  numerals: ['Heebo', 'system-ui', 'sans-serif'],
} as const;

export const fontWeights = {
  // Fredoka uses 400–700 (display weights)
  fredokaRegular: 400,
  fredokaMedium: 500,
  fredokaSemibold: 600,
  fredokaBold: 700,
  // Heebo uses 300–900 (full range, including 900 for Hebrew display)
  heeboLight: 300,
  heeboRegular: 400,
  heeboMedium: 500,
  heeboSemibold: 600,
  heeboBold: 700,
  heeboExtrabold: 800,
  heeboBlack: 900,
  // Quicksand uses 400–700
  quicksandRegular: 400,
  quicksandMedium: 500,
  quicksandSemibold: 600,
  quicksandBold: 700,
} as const;

/**
 * Type scale (BRANDBOOK §3.2).
 * Use these for `font-size` in Tailwind config: `text-[size]` will inherit.
 */
export const fontSizes = {
  caption: '11px',
  bodySm: '12px',
  body: '13px',
  bodyMd: '14px',
  bodyLg: '15px',
  subheadSm: '16px',
  subhead: '18px',
  subheadLg: '20px',
  title: '22px',
  titleLg: '28px',
  display: '36px',
  displayLg: '44px',
  displayXl: '56px',
  hero: '72px',
  heroXl: '88px',
} as const;

export const lineHeights = {
  tight: 1.0,
  snug: 1.05,
  normal: 1.15,
  body: 1.4,
  relaxed: 1.5,
} as const;

export const letterSpacings = {
  tight: '-0.04em',
  snug: '-0.02em',
  normal: '-0.01em',
  wide: '0.04em',
  widest: '0.12em',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// SPACING TOKENS (BRANDBOOK §7.2)
// ──────────────────────────────────────────────────────────────────────────────
// Tailwind 4-unit-base; these are the values we deliberately use.

export const spacing = {
  '0': '0',
  px: '1px',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
  '20': '80px',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// BORDER RADIUS TOKENS (BRANDBOOK §7.4)
// ──────────────────────────────────────────────────────────────────────────────

export const radii = {
  none: '0',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  full: '9999px',
  phoneFrame: '44px', // visual-only phone-mockup radius
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// SHADOW ELEVATIONS (BRANDBOOK §7.5)
// ──────────────────────────────────────────────────────────────────────────────
// Never use solid black. All shadows tint with ink at low opacity.

export const shadows = {
  none: 'none',
  hairline: '0 1px 2px rgba(45, 42, 74, 0.05)',
  card: '0 4px 12px rgba(45, 42, 74, 0.06)',
  ctaPink: '0 4px 12px rgba(255, 107, 157, 0.35)',
  ctaMint: '0 4px 12px rgba(78, 217, 165, 0.30)',
  modal: '0 30px 80px rgba(45, 42, 74, 0.15)',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// ANIMATION TOKENS (BRANDBOOK §9)
// ──────────────────────────────────────────────────────────────────────────────

export const motion = {
  durationFast: '100ms',
  durationDefault: '150ms',
  durationSlow: '300ms',
  durationCelebration: '400ms',
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'ease',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// KID IDENTITY MAP (BRANDBOOK §2.2)
// ──────────────────────────────────────────────────────────────────────────────
// Single source of truth for which color belongs to which kid. Locked at
// install; do not change after.

export const kidIdentity = {
  lia: {
    name: 'Lia',
    nameHe: 'ליה',
    avatarSymbol: 'av-fox',
    primaryColor: colors.peach,
    palePale: colors.peachPale,
    surfaceTint: colors.peachPale,
  },
  yael: {
    name: 'Yael',
    nameHe: 'יעל',
    avatarSymbol: 'av-bunny',
    primaryColor: colors.sky,
    darkColor: colors.skyDark,
    pale: colors.skyPale,
    surfaceTint: colors.skySoft,
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// BADGE CATEGORY MAP (BRANDBOOK §5.5)
// ──────────────────────────────────────────────────────────────────────────────
// Maps each of the 8 locked badge emblems to its patch wrapper colors.
// `outerRing` = pastel solid for outer circle.
// `dashedBorder` = solid color for the inner field's dashed stitch.
// The inner field interior is always white with a soft pastel gradient.

export const badgeCategoryColors = {
  crown: { outerRing: colors.pinkPale, dashedBorder: colors.pink, ribbonTop: colors.pink },
  trophy: {
    outerRing: colors.yellowPale,
    dashedBorder: colors.yellowDark,
    ribbonTop: colors.yellowDark,
  },
  medal: { outerRing: colors.skyPale, dashedBorder: colors.sky, ribbonTop: colors.skyDark },
  diamond: { outerRing: colors.skyPale, dashedBorder: colors.skyDark, ribbonTop: colors.skyDark },
  cert: { outerRing: colors.peachPale, dashedBorder: colors.peach, ribbonTop: colors.peach },
  gift: {
    outerRing: colors.lavenderPale,
    dashedBorder: colors.lavender,
    ribbonTop: colors.lavenderDark,
  },
  star: { outerRing: colors.peachPale, dashedBorder: colors.peach, ribbonTop: colors.peach },
  torch: { outerRing: colors.yellowPale, dashedBorder: colors.peach, ribbonTop: colors.peach },
  // Locked / unearned state — gray
  locked: { outerRing: colors.rule, dashedBorder: colors.inkFaded, ribbonTop: colors.inkFaded },
} as const;

export type BadgeCategory = keyof typeof badgeCategoryColors;

// ──────────────────────────────────────────────────────────────────────────────
// SEMANTIC COLOR ROLES (BRANDBOOK §2.6)
// ──────────────────────────────────────────────────────────────────────────────
// "What color means what" — never repurpose.

export const semanticRoles = {
  action: colors.pink, // primary CTA, pending
  actionHover: colors.pinkDark,
  denial: colors.pinkDark, // never red; use pink-dark for kind denials
  success: colors.mint, // completed, received, approved
  successDark: colors.mintDark,
  currency: colors.yellow, // anything coin-related
  currencyDark: colors.yellowDark,
  campaign: colors.lavender, // long-term, campaigns, "magic"
  campaignDark: colors.lavenderDark,
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// BRANDBOOK METADATA
// ──────────────────────────────────────────────────────────────────────────────

export const brandbook = {
  version: '1.0',
  locked: '2026-05-21',
  concept: 'Plush',
  badgeArchitecture: 'Embroidered Patch',
} as const;
