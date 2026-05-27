/**
 * Interactive multi-player trend chart (Lily: "show the graph for each player,
 * and hovering a date shows a tooltip of the number").
 *
 * One coloured line per player over the 14-day window. Hovering anywhere on the
 * plot snaps to the nearest day, draws a guide line + a dot per player, and pops
 * a tooltip listing the date and each player's value. Pure inline SVG + a little
 * client state — no chart library.
 *
 * Forced dir="ltr" so the time axis always reads oldest → newest, even in RTL.
 */

'use client';

import { useRef, useState } from 'react';

export interface PlayerSeries {
  name: string;
  color: string;
  values: number[];
}

const W = 320;
const H = 132;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 16;

export function TrendChart({
  title,
  total,
  labels,
  series,
  lang,
}: {
  title: string;
  total: number;
  labels: string[]; // ISO yyyy-mm-dd
  series: PlayerSeries[];
  lang: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => (n <= 1 ? PAD_X : PAD_X + (i * (W - PAD_X * 2)) / (n - 1));
  const y = (v: number) => H - PAD_BOTTOM - (v / max) * (H - PAD_TOP - PAD_BOTTOM);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso + 'T00:00:00'));

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1))));
    setHover(idx);
  };

  const hoverPctX = hover != null && n > 1 ? (hover / (n - 1)) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <span className="text-sm font-bold text-ink">{title}</span>
        <span className="num text-lg font-extrabold text-ink" dir="ltr">
          {total.toLocaleString('en-US')}
        </span>
      </div>

      <div
        ref={wrapRef}
        dir="ltr"
        className="relative"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
          {/* baseline */}
          <line x1={PAD_X} y1={H - PAD_BOTTOM} x2={W - PAD_X} y2={H - PAD_BOTTOM} stroke="#E7E1DA" strokeWidth={1} />
          {/* hover guide */}
          {hover != null && (
            <line x1={x(hover)} y1={PAD_TOP} x2={x(hover)} y2={H - PAD_BOTTOM} stroke="#CFC9D6" strokeWidth={1} strokeDasharray="3 3" />
          )}
          {series.map((s) => (
            <polyline
              key={s.name}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* dots at hovered day */}
          {hover != null &&
            series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={3.5} fill={s.color} />
            ))}
        </svg>

        {/* axis ticks */}
        <div className="flex justify-between text-[10px] text-ink-faded num mt-0.5">
          <span>{fmt(labels[0] ?? '')}</span>
          <span>{fmt(labels[n - 1] ?? '')}</span>
        </div>

        {/* tooltip */}
        {hover != null && (
          <div
            className="absolute -top-1 z-10 -translate-x-1/2 pointer-events-none bg-ink text-card rounded-lg px-2.5 py-1.5 shadow-modal text-[11px] whitespace-nowrap"
            style={{ left: `${hoverPctX}%` }}
          >
            <p className="num font-bold mb-0.5" dir="ltr">{fmt(labels[hover] ?? '')}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span>{s.name}</span>
                <span className="num font-bold ms-auto ps-2" dir="ltr">{s.values[hover] ?? 0}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
