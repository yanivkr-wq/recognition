/**
 * Admin notification bell (Lily's request: "a bell with a count of things I
 * need to approve, like a normal app").
 *
 * Renders a bell button with an app-style count badge, plus a dropdown that
 * breaks the total down into Approvals / Redemptions / Feedback, each linking
 * to its admin page. The initial counts are server-rendered (no flash of 0);
 * after that the component polls /api/admin/notifications every 30s and on tab
 * refocus so the badge stays live without a manual refresh.
 *
 * Pure client state — no writes. Clicking a row navigates and closes the menu.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AdminNotificationCounts } from '../../../../lib/admin/notifications';

interface Labels {
  notifications: string;
  approvals: string;
  redemptions: string;
  feedback: string;
  allCaughtUp: string;
}

export function AdminBell({
  lang,
  initial,
  labels,
}: {
  lang: string;
  initial: AdminNotificationCounts;
  labels: Labels;
}) {
  const [counts, setCounts] = useState<AdminNotificationCounts>(initial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Poll for fresh counts every 30s + whenever the tab regains focus.
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as AdminNotificationCounts;
        if (alive) setCounts(data);
      } catch {
        // Network blips are non-fatal — keep the last known counts.
      }
    };
    const id = setInterval(refresh, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const total = counts.total;
  const badge = total > 99 ? '99+' : String(total);

  const rows: { key: string; label: string; n: number; href: string }[] = [
    { key: 'approvals', label: labels.approvals, n: counts.approvals, href: `/${lang}/admin/approvals` },
    { key: 'redemptions', label: labels.redemptions, n: counts.redemptions, href: `/${lang}/admin/redemptions` },
    { key: 'feedback', label: labels.feedback, n: counts.feedback, href: `/${lang}/admin/feedback` },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${labels.notifications}${total > 0 ? ` (${total})` : ''}`}
        aria-expanded={open}
        className="relative grid place-items-center w-9 h-9 rounded-full text-ink-soft hover:bg-rule-soft hover:text-ink transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.7 21a2 2 0 0 1-3.4 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {total > 0 && (
          <span
            className="num absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-pink text-card text-[10px] font-bold leading-none ring-2 ring-card"
            dir="ltr"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute end-0 mt-2 w-64 bg-card rounded-2xl border border-rule shadow-modal overflow-hidden z-50"
          role="menu"
        >
          <p className="text-[11px] uppercase tracking-wider font-bold text-ink-soft px-4 pt-3 pb-2">
            {labels.notifications}
          </p>
          {total === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-soft">{labels.allCaughtUp}</p>
          ) : (
            <ul className="pb-1">
              {rows
                .filter((r) => r.n > 0)
                .map((r) => (
                  <li key={r.key}>
                    <Link
                      href={r.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-rule-soft transition"
                    >
                      <span className="text-sm text-ink">{r.label}</span>
                      <span
                        className="num min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-pink-pale text-pink-dark text-xs font-bold"
                        dir="ltr"
                      >
                        {r.n}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
