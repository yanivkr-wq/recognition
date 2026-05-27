/**
 * Splash intro — a short, once-per-session launch animation.
 *
 * Reads as the "RECO" wordmark: the letters REC followed by the embroidered
 * patch standing in for the "o", its stitched ring slowly turning while the
 * emblem inside cycles through what kids earn (coin → star → trophy → crown →
 * gift → medal), on the themed background. Fades out after ~2s and unmounts so
 * it never blocks interaction.
 *
 * Shown once per browser session (sessionStorage gate) and only after client
 * mount (no SSR flash). Respects prefers-reduced-motion by not showing at all.
 * Keyframes live in a scoped <style> tag so we don't touch globals.css.
 */

'use client';

import { useEffect, useState } from 'react';

const SESSION_KEY = 'reco-splash-shown';

type Phase = 'hidden' | 'show' | 'fade';

export function SplashIntro() {
  const [phase, setPhase] = useState<Phase>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    setPhase('show');
    const t1 = setTimeout(() => setPhase('fade'), 2000);
    const t2 = setTimeout(() => setPhase('hidden'), 2480);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--bg, #FAF8F5)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: phase === 'fade' ? 0 : 1,
        transition: 'opacity .45s ease',
        pointerEvents: phase === 'fade' ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes recoSplashSpin { to { transform: rotate(360deg); } }
        @keyframes recoSplashCyc {
          0%   { opacity: 0; transform: scale(.5) rotate(-10deg); }
          5%   { opacity: 1; transform: scale(1) rotate(0); }
          14%  { opacity: 1; transform: scale(1) rotate(0); }
          19%  { opacity: 0; transform: scale(.5) rotate(10deg); }
          100% { opacity: 0; transform: scale(.5); }
        }
        @keyframes recoSplashRise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reco-splash-patch {
          width: 84px; height: 84px; border-radius: 30%;
          background: var(--pink-soft, #FFF0F6); position: relative;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 12px 28px rgba(45,42,74,.16);
          animation: recoSplashRise .5s ease both;
        }
        .reco-splash-ring {
          position: absolute; inset: 12px; border-radius: 50%;
          border: 3px dashed var(--pink, #FF6B9D); animation: recoSplashSpin 3.2s linear infinite;
        }
        .reco-splash-glyphs { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .reco-splash-glyph { position: absolute; width: 52%; height: 52%; opacity: 0; animation: recoSplashCyc 2.4s ease-in-out infinite; }
        .reco-splash-glyph:nth-child(1) { animation-delay: 0s; }
        .reco-splash-glyph:nth-child(2) { animation-delay: .4s; }
        .reco-splash-glyph:nth-child(3) { animation-delay: .8s; }
        .reco-splash-glyph:nth-child(4) { animation-delay: 1.2s; }
        .reco-splash-glyph:nth-child(5) { animation-delay: 1.6s; }
        .reco-splash-glyph:nth-child(6) { animation-delay: 2.0s; }
        .reco-splash-glyph svg { width: 100%; height: 100%; display: block; }
        .reco-splash-word {
          font-family: var(--font-fredoka), system-ui, sans-serif;
          font-weight: 700; font-size: 64px; letter-spacing: -.03em; color: var(--pink, #FF6B9D);
          line-height: 1;
          animation: recoSplashRise .5s .12s ease both;
        }
      `}</style>

      {/* The mark reads as "RECO": the letters REC followed by the spinning
          patch standing in for the "o" (its emblem cycles through rewards). */}
      <div className="reco-splash-word" dir="ltr">REC</div>
      <div className="reco-splash-patch">
        <span className="reco-splash-ring" />
        <span className="reco-splash-glyphs">
          <span className="reco-splash-glyph">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#FFD75E" stroke="#E8B927" strokeWidth="2" /><path d="M12 5.4l1.9 3.9 4.3.6-3.1 3 .7 4.3L12 15.1 8.2 17.2l.7-4.3-3.1-3 4.3-.6z" fill="#fff" /></svg>
          </span>
          <span className="reco-splash-glyph">
            <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 18.9 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="#FF6B9D" /></svg>
          </span>
          <span className="reco-splash-glyph">
            <svg viewBox="0 0 24 24" fill="#FFD75E" stroke="#E8B927" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M8 5.5H5.5C5 8 6 9.5 8 9.5M16 5.5h2.5C19 8 18 9.5 16 9.5" fill="none" /><path d="M12 12v3M9.5 18h5" fill="none" /><path d="M10 15h4v3h-4z" /></svg>
          </span>
          <span className="reco-splash-glyph">
            <svg viewBox="0 0 24 24" fill="#FF6B9D" stroke="#E94B7F" strokeWidth="1.4" strokeLinejoin="round"><path d="M5 18h14l1.3-9.2-4.3 3.1L12 5.6 8 11.9 3.7 8.8z" /></svg>
          </span>
          <span className="reco-splash-glyph">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8B72CE" strokeWidth="2" strokeLinejoin="round"><rect x="4" y="9" width="16" height="11" rx="1" fill="#ECE4F8" /><path d="M3 9h18v3.5H3zM12 9v11" /><path d="M12 9C12 6.5 9.5 4.5 8.3 6S9.8 9 12 9zM12 9c0-2.5 2.5-4.5 3.7-3S14.2 9 12 9z" /></svg>
          </span>
          <span className="reco-splash-glyph">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3DA8DD" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M8.5 3l2.5 5M15.5 3l-2.5 5" /><circle cx="12" cy="14.5" r="5.5" fill="#6EC9F4" /><circle cx="12" cy="14.5" r="2" fill="#fff" stroke="none" /></svg>
          </span>
        </span>
      </div>
    </div>
  );
}
