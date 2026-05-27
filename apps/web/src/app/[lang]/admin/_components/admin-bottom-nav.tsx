/**
 * Admin bottom nav — app-style footer tabs for the day-to-day destinations
 * (Lily: "add a footer menu with the most relevant pages, make insights the
 * main admin page").
 *
 * Five tabs: Insights (home) · Approvals · Players · Rewards · More. "More"
 * opens the full section directory (/admin/menu). Neutral monochrome styling
 * (Option C): slate for the active tab, ink-soft otherwise. Fixed to the
 * bottom; the admin layout adds matching bottom padding so content clears it.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { seg: string; href: string; label: string; icon: React.ReactNode };

const ic = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function AdminBottomNav({
  lang,
  labels,
}: {
  lang: string;
  labels: { insights: string; approvals: string; players: string; rewards: string; more: string };
}) {
  const pathname = usePathname() ?? '';
  const base = `/${lang}/admin`;

  const tabs: Tab[] = [
    {
      seg: 'insights',
      href: `${base}/insights`,
      label: labels.insights,
      icon: <svg {...ic}><path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" /></svg>,
    },
    {
      seg: 'approvals',
      href: `${base}/approvals`,
      label: labels.approvals,
      icon: <svg {...ic}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>,
    },
    {
      seg: 'kids',
      href: `${base}/kids`,
      label: labels.players,
      icon: <svg {...ic}><circle cx="8.5" cy="8" r="3" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M3.5 19c0-2.8 2.2-5 5-5s5 2.2 5 5M14.5 19c0-2 .8-3.6 2-4.4" /></svg>,
    },
    {
      seg: 'rewards',
      href: `${base}/rewards`,
      label: labels.rewards,
      icon: <svg {...ic}><path d="M4 7.5 11 4l9 3.2v4.3c0 4.5-3.5 7-9 8.5-5.5-1.5-7-4-7-8.5z" /><path d="M9.5 11.5l1.7 1.7 3.3-3.7" /></svg>,
    },
    {
      seg: 'menu',
      href: `${base}/menu`,
      label: labels.more,
      icon: <svg {...ic}><circle cx="5" cy="6" r="1.4" /><circle cx="5" cy="12" r="1.4" /><circle cx="5" cy="18" r="1.4" /><path d="M9 6h11M9 12h11M9 18h11" /></svg>,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-rule"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Admin"
    >
      <ul className="max-w-4xl mx-auto flex">
        {tabs.map((tab) => {
          // /admin (no sub-segment) and /admin/insights both light the Insights
          // tab; otherwise match the leading segment of the current path.
          const active =
            tab.seg === 'insights'
              ? pathname === base || pathname.startsWith(`${base}/insights`)
              : pathname.startsWith(`${base}/${tab.seg}`);
          return (
            <li key={tab.seg} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
                  active ? 'text-ink' : 'text-ink-faded hover:text-ink-soft'
                }`}
              >
                {tab.icon}
                <span className="truncate max-w-full px-1">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
