/**
 * Splash intro — once-per-session launch animation for TasKidz.
 *
 * Sequence (Lily's spec):
 *   1. cycle — only the gold reward hexagon, centered, its emblem cycling
 *      through the seven rewards.
 *   2. dock  — the hexagon flies up to the logo's top-right corner and fades
 *      as the full TasKidz logo (monogram + wordmark) scales in beneath it, so
 *      the cycling icon "becomes" the gift badge of the finished logo.
 *   3. fade  — the whole overlay fades out and unmounts.
 *
 * Shown once per browser session (sessionStorage) and only after client mount
 * (no SSR flash). Respects prefers-reduced-motion by not showing at all.
 */

'use client';

import { useEffect, useState } from 'react';
import { RewardHex } from './reward-hex';
import { TasKidzLogo } from './taskidz-logo';

const SESSION_KEY = 'taskidz-splash-shown';

type Phase = 'hidden' | 'cycle' | 'dock' | 'fade';

const LOGO_H = 150;
const LOGO_W = Math.round(LOGO_H * (289 / 241));
const HEX = 104;

export function SplashIntro() {
  const [phase, setPhase] = useState<Phase>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    setPhase('cycle');
    const t1 = setTimeout(() => setPhase('dock'), 1700);
    const t2 = setTimeout(() => setPhase('fade'), 2350);
    const t3 = setTimeout(() => setPhase('hidden'), 2850);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (phase === 'hidden') return null;

  const docked = phase === 'dock' || phase === 'fade';

  return (
    <div
      aria-hidden="true"
      dir="ltr"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--bg, #FAF8F5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'fade' ? 0 : 1,
        transition: 'opacity .45s ease',
        pointerEvents: phase === 'fade' ? 'none' : 'auto',
      }}
    >
      <div style={{ position: 'relative', width: LOGO_W, height: LOGO_H }}>
        {/* Full logo — fades + scales in as the hex docks. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: docked ? 1 : 0,
            transform: docked ? 'scale(1)' : 'scale(.92)',
            transition: 'opacity .5s ease, transform .5s ease',
          }}
        >
          <TasKidzLogo height={LOGO_H} />
        </div>

        {/* Cycling gold hex — centered while cycling, then flies to the logo's
            gift corner (top-right) and fades out. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: docked
              ? `translate(-50%, -50%) translate(${0.235 * LOGO_W}px, ${-0.351 * LOGO_H}px) scale(${(0.2 * LOGO_W) / HEX})`
              : 'translate(-50%, -50%)',
            opacity: docked ? 0 : 1,
            transition: 'transform .6s cubic-bezier(.5,.05,.4,1), opacity .55s ease',
          }}
        >
          <RewardHex size={HEX} />
        </div>
      </div>
    </div>
  );
}
