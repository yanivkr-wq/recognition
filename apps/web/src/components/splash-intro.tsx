/**
 * Splash intro — once-per-session launch animation for Trophy.
 *
 * Sequence:
 *   1. show — the TrophyMark mounts centered + scales in (its inner hex
 *      cycles through the seven emblems on its own via RewardHex's CSS
 *      animation, so we don't need to orchestrate that here).
 *   2. fade — after the cycle has had time to show off, the whole overlay
 *      fades out and unmounts.
 *
 * Shown once per browser session (sessionStorage) and only after client mount
 * (no SSR flash). Respects prefers-reduced-motion by skipping the splash
 * entirely.
 */

'use client';

import { useEffect, useState } from 'react';
import { TrophyMark } from './trophy-mark';

const SESSION_KEY = 'trophy-splash-shown';

type Phase = 'hidden' | 'show' | 'fade';

const MARK_SIZE = 180;

export function SplashIntro() {
  const [phase, setPhase] = useState<Phase>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    setPhase('show');
    const t1 = setTimeout(() => setPhase('fade'), 2600);
    const t2 = setTimeout(() => setPhase('hidden'), 3100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === 'hidden') return null;

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
      <div
        style={{
          transform: phase === 'show' ? 'scale(1)' : 'scale(.92)',
          transition: 'transform .5s ease',
        }}
      >
        <TrophyMark size={MARK_SIZE} />
      </div>
    </div>
  );
}
