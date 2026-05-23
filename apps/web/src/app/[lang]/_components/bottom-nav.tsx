/**
 * Sticky bottom nav for kid surfaces (Lily's Fix 7).
 *
 * Five thumb-tappable items pinned to the bottom of the viewport, with the
 * current path highlighted in pink. Mirrors every kid-app on the planet:
 * home / shop / quests / badges / wallet. The bell stays in the header.
 *
 * Why a fixed bottom bar over a top tab strip:
 *   - One-handed phone use: kid's thumb naturally rests at the bottom.
 *   - The wallet hero already dominates the top — adding tabs there fights
 *     for the same attention.
 *
 * Safe-area inset for iOS notch via `pb-[env(safe-area-inset-bottom)]`.
 *
 * Active highlight uses `usePathname()` and matches by suffix so locale
 * prefixes (/he/, /en/) don't trip the comparison. Each Reco kid page
 * adds a `pb-28` to its outermost main so the bar doesn't cover content.
 */

'use client';

import { usePathname } from 'next/navigation';
import { getIcon } from '../../../components/icon-library';
import type { Dictionary } from '@reco/shared/i18n';

interface Item {
  key: string;
  href: string;
  /** Used to derive "active" state — current pathname must end with this
   *  string (or equal it, for `/`). */
  matchSuffix: string;
  iconKey: string;
  label: string;
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
}

export function BottomNav({ lang, t }: Props) {
  const pathname = usePathname();
  const items: Item[] = [
    { key: 'home', href: `/${lang}`, matchSuffix: `/${lang}`, iconKey: 'ic-house', label: t.nav.home },
    { key: 'shop', href: `/${lang}/redeem`, matchSuffix: '/redeem', iconKey: 'ic-shop', label: t.nav.shop },
    { key: 'quests', href: `/${lang}/campaigns`, matchSuffix: '/campaigns', iconKey: 'ic-quest-climb', label: t.nav.campaigns },
    { key: 'badges', href: `/${lang}/badges`, matchSuffix: '/badges', iconKey: 'ic-medal', label: t.nav.badges },
    { key: 'wallet', href: `/${lang}/wallet`, matchSuffix: '/wallet', iconKey: 'ic-wallet', label: t.nav.wallet },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-rule shadow-[0_-2px_8px_rgba(45,42,74,0.05)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="ניווט תחתון"
    >
      <ul className="flex items-stretch justify-around px-2 py-1.5">
        {items.map((item) => {
          const isActive =
            item.matchSuffix === `/${lang}`
              ? pathname === `/${lang}` || pathname === `/${lang}/`
              : pathname.endsWith(item.matchSuffix) || pathname.includes(`${item.matchSuffix}/`);
          const entry = getIcon(item.iconKey);
          return (
            <li key={item.key} className="flex-1">
              <a
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition ${
                  isActive
                    ? 'text-pink-dark bg-pink-soft'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {entry ? <entry.Component size={22} /> : null}
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
