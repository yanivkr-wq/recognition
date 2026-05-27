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

// ─── Cool / hero avatars (Lily: action heroes, princesses, robots… that
//     teens love, beyond the animal set above) ───────────────────────────────

const AvHero = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <circle cx="32" cy="35" r="17" fill="#FFCFA8" stroke={INK} strokeWidth="1.5" />
    <path d="M16 27c3-11 29-11 32 0c-5-5-9-7-16-7s-11 2-16 7z" fill="#2E2A4A" />
    <path d="M16 30c10-4 22-4 32 0l-2 7c-9 4-19 4-28 0z" fill="#2E6BE6" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
    <circle cx="25" cy="33" r="2.6" fill="#fff" />
    <circle cx="39" cy="33" r="2.6" fill="#fff" />
    <circle cx="25" cy="33" r="1.2" fill={INK} />
    <circle cx="39" cy="33" r="1.2" fill={INK} />
    <path d="M27 43c2.5 2.5 7.5 2.5 10 0" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
);

const AvPrincess = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <path d="M14 36c0-14 36-14 36 0c0 8-2 12-4 14l-3-6c-9 3-19 3-22 0l-3 6c-2-2-4-6-4-14z" fill="#7A4A2B" />
    <circle cx="32" cy="35" r="14" fill="#FFD9B8" stroke={INK} strokeWidth="1.5" />
    <path d="M22 22l4 5 6-6 6 6 4-5-2 7H24z" fill="#FFD75E" stroke="#E8B927" strokeWidth="1" strokeLinejoin="round" />
    <circle cx="32" cy="24" r="1.6" fill="#FF6B9D" />
    <circle cx="27" cy="35" r="1.8" fill={INK} />
    <circle cx="37" cy="35" r="1.8" fill={INK} />
    <circle cx="24" cy="39" r="2" fill="#FF9FB5" opacity="0.6" />
    <circle cx="40" cy="39" r="2" fill="#FF9FB5" opacity="0.6" />
    <path d="M29 41c1.5 1.5 4.5 1.5 6 0" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
);

const AvNinja = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <circle cx="32" cy="34" r="18" fill="#33384A" stroke={INK} strokeWidth="1.5" />
    <path d="M15 31c10-5 24-5 34 0l-1 6c-10 4-22 4-32 0z" fill="#FFD9B8" />
    <path d="M22 33c2-2 6-2 8 0c-2 2-6 2-8 0z" fill={INK} />
    <path d="M34 33c2-2 6-2 8 0c-2 2-6 2-8 0z" fill={INK} />
    <path d="M48 30l8 1-5 5z" fill="#E94B7F" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
  </svg>
);

const AvRobot = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <line x1="32" y1="10" x2="32" y2="17" stroke={INK} strokeWidth="2" />
    <circle cx="32" cy="9" r="2.5" fill="#FF6B9D" stroke={INK} strokeWidth="1" />
    <rect x="15" y="17" width="34" height="32" rx="8" fill="#C8D2E0" stroke={INK} strokeWidth="1.5" />
    <rect x="20" y="24" width="24" height="14" rx="4" fill="#1E2940" />
    <circle cx="27" cy="31" r="3" fill="#5BE0E6" />
    <circle cx="37" cy="31" r="3" fill="#5BE0E6" />
    <path d="M24 43h16M28 41v4M32 41v4M36 41v4" stroke={INK} strokeWidth="1.3" />
    <rect x="11" y="28" width="4" height="8" rx="2" fill="#C8D2E0" stroke={INK} strokeWidth="1" />
    <rect x="49" y="28" width="4" height="8" rx="2" fill="#C8D2E0" stroke={INK} strokeWidth="1" />
  </svg>
);

const AvAstronaut = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <circle cx="32" cy="33" r="19" fill="#EEF2F7" stroke={INK} strokeWidth="1.5" />
    <rect x="18" y="24" width="28" height="20" rx="10" fill="#1E2940" />
    <path d="M24 28c4-3 10-3 14 0" stroke="#5B6B8F" strokeWidth="2" fill="none" strokeLinecap="round" />
    <circle cx="38" cy="38" r="2" fill="#5BE0E6" opacity="0.85" />
    <circle cx="49" cy="20" r="2.2" fill="#FF6B9D" stroke={INK} strokeWidth="1" />
    <line x1="47" y1="22" x2="43" y2="26" stroke={INK} strokeWidth="1.5" />
  </svg>
);

const AvWizard = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <path d="M32 6l12 22H20z" fill="#7C4DD6" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M29 16l3 3 4-4" stroke="#FFD75E" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="32" cy="28" rx="16" ry="4" fill="#5E37AD" stroke={INK} strokeWidth="1" />
    <circle cx="32" cy="37" r="12" fill="#FFD9B8" stroke={INK} strokeWidth="1.5" />
    <circle cx="28" cy="36" r="1.6" fill={INK} />
    <circle cx="36" cy="36" r="1.6" fill={INK} />
    <path d="M24 40c2 9 14 9 16 0c-3 3-13 3-16 0z" fill="#F0F0F5" stroke={INK} strokeWidth="1" />
  </svg>
);

const AvDragon = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <path d="M22 16l-3-8 7 6z" fill="#F0C040" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
    <path d="M42 16l3-8-7 6z" fill="#F0C040" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
    <path d="M32 16c12 0 18 9 18 18 0 9-8 16-18 16s-18-7-18-16c0-9 6-18 18-18z" fill="#4FB477" stroke={INK} strokeWidth="1.5" />
    <ellipse cx="32" cy="44" rx="9" ry="6" fill="#7FD09A" />
    <circle cx="29" cy="44" r="1" fill={INK} />
    <circle cx="35" cy="44" r="1" fill={INK} />
    <circle cx="26" cy="32" r="3" fill="#fff" stroke={INK} strokeWidth="1" />
    <circle cx="38" cy="32" r="3" fill="#fff" stroke={INK} strokeWidth="1" />
    <circle cx="26" cy="32" r="1.3" fill={INK} />
    <circle cx="38" cy="32" r="1.3" fill={INK} />
  </svg>
);

const AvAlien = ({ size, ...rest }: FaceProps) => (
  <svg width={size ?? 64} height={size ?? 64} viewBox="0 0 64 64" aria-hidden="true" {...rest}>
    <line x1="26" y1="14" x2="23" y2="8" stroke={INK} strokeWidth="1.5" />
    <line x1="38" y1="14" x2="41" y2="8" stroke={INK} strokeWidth="1.5" />
    <circle cx="22" cy="7" r="2" fill="#7FD09A" />
    <circle cx="42" cy="7" r="2" fill="#7FD09A" />
    <path d="M32 14c12 0 18 8 18 18 0 11-9 20-18 20s-18-9-18-20c0-10 6-18 18-18z" fill="#9BE08A" stroke={INK} strokeWidth="1.5" />
    <ellipse cx="25" cy="34" rx="4.5" ry="7" fill={INK} transform="rotate(-18 25 34)" />
    <ellipse cx="39" cy="34" rx="4.5" ry="7" fill={INK} transform="rotate(18 39 34)" />
    <circle cx="24" cy="31" r="1.3" fill="#fff" />
    <circle cx="38" cy="31" r="1.3" fill="#fff" />
    <path d="M29 46h6" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
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
  { key: 'av-hero', labelHe: 'גיבור על', labelEn: 'Superhero', Component: AvHero },
  { key: 'av-princess', labelHe: 'נסיכה', labelEn: 'Princess', Component: AvPrincess },
  { key: 'av-ninja', labelHe: 'נינג׳ה', labelEn: 'Ninja', Component: AvNinja },
  { key: 'av-robot', labelHe: 'רובוט', labelEn: 'Robot', Component: AvRobot },
  { key: 'av-astronaut', labelHe: 'אסטרונאוט', labelEn: 'Astronaut', Component: AvAstronaut },
  { key: 'av-wizard', labelHe: 'קוסם', labelEn: 'Wizard', Component: AvWizard },
  { key: 'av-dragon', labelHe: 'דרקון', labelEn: 'Dragon', Component: AvDragon },
  { key: 'av-alien', labelHe: 'חייזר', labelEn: 'Alien', Component: AvAlien },
];

const AVATAR_BY_KEY = new Map(AVATAR_LIBRARY.map((a) => [a.key, a]));

export function getAvatar(key: string | null | undefined): AvatarEntry | null {
  if (!key) return null;
  return AVATAR_BY_KEY.get(key) ?? null;
}
