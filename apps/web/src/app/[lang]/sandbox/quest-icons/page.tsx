/**
 * Sandbox preview — 3 quest icon options for Lily's Fix 2.
 * Throwaway page; delete after the call is made.
 */

import { getIcon } from '../../../../components/icon-library';

const OPTIONS = [
  { key: 'ic-quest-climb', label: 'D · Climber (mountain + flag)' },
  { key: 'ic-quest-pathway', label: 'A · Pathway (winding road)' },
  { key: 'ic-quest-flag', label: 'B · Finish-line flag' },
  { key: 'ic-quest-compass', label: 'C · Compass' },
  { key: 'ic-quest', label: 'Current (star/sparkle)' },
];

export default function QuestIconPreview() {
  return (
    <main className="min-h-screen bg-bg p-8">
      <h1 className="text-2xl font-bold text-ink mb-2">Quest icon options</h1>
      <p className="text-sm text-ink-soft mb-8">
        Tap the option you prefer. I'll rebind the bottom-nav + admin
        campaign chip to the chosen icon.
      </p>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {OPTIONS.map((o) => {
          const entry = getIcon(o.key);
          return (
            <li
              key={o.key}
              className="bg-card rounded-2xl border border-rule p-5 flex flex-col items-center gap-3"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center bg-lavender-soft text-lavender-dark"
                aria-hidden="true"
              >
                {entry ? <entry.Component size={48} /> : null}
              </div>
              <p className="text-xs font-bold text-ink text-center">{o.label}</p>
              {/* Also show in bottom-nav pill style so you can see it active. */}
              <div className="w-full flex flex-col items-center gap-0.5 py-1.5 rounded-xl bg-pink-soft text-pink-dark">
                {entry ? <entry.Component size={22} /> : null}
                <span className="text-[10px] font-bold leading-none">מסעות</span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
