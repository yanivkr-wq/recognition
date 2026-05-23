/**
 * Reco kid avatar bank — v1 multi-color inline SVG set.
 *
 * 10 hand-drawn cartoon faces the kid picks from at /[lang]/avatar.
 * Brandbook §4.1 says "Lia is fox, Yael is bunny" — those two get the
 * first slots; the rest are friendly stand-ins for v1 until the
 * licensed family-1 pack ships in Phase 9.
 *
 * Design rules:
 *   - 64×64 viewBox so 32px → 80px scales cleanly.
 *   - Multi-color per-animal: each face uses 3-5 explicit fills to read
 *     as a character (fox = orange + white face; panda = black + white;
 *     unicorn = white + rainbow mane). Colors are INLINE on each path so
 *     the face is independent of the parent background color — the kid's
 *     accent color (`kid.color`) drives the circle behind, the face has
 *     its own identity colors.
 *   - Outline stroke uses `--ink` (#2D2A4A, brandbook §2 never-pure-black).
 *
 * The key naming convention is `av-<species>` to match `ic-` / `rw-`.
 */

import type { ComponentType, SVGProps } from 'react';

type FaceProps = SVGProps<SVGSVGElement> & { size?: number };

// Brandbook palette references used across multiple faces.
const INK = '#2D2A4A';

const AvFox = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Ears — orange triangles */}
    <path d="M14 8l8 14-12 4z" fill="#FF7A45" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M50 8l-8 14 12 4z" fill="#FF7A45" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    {/* Inner ears */}
    <path d="M17 13l4 7-6 2z" fill="#FFD0BC" />
    <path d="M47 13l-4 7 6 2z" fill="#FFD0BC" />
    {/* Head — orange */}
    <ellipse cx="32" cy="34" rx="17" ry="16" fill="#FF9F7A" stroke={INK} strokeWidth="1.5" />
    {/* White face mask */}
    <path d="M22 36c0-5 4-9 10-9s10 4 10 9c0 3-2 5-4 6l-6 5-6-5c-2-1-4-3-4-6z" fill="#FFF6EE" />
    {/* Eyes */}
    <circle cx="26" cy="33" r="2.2" fill={INK} />
    <circle cx="38" cy="33" r="2.2" fill={INK} />
    {/* Sparkle in eyes */}
    <circle cx="27" cy="32" r="0.7" fill="white" />
    <circle cx="39" cy="32" r="0.7" fill="white" />
    {/* Nose */}
    <ellipse cx="32" cy="40" rx="2" ry="1.4" fill={INK} />
    {/* Mouth */}
    <path d="M30 42c1 1.5 3 1.5 4 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </svg>
);

const AvBunny = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Long ears — outer white, inner pink */}
    <ellipse cx="24" cy="14" rx="3.5" ry="11" fill="#FAFAFA" stroke={INK} strokeWidth="1.5" />
    <ellipse cx="40" cy="14" rx="3.5" ry="11" fill="#FAFAFA" stroke={INK} strokeWidth="1.5" />
    <ellipse cx="24" cy="16" rx="1.7" ry="8" fill="#FFB8D1" />
    <ellipse cx="40" cy="16" rx="1.7" ry="8" fill="#FFB8D1" />
    {/* Head — white */}
    <circle cx="32" cy="38" r="15" fill="#FAFAFA" stroke={INK} strokeWidth="1.5" />
    {/* Cheek blush */}
    <circle cx="22" cy="42" r="2.5" fill="#FFC9DC" opacity="0.7" />
    <circle cx="42" cy="42" r="2.5" fill="#FFC9DC" opacity="0.7" />
    {/* Eyes */}
    <ellipse cx="26" cy="36" rx="2" ry="2.5" fill={INK} />
    <ellipse cx="38" cy="36" rx="2" ry="2.5" fill={INK} />
    <circle cx="27" cy="35" r="0.7" fill="white" />
    <circle cx="39" cy="35" r="0.7" fill="white" />
    {/* Pink nose */}
    <path d="M30 42l2 2 2-2z" fill="#FF6B9D" />
    {/* Mouth — Y shape */}
    <path d="M32 44v2M32 46l-2 1M32 46l2 1" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);

const AvCat = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Pointy gray ears */}
    <path d="M14 10l10 14H10z" fill="#9D9BBC" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M50 10l-10 14h14z" fill="#9D9BBC" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    {/* Inner ear pink */}
    <path d="M16 14l5 8h-6z" fill="#FFC9DC" />
    <path d="M48 14l-5 8h6z" fill="#FFC9DC" />
    {/* Head — gray */}
    <ellipse cx="32" cy="36" rx="17" ry="15" fill="#C9C2DC" stroke={INK} strokeWidth="1.5" />
    {/* Eyes — bright green */}
    <ellipse cx="25" cy="34" rx="2" ry="3" fill="#7CE0B5" />
    <ellipse cx="39" cy="34" rx="2" ry="3" fill="#7CE0B5" />
    {/* Pupils */}
    <ellipse cx="25" cy="34" rx="0.8" ry="2.5" fill={INK} />
    <ellipse cx="39" cy="34" rx="0.8" ry="2.5" fill={INK} />
    {/* Pink nose */}
    <path d="M30 41l2 1.5 2-1.5-2 2z" fill="#FF6B9D" />
    {/* Whiskers */}
    <path d="M20 40l-6-1M20 42l-6 1M44 40l6-1M44 42l6 1" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
    {/* Mouth */}
    <path d="M30 44c1 1 3 1 4 0" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);

const AvDog = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Floppy ears — brown */}
    <ellipse cx="14" cy="30" rx="6" ry="13" fill="#9A6E4A" stroke={INK} strokeWidth="1.5" />
    <ellipse cx="50" cy="30" rx="6" ry="13" fill="#9A6E4A" stroke={INK} strokeWidth="1.5" />
    {/* Inner ear lighter */}
    <ellipse cx="14" cy="32" rx="2.5" ry="9" fill="#C9A57B" />
    <ellipse cx="50" cy="32" rx="2.5" ry="9" fill="#C9A57B" />
    {/* Head — tan */}
    <circle cx="32" cy="38" r="14" fill="#D9BC8C" stroke={INK} strokeWidth="1.5" />
    {/* Lighter muzzle */}
    <ellipse cx="32" cy="44" rx="9" ry="6" fill="#F4E0BC" />
    {/* Eyes */}
    <circle cx="27" cy="34" r="2" fill={INK} />
    <circle cx="37" cy="34" r="2" fill={INK} />
    <circle cx="28" cy="33" r="0.7" fill="white" />
    <circle cx="38" cy="33" r="0.7" fill="white" />
    {/* Nose */}
    <ellipse cx="32" cy="41" rx="2.5" ry="2" fill={INK} />
    {/* Tongue */}
    <path d="M30 46c.5 2 3.5 2 4 0v-1c0 .5-3.5.5-4 0z" fill="#FF6B9D" stroke={INK} strokeWidth="1" />
  </svg>
);

const AvOwl = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Ear tufts */}
    <path d="M20 12l-2 6 5-2z" fill="#8B72CE" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M44 12l2 6-5-2z" fill="#8B72CE" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
    {/* Head — lavender */}
    <ellipse cx="32" cy="36" rx="18" ry="16" fill="#B59FE5" stroke={INK} strokeWidth="1.5" />
    {/* Belly chest */}
    <ellipse cx="32" cy="44" rx="8" ry="6" fill="#ECE4F8" />
    {/* Big yellow eye rings */}
    <circle cx="25" cy="33" r="5.5" fill="#FFD75E" stroke={INK} strokeWidth="1.5" />
    <circle cx="39" cy="33" r="5.5" fill="#FFD75E" stroke={INK} strokeWidth="1.5" />
    {/* Pupils */}
    <circle cx="25" cy="33" r="2.2" fill={INK} />
    <circle cx="39" cy="33" r="2.2" fill={INK} />
    <circle cx="26" cy="32" r="0.7" fill="white" />
    <circle cx="40" cy="32" r="0.7" fill="white" />
    {/* Orange beak */}
    <path d="M30 40l2 4 2-4z" fill="#FF9F7A" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const AvBear = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Round brown ears */}
    <circle cx="18" cy="20" r="5" fill="#9A6E4A" stroke={INK} strokeWidth="1.5" />
    <circle cx="46" cy="20" r="5" fill="#9A6E4A" stroke={INK} strokeWidth="1.5" />
    {/* Inner ear */}
    <circle cx="18" cy="20" r="2.5" fill="#FFD0BC" />
    <circle cx="46" cy="20" r="2.5" fill="#FFD0BC" />
    {/* Head — brown */}
    <circle cx="32" cy="38" r="14" fill="#B98255" stroke={INK} strokeWidth="1.5" />
    {/* Lighter snout */}
    <ellipse cx="32" cy="42" rx="7" ry="6" fill="#F4E0BC" />
    {/* Eyes */}
    <circle cx="27" cy="35" r="1.8" fill={INK} />
    <circle cx="37" cy="35" r="1.8" fill={INK} />
    <circle cx="28" cy="34" r="0.6" fill="white" />
    <circle cx="38" cy="34" r="0.6" fill="white" />
    {/* Nose */}
    <ellipse cx="32" cy="40" rx="2.2" ry="1.5" fill={INK} />
    {/* Mouth */}
    <path d="M32 42v2M32 44l-1.5 1M32 44l1.5 1" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);

const AvUnicorn = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Rainbow mane behind head */}
    <path d="M16 24 Q14 18 18 14 L22 18 Q21 22 19 25z" fill="#FF6B9D" />
    <path d="M48 24 Q50 18 46 14 L42 18 Q43 22 45 25z" fill="#B59FE5" />
    <path d="M14 30 Q11 28 12 22 L16 22 Q17 28 17 30z" fill="#FFD75E" />
    <path d="M50 30 Q53 28 52 22 L48 22 Q47 28 47 30z" fill="#7CE0B5" />
    {/* Golden horn */}
    <path d="M30 8l4 0-2 10z" fill="#FFD75E" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M30.5 11h3M30.5 14h3" stroke={INK} strokeWidth="0.7" />
    {/* Head — white */}
    <ellipse cx="32" cy="38" rx="15" ry="14" fill="#FAFAFA" stroke={INK} strokeWidth="1.5" />
    {/* Pink cheek */}
    <circle cx="22" cy="42" r="2.5" fill="#FFC9DC" opacity="0.7" />
    <circle cx="42" cy="42" r="2.5" fill="#FFC9DC" opacity="0.7" />
    {/* Eyes */}
    <path d="M24 35c1.5 2 4 2 5 0" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <path d="M35 35c1.5 2 4 2 5 0" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    {/* Mouth */}
    <path d="M30 43c1 1.5 3 1.5 4 0" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);

const AvPanda = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Black ears */}
    <circle cx="18" cy="20" r="5" fill={INK} />
    <circle cx="46" cy="20" r="5" fill={INK} />
    {/* Head — white */}
    <circle cx="32" cy="38" r="14" fill="#FAFAFA" stroke={INK} strokeWidth="1.5" />
    {/* Black eye patches */}
    <ellipse cx="25" cy="35" rx="3.5" ry="4" fill={INK} transform="rotate(-15 25 35)" />
    <ellipse cx="39" cy="35" rx="3.5" ry="4" fill={INK} transform="rotate(15 39 35)" />
    {/* Eye whites */}
    <circle cx="25" cy="35" r="1.4" fill="#FAFAFA" />
    <circle cx="39" cy="35" r="1.4" fill="#FAFAFA" />
    {/* Pupils */}
    <circle cx="25" cy="35" r="0.7" fill={INK} />
    <circle cx="39" cy="35" r="0.7" fill={INK} />
    {/* Nose */}
    <path d="M30 41l2 1.5 2-1.5-2 2z" fill={INK} />
    {/* Mouth */}
    <path d="M32 43v2M32 45l-1.5 1M32 45l1.5 1" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" />
  </svg>
);

const AvFrog = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Big bulging eyes on top — green outer + white + pupil */}
    <circle cx="22" cy="20" r="8" fill="#7CE0B5" stroke={INK} strokeWidth="1.5" />
    <circle cx="42" cy="20" r="8" fill="#7CE0B5" stroke={INK} strokeWidth="1.5" />
    <circle cx="22" cy="19" r="4" fill="white" />
    <circle cx="42" cy="19" r="4" fill="white" />
    <circle cx="22" cy="19" r="2" fill={INK} />
    <circle cx="42" cy="19" r="2" fill={INK} />
    <circle cx="23" cy="18" r="0.7" fill="white" />
    <circle cx="43" cy="18" r="0.7" fill="white" />
    {/* Head — green */}
    <ellipse cx="32" cy="40" rx="18" ry="13" fill="#7CE0B5" stroke={INK} strokeWidth="1.5" />
    {/* Lighter belly */}
    <ellipse cx="32" cy="45" rx="10" ry="5" fill="#D7F4E6" />
    {/* Big smile */}
    <path d="M22 39c4 6 16 6 20 0" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    {/* Pink cheeks */}
    <circle cx="18" cy="42" r="2" fill="#FF6B9D" opacity="0.6" />
    <circle cx="46" cy="42" r="2" fill="#FF6B9D" opacity="0.6" />
  </svg>
);

const AvMonkey = ({ size, ...rest }: FaceProps) => (
  <svg
    width={size ?? 64}
    height={size ?? 64}
    viewBox="0 0 64 64"
    aria-hidden="true"
    {...rest}
  >
    {/* Side ears */}
    <circle cx="16" cy="32" r="5" fill="#9A6E4A" stroke={INK} strokeWidth="1.5" />
    <circle cx="48" cy="32" r="5" fill="#9A6E4A" stroke={INK} strokeWidth="1.5" />
    <circle cx="16" cy="32" r="2.5" fill="#FFD0BC" />
    <circle cx="48" cy="32" r="2.5" fill="#FFD0BC" />
    {/* Head — brown */}
    <circle cx="32" cy="34" r="13" fill="#9A6E4A" stroke={INK} strokeWidth="1.5" />
    {/* Inner face heart shape — peach */}
    <path d="M22 32c0-5 4-8 10-8s10 3 10 8c0 4-3 7-5 8l-5 4-5-4c-2-1-5-4-5-8z" fill="#FFD0BC" />
    {/* Eyes */}
    <circle cx="27" cy="32" r="1.8" fill={INK} />
    <circle cx="37" cy="32" r="1.8" fill={INK} />
    <circle cx="28" cy="31" r="0.6" fill="white" />
    <circle cx="38" cy="31" r="0.6" fill="white" />
    {/* Nostrils */}
    <ellipse cx="30" cy="37" rx="0.7" ry="0.4" fill={INK} />
    <ellipse cx="34" cy="37" rx="0.7" ry="0.4" fill={INK} />
    {/* Smile */}
    <path d="M28 41c1.5 2 6.5 2 8 0" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
);

export interface AvatarEntry {
  key: string;
  labelHe: string;
  labelEn: string;
  Component: ComponentType<FaceProps>;
}

export const AVATAR_LIBRARY: AvatarEntry[] = [
  { key: 'av-fox', labelHe: 'שועל', labelEn: 'Fox', Component: AvFox },
  { key: 'av-bunny', labelHe: 'ארנב', labelEn: 'Bunny', Component: AvBunny },
  { key: 'av-cat', labelHe: 'חתול', labelEn: 'Cat', Component: AvCat },
  { key: 'av-dog', labelHe: 'כלב', labelEn: 'Dog', Component: AvDog },
  { key: 'av-owl', labelHe: 'ינשוף', labelEn: 'Owl', Component: AvOwl },
  { key: 'av-bear', labelHe: 'דוב', labelEn: 'Bear', Component: AvBear },
  { key: 'av-unicorn', labelHe: 'חד-קרן', labelEn: 'Unicorn', Component: AvUnicorn },
  { key: 'av-panda', labelHe: 'פנדה', labelEn: 'Panda', Component: AvPanda },
  { key: 'av-frog', labelHe: 'צפרדע', labelEn: 'Frog', Component: AvFrog },
  { key: 'av-monkey', labelHe: 'קוף', labelEn: 'Monkey', Component: AvMonkey },
];

const AVATAR_BY_KEY = new Map(AVATAR_LIBRARY.map((a) => [a.key, a]));

export function getAvatar(key: string | null | undefined): AvatarEntry | null {
  if (!key) return null;
  return AVATAR_BY_KEY.get(key) ?? null;
}
