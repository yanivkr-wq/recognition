/**
 * Admin console — grouped, icon-led landing (2026-05-27 redesign, Lily's
 * request: "add icons + reorder so it's easier to manage").
 *
 * The 11 destinations are grouped by how an admin actually works:
 *   • Overview — the at-a-glance hub + the two action queues you check daily
 *     (insights, approvals, redemptions).
 *   • Players — who plays + talking to them (players, messages).
 *   • Content — the things you author (tasks, rewards, journeys, badges).
 *   • System — the record + the inbox (audit, feedback).
 *
 * Each card carries a monochrome line icon on a group-tinted chip. Icons are
 * inline SVG (currentColor) per BRANDBOOK §4 — no emoji glyphs. Server
 * component: pure Links + SVG, zero client JS.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { auth } from '../../../auth';

export const dynamic = 'force-dynamic';

type IconName =
  | 'insights'
  | 'approvals'
  | 'redemptions'
  | 'players'
  | 'messages'
  | 'tasks'
  | 'rewards'
  | 'campaigns'
  | 'badges'
  | 'audit'
  | 'feedback';

/** Group accent → chip bg + icon color (brandbook pastels). */
type Tone = 'pink' | 'sky' | 'lavender' | 'neutral';
const TONE: Record<Tone, { chip: string; ink: string }> = {
  pink: { chip: 'bg-pink-pale', ink: 'text-pink-dark' },
  sky: { chip: 'bg-sky-pale', ink: 'text-sky-dark' },
  lavender: { chip: 'bg-lavender-pale', ink: 'text-lavender-dark' },
  neutral: { chip: 'bg-bg', ink: 'text-ink-soft' },
};

export default async function AdminHome({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const groups: {
    title: string;
    tone: Tone;
    items: { href: string; icon: IconName; label: string; sub: string }[];
  }[] = [
    {
      title: t.admin.groupOverview,
      tone: 'pink',
      items: [
        { href: 'insights', icon: 'insights', label: t.admin.insights, sub: t.insights.heading },
        { href: 'approvals', icon: 'approvals', label: t.admin.approvals, sub: t.admin.approvalsHeading },
        { href: 'redemptions', icon: 'redemptions', label: t.admin.redemptions, sub: t.admin.redemptionsHeading },
      ],
    },
    {
      title: t.admin.groupPlayers,
      tone: 'sky',
      items: [
        { href: 'kids', icon: 'players', label: t.admin.kids, sub: `${t.admin.setPin} · ${t.admin.ledger}` },
        { href: 'messages', icon: 'messages', label: t.admin.messages, sub: t.playerMsg.heading },
      ],
    },
    {
      title: t.admin.groupContent,
      tone: 'lavender',
      items: [
        { href: 'tasks', icon: 'tasks', label: t.admin.tasksHeading, sub: `${t.admin.newTask} · ${t.admin.assignments}` },
        { href: 'rewards', icon: 'rewards', label: t.admin.rewards, sub: t.admin.rewardsHeading },
        { href: 'campaigns', icon: 'campaigns', label: t.admin.campaigns, sub: t.admin.campaignsHeading },
        { href: 'badges', icon: 'badges', label: t.admin.badges, sub: t.admin.badgesHeading },
      ],
    },
    {
      title: t.admin.groupSystem,
      tone: 'neutral',
      items: [
        { href: 'audit', icon: 'audit', label: t.admin.audit, sub: t.admin.auditHeading },
        { href: 'feedback', icon: 'feedback', label: t.admin.feedback, sub: t.feedback.heading },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">{t.admin.title}</h1>

      {groups.map((g) => {
        const tone = TONE[g.tone];
        return (
          <section key={g.title} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
              {g.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={`/${lang}/admin/${item.href}`}
                  className="group flex items-center gap-3 bg-card rounded-2xl shadow-card border border-rule p-4 hover:-translate-y-px hover:border-pink-pale transition"
                >
                  <span
                    className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${tone.chip} ${tone.ink}`}
                    aria-hidden="true"
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-ink leading-tight truncate">
                      {item.label}
                    </span>
                    <span className="block text-xs text-ink-soft leading-snug truncate">
                      {item.sub}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Monochrome 22px line icons (currentColor). Kept inline so the console has
 *  no extra import surface; they're admin-only and not part of the kid icon
 *  library. */
function NavIcon({ name }: { name: IconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'insights':
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" />
        </svg>
      );
    case 'approvals':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      );
    case 'redemptions':
      return (
        <svg {...common}>
          <rect x="4" y="9" width="16" height="11" rx="1.5" />
          <path d="M3 9h18M12 9v11" />
          <path d="M12 9c0-2.2-1.8-3.5-3-2.4S10.2 9 12 9zM12 9c0-2.2 1.8-3.5 3-2.4S13.8 9 12 9z" />
        </svg>
      );
    case 'players':
      return (
        <svg {...common}>
          <circle cx="8.5" cy="8" r="3" />
          <circle cx="16.5" cy="9.5" r="2.4" />
          <path d="M3.5 19c0-2.8 2.2-5 5-5s5 2.2 5 5M14.5 19c0-2 .8-3.6 2-4.4" />
        </svg>
      );
    case 'messages':
      return (
        <svg {...common}>
          <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16H9l-4 3v-3a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5Z" />
        </svg>
      );
    case 'tasks':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 3.5h6v2.5H9zM8.5 11l1.5 1.5 2.5-3M8.5 16l1.5 1.5 2.5-3" />
        </svg>
      );
    case 'rewards':
      return (
        <svg {...common}>
          <path d="M4 7.5 11 4l9 3.2v4.3c0 4.5-3.5 7-9 8.5-5.5-1.5-7-4-7-8.5z" />
          <path d="M9.5 11.5l1.7 1.7 3.3-3.7" />
        </svg>
      );
    case 'campaigns':
      return (
        <svg {...common}>
          <path d="M6 21V4M6 5h11l-2 3 2 3H6" />
        </svg>
      );
    case 'badges':
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="M9 13.5 7.5 21l4.5-2.4L16.5 21 15 13.5" />
        </svg>
      );
    case 'audit':
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v14H6zM14 3v5h5" />
          <path d="M9 13h6M9 17h4" />
        </svg>
      );
    case 'feedback':
      return (
        <svg {...common}>
          <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />
        </svg>
      );
  }
}
