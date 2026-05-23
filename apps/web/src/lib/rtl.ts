/**
 * RTL-aware arrow glyphs (Lily's Fix 3).
 *
 * Hebrew reads right-to-left, so the visual meaning of `←` and `→` is the
 * opposite of LTR languages:
 *   - "Back" / "previous" naturally points toward where the reader came
 *     from → that's RIGHT in Hebrew, LEFT in English.
 *   - "Forward" / "next" naturally points where the reader is going →
 *     LEFT in Hebrew, RIGHT in English.
 *
 * This pair of one-line helpers keeps every CTA + back link visually
 * correct in both languages without scattering ternaries.
 */

export type Locale = 'he' | 'en';

export function arrowBack(lang: Locale): string {
  return lang === 'he' ? '→' : '←';
}

export function arrowForward(lang: Locale): string {
  return lang === 'he' ? '←' : '→';
}
