/**
 * RecoWordmark — the animated logotype: "Rec" + a round "o" slot whose icon
 * cycles through 7 rounded emblems (coin, star, trophy, crown, gift, medal,
 * heart). The "o" of Reco is replaced by a rotating icon (Lily's request).
 *
 * Pure CSS animation in a scoped <style> tag (no globals.css change). The
 * wrapper carries aria-label="Reco" and the moving parts are aria-hidden so
 * screen readers still read the brand name. Sizing is driven by font-size:
 * the o-slot + glyphs scale in em units. Respects prefers-reduced-motion
 * (icons hold on the first emblem).
 *
 * 'use client' only because the keyframes live inline; there are no hooks, so
 * it's cheap to drop anywhere.
 */

'use client';

const GLYPHS = [
  // coin
  <svg key="coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#FFD75E" stroke="#E8B927" strokeWidth="2" /><path d="M12 5.4l1.9 3.9 4.3.6-3.1 3 .7 4.3L12 15.1 8.2 17.2l.7-4.3-3.1-3 4.3-.6z" fill="#fff" /></svg>,
  // star (themed: follows the wordmark's accent color)
  <svg key="star" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 18.9 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor" /></svg>,
  // trophy
  <svg key="trophy" viewBox="0 0 24 24" fill="#FFD75E" stroke="#E8B927" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M8 5.5H5.5C5 8 6 9.5 8 9.5M16 5.5h2.5C19 8 18 9.5 16 9.5" fill="none" /><path d="M12 12v3M9.5 18h5" fill="none" /><path d="M10 15h4v3h-4z" /></svg>,
  // crown (themed)
  <svg key="crown" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M5 18h14l1.3-9.2-4.3 3.1L12 5.6 8 11.9 3.7 8.8z" /></svg>,
  // gift
  <svg key="gift" viewBox="0 0 24 24" fill="none" stroke="#8B72CE" strokeWidth="2" strokeLinejoin="round"><rect x="4" y="9" width="16" height="11" rx="1" fill="#ECE4F8" /><path d="M3 9h18v3.5H3zM12 9v11" /><path d="M12 9C12 6.5 9.5 4.5 8.3 6S9.8 9 12 9zM12 9c0-2.5 2.5-4.5 3.7-3S14.2 9 12 9z" /></svg>,
  // medal
  <svg key="medal" viewBox="0 0 24 24" fill="none" stroke="#3DA8DD" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><path d="M8.5 3l2.5 5M15.5 3l-2.5 5" /><circle cx="12" cy="14.5" r="5.5" fill="#6EC9F4" /><circle cx="12" cy="14.5" r="2" fill="#fff" stroke="none" /></svg>,
  // heart (themed)
  <svg key="heart" viewBox="0 0 24 24"><path d="M12 21S2.6 14.5 2.6 8.6c0-3 2.4-5.1 5-5.1 1.9 0 3.4 1.1 4.4 2.6 1-1.5 2.5-2.6 4.4-2.6 2.6 0 5 2.1 5 5.1C21.4 14.5 12 21 12 21z" fill="currentColor" /></svg>,
];

interface Props {
  /** Font size in px for the wordmark. The o-slot + glyphs scale from it. */
  size?: number;
  className?: string;
}

export function RecoWordmark({ size = 40, className }: Props) {
  return (
    <span
      className={`reco-wm ${className ?? ''}`}
      role="img"
      aria-label="Reco"
      dir="ltr"
      style={{ fontSize: size }}
    >
      <style>{`
        .reco-wm {
          display: inline-flex; align-items: center; gap: 0.04em;
          font-family: var(--font-fredoka), system-ui, sans-serif;
          font-weight: 700; letter-spacing: -0.03em; color: var(--pink, #FF6B9D); line-height: 1;
        }
        .reco-wm .reco-wm-o {
          display: inline-flex; align-items: center; justify-content: center;
          width: 0.9em; height: 0.9em; border-radius: 50%; position: relative;
          background: var(--pink-soft, #FFF0F6); border: 0.07em dashed var(--pink, #FF6B9D); overflow: hidden;
          vertical-align: -0.06em;
        }
        .reco-wm .reco-wm-glyph {
          position: absolute; width: 70%; height: 70%; display: flex;
          align-items: center; justify-content: center; opacity: 0;
          animation: recoWmCyc 6.3s ease-in-out infinite;
        }
        .reco-wm .reco-wm-glyph svg { width: 100%; height: 100%; display: block; }
        .reco-wm .reco-wm-glyph:nth-child(1){ animation-delay: 0s; }
        .reco-wm .reco-wm-glyph:nth-child(2){ animation-delay: 0.9s; }
        .reco-wm .reco-wm-glyph:nth-child(3){ animation-delay: 1.8s; }
        .reco-wm .reco-wm-glyph:nth-child(4){ animation-delay: 2.7s; }
        .reco-wm .reco-wm-glyph:nth-child(5){ animation-delay: 3.6s; }
        .reco-wm .reco-wm-glyph:nth-child(6){ animation-delay: 4.5s; }
        .reco-wm .reco-wm-glyph:nth-child(7){ animation-delay: 5.4s; }
        @keyframes recoWmCyc {
          0%   { opacity: 0; transform: scale(.5) rotate(-12deg); }
          4%   { opacity: 1; transform: scale(1) rotate(0); }
          12%  { opacity: 1; transform: scale(1) rotate(0); }
          16%  { opacity: 0; transform: scale(.5) rotate(12deg); }
          100% { opacity: 0; transform: scale(.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .reco-wm .reco-wm-glyph { animation: none; }
          .reco-wm .reco-wm-glyph:nth-child(1){ opacity: 1; }
        }
      `}</style>
      <span aria-hidden="true">REC</span>
      <span className="reco-wm-o" aria-hidden="true">
        {GLYPHS.map((g, i) => (
          <span className="reco-wm-glyph" key={i}>
            {g}
          </span>
        ))}
      </span>
    </span>
  );
}
