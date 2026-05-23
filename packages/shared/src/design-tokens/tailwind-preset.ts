/**
 * Reco — Tailwind Preset.
 *
 * Drop this into `apps/web/tailwind.config.ts`:
 *
 *   import recoPreset from '@reco/shared/design-tokens/tailwind';
 *   export default { presets: [recoPreset], content: [...] };
 *
 * The preset extends Tailwind with Reco's locked tokens. App-level
 * tailwind configs should NEVER define their own colors/fonts/spacing —
 * always inherit from here so the brandbook stays the single source of truth.
 */

import { colors, fonts, fontSizes, radii, shadows, motion, spacing } from './tokens';

/**
 * Build the Tailwind preset object. Typed loosely as Record<string, unknown> so
 * we don't pull in Tailwind types into @reco/shared (they're large).
 */
export const recoTailwindPreset = {
  theme: {
    extend: {
      colors: {
        // Direct color tokens
        pink: colors.pink,
        'pink-dark': colors.pinkDark,
        'pink-pale': colors.pinkPale,
        'pink-soft': colors.pinkSoft,
        peach: colors.peach,
        'peach-pale': colors.peachPale,
        sky: colors.sky,
        'sky-dark': colors.skyDark,
        'sky-pale': colors.skyPale,
        'sky-soft': colors.skySoft,
        mint: colors.mint,
        'mint-dark': colors.mintDark,
        'mint-pale': colors.mintPale,
        'mint-soft': colors.mintSoft,
        yellow: colors.yellow,
        'yellow-dark': colors.yellowDark,
        'yellow-pale': colors.yellowPale,
        lavender: colors.lavender,
        'lavender-dark': colors.lavenderDark,
        'lavender-pale': colors.lavenderPale,
        'lavender-soft': colors.lavenderSoft,
        bg: colors.bg,
        card: colors.card,
        ink: colors.ink,
        'ink-soft': colors.inkSoft,
        'ink-faded': colors.inkFaded,
        rule: colors.rule,
        'rule-soft': colors.ruleSoft,
      },
      fontFamily: {
        'display-latin': fonts.displayLatin,
        'display-hebrew': fonts.displayHebrew,
        'body-latin': fonts.bodyLatin,
        'body-hebrew': fonts.bodyHebrew,
        numerals: fonts.numerals,
      },
      fontSize: {
        caption: fontSizes.caption,
        body: fontSizes.body,
        'body-md': fontSizes.bodyMd,
        'body-lg': fontSizes.bodyLg,
        subhead: fontSizes.subhead,
        title: fontSizes.title,
        'title-lg': fontSizes.titleLg,
        display: fontSizes.display,
        'display-lg': fontSizes.displayLg,
        'display-xl': fontSizes.displayXl,
        hero: fontSizes.hero,
      },
      borderRadius: {
        sm: radii.sm,
        md: radii.md,
        lg: radii.lg,
        xl: radii.xl,
        '2xl': radii['2xl'],
        '3xl': radii['3xl'],
      },
      boxShadow: {
        hairline: shadows.hairline,
        card: shadows.card,
        'cta-pink': shadows.ctaPink,
        'cta-mint': shadows.ctaMint,
        modal: shadows.modal,
      },
      transitionDuration: {
        fast: motion.durationFast,
        DEFAULT: motion.durationDefault,
        slow: motion.durationSlow,
        celebration: motion.durationCelebration,
      },
      transitionTimingFunction: {
        'ease-reco': motion.easeOut,
      },
      spacing: {
        // Only the values that aren't already in Tailwind's default scale
        // (Tailwind already has 0–96 in 4-unit steps; this is a no-op but
        //  documented here for explicit declaration of intent.)
      },
    },
  },
} as const;

export default recoTailwindPreset;
