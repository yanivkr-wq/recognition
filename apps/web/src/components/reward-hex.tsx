/**
 * RewardHex — the Trophy app's gold hexagon whose emblem cycles through seven
 * rewards (trophy → star → present → crown → medal → heart → gem). The trophy
 * comes FIRST because:
 *   - it's the app's namesake mark (the static frame the launcher icon shows);
 *   - prefers-reduced-motion holds on the first emblem, so users with motion
 *     disabled see the trophy instead of an arbitrary other reward.
 *
 * Pure CSS animation in a scoped <style> tag. Sized by the `size` prop (px).
 * Pass `animated={false}` to hold on the trophy (used inside static contexts
 * like screenshots or PNG snapshots where the cycle would distract).
 */

'use client';

const GOLD = '#F5B82E';

/** Seven white reward silhouettes (viewBox 0 0 24 24). Trophy first by design
 *  — see the file header for the why. */
const EMBLEMS = [
  // trophy
  <path key="trophy" fill="#fff" d="M7 4h10v4a5 5 0 0 1-10 0zM11 13h2v3h-2zM8 16h8v2.4H8z" />,
  // star
  <path key="star" fill="#fff" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 18.9 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />,
  // present (gift box with ribbon + bow)
  <g key="present" fill="#fff"><rect x="4" y="10" width="16" height="9" rx="1" /><rect x="3" y="7" width="18" height="3.6" rx="1" /><rect x="10.9" y="7" width="2.2" height="12" /><path d="M12 7C12 4.6 9.6 3.2 8.4 4.5S9.8 7 12 7zM12 7c0-2.4 2.4-3.8 3.6-2.5S14.2 7 12 7z" /></g>,
  // crown
  <path key="crown" fill="#fff" d="M4 8l3.5 3 4.5-6 4.5 6 3.5-3-1.6 10H5.6z" />,
  // medal
  <g key="medal" fill="#fff"><path d="M8.4 3h2.6l1.4 4-2.4 1zM15.6 3h-2.6l-1.4 4 2.4 1z" /><circle cx="12" cy="15" r="5" /></g>,
  // heart
  <path key="heart" fill="#fff" d="M12 21S2.6 14.5 2.6 8.6c0-3 2.4-5.1 5-5.1 1.9 0 3.4 1.1 4.4 2.6 1-1.5 2.5-2.6 4.4-2.6 2.6 0 5 2.1 5 5.1C21.4 14.5 12 21 12 21z" />,
  // gem
  <path key="gem" fill="#fff" d="M6.5 4h11l3 5-8.5 10L3.5 9z" />,
];

export function RewardHex({
  size = 96,
  className,
  animated = true,
}: {
  size?: number;
  className?: string;
  /** When false, only the trophy emblem is shown (no cycle). */
  animated?: boolean;
}) {
  return (
    <span
      className={`reco-hex ${animated ? '' : 'reco-hex--static'} ${className ?? ''}`}
      role="img"
      aria-label="Trophy"
      style={{ width: size, height: size, display: 'inline-block', position: 'relative' }}
    >
      <style>{`
        .reco-hex .reco-hex-emblems {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        }
        .reco-hex .reco-hex-emblem {
          position: absolute; width: 44%; height: 44%; opacity: 0;
          animation: recoHexCyc 6.3s ease-in-out infinite;
        }
        .reco-hex .reco-hex-emblem svg { width: 100%; height: 100%; display: block; }
        .reco-hex .reco-hex-emblem:nth-child(1){ animation-delay: 0s; }
        .reco-hex .reco-hex-emblem:nth-child(2){ animation-delay: .9s; }
        .reco-hex .reco-hex-emblem:nth-child(3){ animation-delay: 1.8s; }
        .reco-hex .reco-hex-emblem:nth-child(4){ animation-delay: 2.7s; }
        .reco-hex .reco-hex-emblem:nth-child(5){ animation-delay: 3.6s; }
        .reco-hex .reco-hex-emblem:nth-child(6){ animation-delay: 4.5s; }
        .reco-hex .reco-hex-emblem:nth-child(7){ animation-delay: 5.4s; }
        @keyframes recoHexCyc {
          0%   { opacity: 0; transform: scale(.5) rotate(-12deg); }
          4%   { opacity: 1; transform: scale(1) rotate(0); }
          12%  { opacity: 1; transform: scale(1) rotate(0); }
          16%  { opacity: 0; transform: scale(.5) rotate(12deg); }
          100% { opacity: 0; transform: scale(.5); }
        }
        /* Static mode: hold on the trophy (first emblem). Same rule applies
           when the OS reports prefers-reduced-motion. */
        @media (prefers-reduced-motion: reduce) {
          .reco-hex .reco-hex-emblem { animation: none; }
          .reco-hex .reco-hex-emblem:nth-child(1){ opacity: 1; }
        }
        .reco-hex--static .reco-hex-emblem { animation: none; }
        .reco-hex--static .reco-hex-emblem:nth-child(1){ opacity: 1; }
      `}</style>
      {/* gold hexagon (pointy-top), matching the logo's gift badge */}
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }} aria-hidden="true">
        <path
          d="M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z"
          fill={GOLD}
          stroke={GOLD}
          strokeWidth="6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="reco-hex-emblems" aria-hidden="true">
        {EMBLEMS.map((e, i) => (
          <span className="reco-hex-emblem" key={i}>
            <svg viewBox="0 0 24 24">{e}</svg>
          </span>
        ))}
      </span>
    </span>
  );
}
