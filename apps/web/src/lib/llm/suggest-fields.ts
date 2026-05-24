/**
 * LLM-powered field autofill for admin task / reward forms.
 *
 * Takes a Hebrew title (+ optional description) and returns structured
 * suggestions: English translation, English description, an icon key
 * picked from the existing library, and a complementary pastel color.
 *
 * Model: claude-sonnet-4-6 — pure extraction / classification, no reasoning
 * needed, so thinking is disabled and effort is low. Output is short
 * (max ~512 tokens), no streaming required.
 *
 * Structured output: client.messages.parse() with a Zod schema. The schema
 * is the contract — the SDK validates the response against it before
 * returning, so a malformed LLM output throws rather than silently passing
 * a bad iconKey into the form.
 *
 * Caching: not used in v1. The system prompt (~1500 tokens including the
 * icon list) sits below Sonnet 4.6's 2048-token cache minimum, so the
 * cache_control marker wouldn't engage anyway. If we ever grow the prompt
 * past that (e.g. by including HE+EN descriptions per icon), revisit and
 * add `cache_control: {type: "ephemeral"}` to the system block.
 */

import 'server-only';
// Anthropic SDK's zodOutputFormat helper expects Zod v4 (via the zod/v4
// subpath export, distinct from the Zod v3 default in `zod`). The rest of
// the app uses Zod v3 — keep this import scoped to the LLM module only.
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { anthropic } from './client';

// ── Icon catalog (data-only mirror of components/icon-library.tsx) ──────
// Kept here so the server-side LLM module doesn't import client React
// components. If the icon library grows, update both files. The order
// doesn't matter — the LLM sees the labels, not the index.

interface IconMeta {
  key: string;
  labelHe: string;
  labelEn: string;
  family: 'task' | 'reward' | 'badge';
}

const ICONS: IconMeta[] = [
  { key: 'ic-bed', labelHe: 'מיטה', labelEn: 'Bed', family: 'task' },
  { key: 'ic-brush', labelHe: 'מברשת', labelEn: 'Brush', family: 'task' },
  { key: 'ic-meal', labelHe: 'ארוחה', labelEn: 'Meal', family: 'task' },
  { key: 'ic-clothes', labelHe: 'בגדים', labelEn: 'Clothes', family: 'task' },
  { key: 'ic-homework', labelHe: 'שיעורי בית', labelEn: 'Homework', family: 'task' },
  { key: 'ic-book', labelHe: 'ספר', labelEn: 'Book', family: 'task' },
  { key: 'ic-broom', labelHe: 'מטאטא', labelEn: 'Broom', family: 'task' },
  { key: 'ic-music', labelHe: 'מוזיקה', labelEn: 'Music', family: 'task' },
  { key: 'ic-pet', labelHe: 'חיית מחמד', labelEn: 'Pet', family: 'task' },
  { key: 'ic-plant', labelHe: 'צמח', labelEn: 'Plant', family: 'task' },
  { key: 'ic-soap', labelHe: 'סבון', labelEn: 'Soap', family: 'task' },
  { key: 'ic-pencil', labelHe: 'עפרון', labelEn: 'Pencil', family: 'task' },
  { key: 'ic-bike', labelHe: 'אופניים', labelEn: 'Bike', family: 'task' },
  { key: 'ic-water', labelHe: 'מים', labelEn: 'Water', family: 'task' },
  { key: 'ic-sun', labelHe: 'שמש', labelEn: 'Sun', family: 'task' },
  { key: 'ic-star', labelHe: 'כוכב', labelEn: 'Star', family: 'task' },
  { key: 'ic-bell', labelHe: 'פעמון', labelEn: 'Bell', family: 'task' },
  { key: 'ic-house', labelHe: 'בית', labelEn: 'House', family: 'task' },
  { key: 'ic-wallet', labelHe: 'ארנק', labelEn: 'Wallet', family: 'task' },
  { key: 'ic-medal', labelHe: 'מדליה', labelEn: 'Medal', family: 'task' },
  { key: 'ic-quest', labelHe: 'מסע', labelEn: 'Quest', family: 'task' },
  { key: 'ic-shop', labelHe: 'חנות', labelEn: 'Shop', family: 'task' },
  { key: 'ic-sparkle', labelHe: 'נצנוץ', labelEn: 'Sparkle', family: 'task' },
  { key: 'ic-check-circle', labelHe: 'אישור', labelEn: 'Check', family: 'task' },
  { key: 'ic-party', labelHe: 'חגיגה', labelEn: 'Party', family: 'task' },
  { key: 'rw-candy', labelHe: 'סוכריה', labelEn: 'Candy', family: 'reward' },
  { key: 'rw-phone', labelHe: 'טלפון', labelEn: 'Phone', family: 'reward' },
  { key: 'rw-icecream', labelHe: 'גלידה', labelEn: 'Ice cream', family: 'reward' },
  { key: 'rw-pillow', labelHe: 'כרית', labelEn: 'Pillow', family: 'reward' },
  { key: 'rw-movie', labelHe: 'סרט', labelEn: 'Movie', family: 'reward' },
  { key: 'rw-controller', labelHe: 'משחק', labelEn: 'Game', family: 'reward' },
  { key: 'rw-pizza', labelHe: 'פיצה', labelEn: 'Pizza', family: 'reward' },
  { key: 'rw-gift', labelHe: 'מתנה', labelEn: 'Gift', family: 'reward' },
  { key: 'rw-cookie', labelHe: 'עוגייה', labelEn: 'Cookie', family: 'reward' },
  { key: 'rw-balloon', labelHe: 'בלון', labelEn: 'Balloon', family: 'reward' },
  { key: 'rw-toy', labelHe: 'בובה', labelEn: 'Toy', family: 'reward' },
  { key: 'rw-trophy', labelHe: 'גביע', labelEn: 'Trophy', family: 'reward' },
  // Badge emblems — the locked em-* set (BRANDBOOK §5 / lib/admin-badges/
  // emblems.ts). Mirrored here so the server LLM module stays React-free; the
  // two lists are both short + locked, so drift risk is low.
  { key: 'em-crown', labelHe: 'כתר', labelEn: 'Crown', family: 'badge' },
  { key: 'em-trophy', labelHe: 'גביע', labelEn: 'Trophy', family: 'badge' },
  { key: 'em-medal', labelHe: 'מדליה', labelEn: 'Medal', family: 'badge' },
  { key: 'em-diamond', labelHe: 'יהלום', labelEn: 'Diamond', family: 'badge' },
  { key: 'em-cert', labelHe: 'תעודה', labelEn: 'Certificate', family: 'badge' },
  { key: 'em-gift', labelHe: 'מתנה', labelEn: 'Gift', family: 'badge' },
  { key: 'em-star', labelHe: 'כוכב', labelEn: 'Star', family: 'badge' },
  { key: 'em-torch', labelHe: 'לפיד', labelEn: 'Flame', family: 'badge' },
  { key: 'em-run', labelHe: 'ריצה', labelEn: 'Running', family: 'badge' },
  { key: 'em-ball', labelHe: 'כדורגל', labelEn: 'Ball', family: 'badge' },
  { key: 'em-bike', labelHe: 'אופניים', labelEn: 'Bike', family: 'badge' },
  { key: 'em-book', labelHe: 'ספר', labelEn: 'Book', family: 'badge' },
  { key: 'em-grad', labelHe: 'סיום לימודים', labelEn: 'Graduation', family: 'badge' },
  { key: 'em-pencil', labelHe: 'כתיבה', labelEn: 'Writing', family: 'badge' },
  { key: 'em-music', labelHe: 'מוזיקה', labelEn: 'Music', family: 'badge' },
  { key: 'em-palette', labelHe: 'ציור', labelEn: 'Art', family: 'badge' },
  { key: 'em-plant', labelHe: 'צמח', labelEn: 'Plant', family: 'badge' },
  { key: 'em-sun', labelHe: 'שמש', labelEn: 'Sun', family: 'badge' },
];

// Pastel hex palette from BRANDBOOK §2.3 — the LLM picks one that matches
// the icon's vibe. Restricting to this set keeps suggestions on-brand.
const COLORS = [
  '#FFE5D8', // peach soft
  '#FFE0EB', // pink soft
  '#FFF3D6', // yellow soft
  '#EBFAF3', // mint soft
  '#DBEFFB', // sky soft
  '#ECE4F8', // lavender soft
  '#FFF0F6', // pink paler
  '#EDF6FD', // sky paler
  '#F6F1FC', // lavender paler
] as const;

// Badges render their emblem on a SATURATED brand color (not a wash-out
// pastel), so they get their own palette — exactly the colors the seeded
// badges use (migration 0002). The LLM picks one matching the badge's theme.
const BADGE_COLORS = [
  '#FF6B9D', // pink — royalty / champion / #1
  '#E8B927', // yellow — milestone / trophy / gold
  '#6EC9F4', // sky — calm achievement / reading
  '#3DA8DD', // deep sky — long streak / rare
  '#FF9F7A', // peach — warmth / effort / certificate
  '#B59FE5', // lavender — campaigns / special / gift
] as const;

// ── Schema ──────────────────────────────────────────────────────────────

const SuggestSchema = z.object({
  titleEn: z.string().min(1).describe('English translation of the title.'),
  descriptionEn: z
    .string()
    .describe(
      'English translation of the description. Empty string if no description was provided.',
    ),
  iconKey: z
    .enum(ICONS.map((i) => i.key) as [string, ...string[]])
    .describe('Closest matching icon key from the provided catalog.'),
  suggestedColor: z
    .enum([...COLORS, ...BADGE_COLORS] as [string, ...string[]])
    .describe(
      'Hex color that complements the icon. Tasks/rewards use the pastel set; badges use the bold brand set.',
    ),
});

export type SuggestResult = z.infer<typeof SuggestSchema>;

// ── System prompt builder ──────────────────────────────────────────────

function buildSystemPrompt(family: 'task' | 'reward' | 'badge'): string {
  // Only show the LLM icons from the relevant family so it never picks a
  // reward icon for a task, a task icon for a badge, etc.
  const familyIcons = ICONS.filter((i) => i.family === family);
  const iconNoun = family === 'badge' ? 'emblem' : 'icon';
  const iconList = familyIcons
    .map((i) => `  - ${i.key}: "${i.labelHe}" / "${i.labelEn}"`)
    .join('\n');

  if (family === 'badge') {
    const colorList = BADGE_COLORS.map((c) => `  - ${c}`).join('\n');
    return `You are an admin assistant for Reco, a bilingual (Hebrew + English) family chore + reward app.
The parent has typed a Hebrew title (and maybe a Hebrew description) for a new achievement BADGE — a milestone award a kid earns by completing a journey/campaign (e.g. a streak, a reading goal, a birthday). Your job is to fill in:
  1. titleEn — natural, concise English translation of the badge name (kid-readable, no jargon).
  2. descriptionEn — English translation of the description if provided, else empty string.
  3. iconKey — the emblem from the catalog below that best fits the badge's theme.
  4. suggestedColor — a bold brand hex from the badge palette below.

Translation rules:
  - Keep it short and celebratory (a badge name, not a sentence).
  - Use kid-readable English (ages 9-12). No idioms or rare words.

Emblem picking:
  - You MUST pick a key from the catalog below — no inventing keys.
  - Prefer an emblem that matches the badge's ACTIVITY/THEME, not just a
    generic trophy. Guide:
    · royalty / champion / #1 → em-crown
    · competition / overall winner → em-trophy
    · rare / very long streak → em-diamond
    · certificate / course completion → em-cert
    · birthday / surprise → em-gift
    · perseverance / streak / "keep the flame" → em-torch
    · general "great job" / star → em-star
    · running / exercise / fitness → em-run
    · ball sports / football / basketball → em-ball
    · cycling / outdoor riding → em-bike
    · reading / books → em-book
    · school / graduation / finishing studies → em-grad
    · writing / homework / journaling → em-pencil
    · music / instrument / singing → em-music
    · art / drawing / painting / crafts → em-palette
    · gardening / nature / growth → em-plant
    · outdoors / mornings / sunshine → em-sun
    · medal / general skill award → em-medal

Emblem catalog (family: badge):
${iconList}

Badge color palette (pick exactly one):
${colorList}
Color rules of thumb:
  - Royalty / champion / #1 → #FF6B9D
  - Milestone / trophy / gold → #E8B927
  - Reading / calm achievement → #6EC9F4
  - Long streak / rare → #3DA8DD
  - Warmth / effort / certificate → #FF9F7A
  - Special / campaigns / gift → #B59FE5

Return ONLY the structured object — no preamble, no explanation.`;
  }

  return `You are an admin assistant for Reco, a bilingual (Hebrew + English) family chore + reward app.
The parent has typed a Hebrew title (and maybe a Hebrew description) for a new ${family === 'task' ? 'task' : 'reward'}. Your job is to fill in:
  1. titleEn — natural, concise English translation of the title (kid-readable, no jargon).
  2. descriptionEn — English translation of the description if provided, else empty string.
  3. iconKey — the closest match from the catalog below.
  4. suggestedColor — a pastel hex that complements the icon's vibe.

Translation rules:
  - Match the tone — short and direct for short HE, fuller for longer HE.
  - Use kid-readable English (ages 9-12). No idioms or rare words.
  - Preserve imperatives (e.g. "לסדר מיטה" → "Make the bed", not "Bed making").
  - "אחות" can be sister or sibling — default to "sister" since both kids are girls.

Icon picking:
  - You MUST pick a key from the catalog below — no inventing keys.
  - Match by meaning, not literal word match (e.g. "לסדר חדר" → ic-broom for cleaning, not ic-house).
  - When multiple icons fit, prefer the more action-y one (e.g. ic-broom over ic-house for cleaning tasks).

Icon catalog (family: ${family}):
${iconList}

Color picking rules of thumb:
  - Food / meal → #FFF3D6 (yellow)
  - Sleep / quiet → #ECE4F8 or #F6F1FC (lavender)
  - Sport / outdoors → #EBFAF3 (mint)
  - School / focus → #DBEFFB or #EDF6FD (sky)
  - Affection / family → #FFE5D8 or #FFE0EB (peach / pink)
  - Celebration / reward → #FFF0F6 (pink paler) or #FFF3D6 (yellow)

Return ONLY the structured object — no preamble, no explanation.`;
}

// ── Public entry point ─────────────────────────────────────────────────

export interface SuggestInput {
  family: 'task' | 'reward' | 'badge';
  titleHe: string;
  descriptionHe?: string;
}

export async function suggestFields(input: SuggestInput): Promise<SuggestResult> {
  if (!input.titleHe.trim()) {
    throw new Error('titleHe is required and must be non-empty');
  }

  const userMessage =
    `Hebrew title: ${input.titleHe.trim()}` +
    (input.descriptionHe?.trim()
      ? `\nHebrew description: ${input.descriptionHe.trim()}`
      : '');

  const response = await anthropic().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: zodOutputFormat(SuggestSchema),
    },
    system: buildSystemPrompt(input.family),
    messages: [{ role: 'user', content: userMessage }],
  });

  // .parse() returns parsed_output: T | null. Null means structured parsing
  // failed (the model returned something off-schema). The Zod enum on
  // iconKey/suggestedColor is what gives us safety here — if it parsed,
  // those fields are guaranteed to be in the allowlist.
  if (!response.parsed_output) {
    throw new Error('LLM returned a response that did not match the expected schema');
  }
  return response.parsed_output;
}
