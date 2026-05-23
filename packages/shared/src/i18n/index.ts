/**
 * @reco/shared/i18n
 *
 * Bilingual (Hebrew + English) dictionary infrastructure.
 * Hebrew is the default; English is the toggle.
 *
 * Usage from a Next.js Server Component:
 *
 *   import { getDictionary } from '@reco/shared/i18n';
 *   const t = await getDictionary(params.lang);
 *   <h1>{t.profilePicker.title}</h1>
 */

import type { Dictionary } from './types';
import heJson from './dictionaries/he.json' with { type: 'json' };
import enJson from './dictionaries/en.json' with { type: 'json' };

export type Locale = 'he' | 'en';
export const DEFAULT_LOCALE: Locale = 'he';
export const AVAILABLE_LOCALES: Locale[] = ['he', 'en'];

const dictionaries: Record<Locale, Dictionary> = {
  he: heJson as unknown as Dictionary,
  en: enJson as unknown as Dictionary,
};

export function getDictionary(locale: Locale | string | undefined): Dictionary {
  const safe = (
    locale && AVAILABLE_LOCALES.includes(locale as Locale) ? locale : DEFAULT_LOCALE
  ) as Locale;
  return dictionaries[safe];
}

export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

export type { Dictionary } from './types';
