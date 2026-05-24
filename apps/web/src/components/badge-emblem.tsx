/**
 * Badge emblems — the family-3 SVG set (BRANDBOOK §5), finally drawn.
 *
 * Until now badges fell back to a first-letter placeholder. These are
 * original, friendly line glyphs (24×24, currentColor stroke, no gradients
 * per §5) keyed by the em-* values used in the seed + the badge picker.
 *
 * <BadgeEmblem> is the shared renderer: the locked Embroidered Patch
 * (dashed ring) with a COLORED icon on a pale-tint disc (Lily's chosen
 * style). If `imageUrl` is set (an admin-uploaded custom badge image) it
 * renders that instead; if the key is unknown it falls back to the initial
 * letter so nothing ever renders blank.
 *
 * Pure SVG + divs, no hooks — safe to use from both server and client
 * components (kid badges page, admin list, campaign card, form preview).
 */

import type { ComponentType, SVGProps } from 'react';

type EmblemProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 24): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

// ── Achievement classics ────────────────────────────────────────────────

const EmCrown = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M5 18h14M4 8l4 3 4-6 4 6 4-3-1.5 10H5.5z" />
    <circle cx="12" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

const EmTrophy = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
    <path d="M8 5.5H5.5C5 8 6 9.5 8 9.5M16 5.5h2.5C19 8 18 9.5 16 9.5" />
    <path d="M12 12v3M9.5 18h5M10 15h4v3h-4z" />
  </svg>
);

const EmMedal = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M8.5 3l2.5 5M15.5 3l-2.5 5" />
    <circle cx="12" cy="14.5" r="5.5" />
    <circle cx="12" cy="14.5" r="2" fill="currentColor" />
  </svg>
);

const EmDiamond = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M6 4h12l3 5-9 11L3 9z" />
    <path d="M3 9h18M9 4 6 9l6 11M15 4l3 5-6 11" />
  </svg>
);

const EmCert = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <rect x="4" y="4" width="16" height="11" rx="1.5" />
    <path d="M7 8h10M7 11h6" />
    <circle cx="12" cy="17.5" r="2.5" />
    <path d="M10 19l-1 4 3-1.6L15 23l-1-4" />
  </svg>
);

const EmGift = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <rect x="4" y="9" width="16" height="11" rx="1" />
    <path d="M3 9h18v3.5H3zM12 9v11" />
    <path d="M12 9C12 6.5 9.5 4.5 8.3 6S9.8 9 12 9zM12 9c0-2.5 2.5-4.5 3.7-3S14.2 9 12 9z" />
  </svg>
);

const EmStar = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path
      d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 17.9l-5.4 1.8 1.2-6L3.3 9.5l6.1-.7z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

const EmTorch = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M12 3c2.2 3 4 4.2 4 7a4 4 0 0 1-8 0c0-1.6.9-2.6 1.7-3 .2 1 .8 1.6 1.5 1.6-.2-2 .8-3.6.8-3.6z" />
    <path d="M10 21h4M10.8 16.5 10 21M13.2 16.5 14 21" />
  </svg>
);

// ── Sport & movement ──────────────────────────────────────────────────────

const EmRun = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <circle cx="15" cy="5" r="2" />
    <path d="M14.5 8.5 11 11l2.2 2.8.8 5.7M11 11 7.5 12 5.5 16M13.2 13.8 16.5 15l2.8-1M11 11 8 8.8" />
  </svg>
);

const EmBall = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8.2l2.7 2-1 3.3h-3.4l-1-3.3z" fill="currentColor" stroke="none" />
    <path d="M12 8.2V4M14.7 10.2 18 8.4M13.7 13.5l2.6 2.3M10.3 13.5l-2.6 2.3M9.3 10.2 6 8.4" />
  </svg>
);

const EmBike = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <circle cx="6" cy="17" r="3" />
    <circle cx="18" cy="17" r="3" />
    <path d="M6 17l4-7h5M9.5 7H12l6 10M15 10l-3 7" />
  </svg>
);

// ── Reading & learning ──────────────────────────────────────────────────────

const EmBook = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M12 6C10 4.6 7 4.6 4.5 6v12c2.5-1.4 5.5-1.4 7.5 0M12 6c2-1.4 5-1.4 7.5 0v12c-2.5-1.4-5.5-1.4-7.5 0M12 6v12" />
  </svg>
);

const EmGrad = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M2 9l10-4 10 4-10 4z" />
    <path d="M6 11v5c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-5M21.5 9.2V14" />
  </svg>
);

const EmPencil = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M5 19l-1.2 1.2 1.2-4L16 5l3 3L8 19z" />
    <path d="M13.5 7.5l3 3" />
  </svg>
);

// ── Music, art & nature ─────────────────────────────────────────────────────

const EmMusic = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M9 18V5l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="15" r="2.5" />
  </svg>
);

const EmPalette = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 1.6-1.8.4-2.4-1.3-.7-.6-2.6.9-2.6H17a3.5 3.5 0 0 0 0-7 8.5 8.5 0 0 0-5-5z" />
    <circle cx="8" cy="9.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const EmPlant = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <path d="M12 21v-9M12 12C9 12 6 9.5 6 5.5c4 0 6 3 6 6.5zM12 12c3 0 6-2.5 6-6.5-4 0-6 3-6 6.5z" />
  </svg>
);

const EmSun = ({ size, ...r }: EmblemProps) => (
  <svg {...base(size)} {...r}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
  </svg>
);

// ── Registry ────────────────────────────────────────────────────────────────

export const BADGE_EMBLEMS_MAP: Record<string, ComponentType<EmblemProps>> = {
  'em-crown': EmCrown,
  'em-trophy': EmTrophy,
  'em-medal': EmMedal,
  'em-diamond': EmDiamond,
  'em-cert': EmCert,
  'em-gift': EmGift,
  'em-star': EmStar,
  'em-torch': EmTorch,
  'em-run': EmRun,
  'em-ball': EmBall,
  'em-bike': EmBike,
  'em-book': EmBook,
  'em-grad': EmGrad,
  'em-pencil': EmPencil,
  'em-music': EmMusic,
  'em-palette': EmPalette,
  'em-plant': EmPlant,
  'em-sun': EmSun,
};

export function getBadgeEmblem(key: string): ComponentType<EmblemProps> | null {
  return BADGE_EMBLEMS_MAP[key] ?? null;
}

interface BadgeEmblemProps {
  iconKey: string;
  color: string;
  /** Outer patch diameter in px. */
  size?: number;
  /** Fallback initial when the key is unknown + no image. */
  title?: string;
  /** Admin-uploaded custom image — takes precedence over the SVG emblem. */
  imageUrl?: string | null;
  /** Dim + desaturate for not-yet-earned (kid locked) badges. */
  locked?: boolean;
}

/**
 * The Embroidered Patch: dashed ring + pale inner disc + colored emblem.
 * `color` drives the ring, the disc tint, and (via currentColor) the glyph.
 */
export function BadgeEmblem({
  iconKey,
  color,
  size = 80,
  title = '',
  imageUrl = null,
  locked = false,
}: BadgeEmblemProps) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#B59FE5';
  const inner = Math.round(size * 0.66);
  const glyph = Math.round(size * 0.42);
  const Emblem = getBadgeEmblem(iconKey);

  return (
    <div
      className={`rounded-full flex items-center justify-center transition ${
        locked ? 'opacity-40 grayscale' : ''
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: safe + '1A',
        border: `2px dashed ${safe}`,
      }}
      aria-hidden="true"
    >
      <div
        className="rounded-full flex items-center justify-center overflow-hidden"
        style={{ width: inner, height: inner, backgroundColor: safe + '26', color: safe }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : Emblem ? (
          <Emblem size={glyph} />
        ) : (
          <span
            className="font-bold"
            style={{ fontSize: glyph * 0.8, fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}
          >
            {title.trim().charAt(0)}
          </span>
        )}
      </div>
    </div>
  );
}
