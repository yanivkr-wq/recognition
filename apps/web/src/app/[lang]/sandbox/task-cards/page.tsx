/**
 * Sandbox preview: 3 task-card layout variants stacked for direct comparison.
 *
 * Each variant renders the SAME three sample tasks (short / medium / long
 * Hebrew title) so the visual differences are about layout, not content.
 * No DB, no auth — pure static page for Lily to pick which redesign to ship
 * to the real kid-home.
 *
 * After Lily picks, this file gets deleted along with the rest of the
 * /sandbox/ tree.
 */

import { getDictionary, type Locale } from '@reco/shared/i18n';
import { TaskIcon } from '../../../../components/task-icon';
import { Coin } from '../../../../components/coin';

export const dynamic = 'force-dynamic';

interface SampleTask {
  title: string;
  iconKey: string;
  color: string;
  coinValue: number;
}

const SAMPLES: SampleTask[] = [
  // Short title — current layout handles this fine.
  { title: 'לצחצח שיניים', iconKey: 'ic-tooth', color: '#DBEFFB', coinValue: 5 },
  // Medium — gets truncated to ~6-8 chars in the current design.
  { title: 'להציע את המיטה בבוקר', iconKey: 'ic-bed', color: '#FFE5D8', coinValue: 5 },
  // Long — completely unreadable in the current truncating design.
  { title: 'לעזור לאחות הקטנה בלימודים', iconKey: 'ic-pet', color: '#EBFAF3', coinValue: 25 },
];

export default async function TaskCardsSandboxPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  void t; // not used in preview but kept for parity

  return (
    <main className="min-h-screen bg-bg pb-12">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">השוואת עיצובים — כרטיס משימה</h1>
          <p className="text-sm text-ink-soft">
            שלוש אפשרויות לתצוגת כרטיס המשימה. אותן שלוש משימות בכל מקרה — קצרה, בינונית, ארוכה.
            תגידי לי איזה אות (A / B / C) הכי אהבת ואני אעשה את ההחלפה בקוד.
          </p>
        </header>

        {/* ─── VARIANT A — Allow title to wrap to 2 lines ─────────────── */}
        <section>
          <h2 className="text-lg font-bold text-ink mb-2">
            A · שורה נוכחית + גלישת כותרת ל-2 שורות
          </h2>
          <p className="text-xs text-ink-soft mb-3">
            השינוי הכי קטן. אותו פריסה אופקית, רק שהכותרת מותרת לגלוש לשורה שנייה במקום להיחתך.
          </p>
          <div className="space-y-3">
            {SAMPLES.map((s, i) => (
              <VariantA key={i} sample={s} />
            ))}
          </div>
        </section>

        {/* ─── VARIANT B — Title row + meta row ───────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-ink mb-2">
            B · כותרת בשורה נפרדת + שורת אייקון/מטבעות/כפתור מתחת
          </h2>
          <p className="text-xs text-ink-soft mb-3">
            הכותרת תופסת את כל רוחב הכרטיס. אייקון, מטבעות וכפתור „סיימתי!" מתחת.
          </p>
          <div className="space-y-3">
            {SAMPLES.map((s, i) => (
              <VariantB key={i} sample={s} />
            ))}
          </div>
        </section>

        {/* ─── VARIANT C — Compact icon + 2-line title + bottom action ── */}
        <section>
          <h2 className="text-lg font-bold text-ink mb-2">
            C · אייקון קטן ליד הכותרת + שורת פעולה תחתונה
          </h2>
          <p className="text-xs text-ink-soft mb-3">
            אייקון קטן בתוך השורה הראשונה, כותרת ב-2 שורות מקסימום. מטבעות וכפתור על פס תחתון.
          </p>
          <div className="space-y-3">
            {SAMPLES.map((s, i) => (
              <VariantC key={i} sample={s} />
            ))}
          </div>
        </section>

        <footer className="text-center text-xs text-ink-faded pt-6">
          ✦ אחרי שתבחרי את האות, אפשר למחוק את העמוד הזה ✦
        </footer>
      </div>
    </main>
  );
}

// ─── Variant A — 2-line title wrap, otherwise identical to current ──────
function VariantA({ sample }: { sample: SampleTask }) {
  return (
    <div className="rounded-2xl border border-rule shadow-card bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <TaskIcon iconKey={sample.iconKey} color={sample.color} title={sample.title} />
        </div>
        <div className="flex-1 min-w-0">
          {/* The ONLY change vs current: removed `truncate`, added line-clamp-2 */}
          <h3 className="font-bold text-ink text-[15px] leading-snug line-clamp-2">
            {sample.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CoinChip n={sample.coinValue} />
          <DoneButton />
        </div>
      </div>
    </div>
  );
}

// ─── Variant B — title row + meta row ───────────────────────────────────
function VariantB({ sample }: { sample: SampleTask }) {
  return (
    <div className="rounded-2xl border border-rule shadow-card bg-card p-4 space-y-3">
      {/* Top row: full-width title */}
      <h3 className="font-bold text-ink text-base leading-snug">{sample.title}</h3>
      {/* Bottom row: icon, coin, done */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TaskIcon iconKey={sample.iconKey} color={sample.color} title={sample.title} />
          <CoinChip n={sample.coinValue} />
        </div>
        <DoneButton />
      </div>
    </div>
  );
}

// ─── Variant C — small icon + 2-line title + bottom action bar ──────────
function VariantC({ sample }: { sample: SampleTask }) {
  return (
    <div className="rounded-2xl border border-rule shadow-card bg-card overflow-hidden">
      {/* Top: small icon chip + 2-line title */}
      <div className="p-4 flex items-start gap-2">
        <span
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: sample.color }}
        >
          <TaskIconSmall iconKey={sample.iconKey} title={sample.title} />
        </span>
        <h3 className="flex-1 font-bold text-ink text-[15px] leading-snug line-clamp-2">
          {sample.title}
        </h3>
      </div>
      {/* Bottom bar: coin + done */}
      <div className="px-4 pb-3 flex items-center justify-between border-t border-rule pt-3">
        <CoinChip n={sample.coinValue} />
        <DoneButton />
      </div>
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────────────────────
function CoinChip({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold num bg-yellow-pale text-[#7A5D10]">
      <Coin size={14} />
      <span dir="ltr">{n}</span>
    </span>
  );
}

function DoneButton() {
  return (
    <span className="bg-pink text-card font-bold rounded-full py-2 px-4 text-xs shadow-cta-pink whitespace-nowrap">
      סיימתי!
    </span>
  );
}

// Small inline icon variant for VariantC's 36×36 chip (matches the regular
// TaskIcon's grammar but renders at size 22 instead of the default).
function TaskIconSmall(props: { iconKey: string; title: string }) {
  return <TaskIcon iconKey={props.iconKey} color="transparent" title={props.title} />;
}
