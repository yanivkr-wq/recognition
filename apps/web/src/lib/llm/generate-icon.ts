/**
 * LLM badge-icon generator — Claude draws an original SVG from the badge name.
 *
 * Unlike suggest-fields (which PICKS an emblem from the locked em-* set), this
 * GENERATES a one-off vector icon for badges that need something the set
 * doesn't cover. Stays within the existing Anthropic vendor — no image model.
 *
 * Output is untrusted markup, so we sanitize hard: slice to the outer <svg>,
 * reject anything that could execute or fetch (script, event handlers,
 * <image>/<use>/<foreignObject>, href, data:/javascript: URIs), and cap size.
 * The result is stored as a .svg file and rendered via <img>, which itself
 * neutralizes any script in SVG — defense in depth.
 */

import 'server-only';
import { anthropic } from './client';

export interface GenerateIconInput {
  titleHe: string;
  titleEn?: string;
  /** Badge color (#rrggbb) the icon should be drawn in. */
  color: string;
}

const FORBIDDEN = /<script|<\/script|<image|<use\b|<foreignobject|on[a-z]+\s*=|href|javascript:|data:|<!|<iframe|<style/i;
const MAX_SVG_BYTES = 6000;

function sanitizeSvg(raw: string): string {
  const start = raw.indexOf('<svg');
  const end = raw.lastIndexOf('</svg>');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('LLM did not return an <svg> element');
  }
  const svg = raw.slice(start, end + '</svg>'.length).trim();
  if (svg.length > MAX_SVG_BYTES) throw new Error('generated SVG too large');
  if (FORBIDDEN.test(svg)) throw new Error('generated SVG contains a disallowed token');
  if (!/viewbox/i.test(svg)) throw new Error('generated SVG missing viewBox');
  return svg;
}

export async function generateBadgeIconSvg(input: GenerateIconInput): Promise<string> {
  const title = input.titleHe.trim() || input.titleEn?.trim() || '';
  if (!title) throw new Error('a badge title is required');
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#B59FE5';

  const system = `You generate a single, original, child-friendly badge icon as raw SVG.
Hard requirements:
  - Output ONLY the SVG markup. No markdown fences, no prose, no explanation.
  - Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"> (no width/height attrs).
  - A simple, bold, flat icon representing the badge's theme — recognizable at 32px.
  - Use the color ${color} for the main shapes. You MAY use white (#FFFFFF) or a
    slightly darker/lighter shade of that color for small accents. NO gradients.
  - Allowed elements ONLY: path, circle, rect, ellipse, line, polyline, polygon, g.
  - NO <text>, NO <image>, NO <use>, NO <script>, NO external references, NO href, NO data: URIs.
  - Centered, with a little padding inside the 24×24 box. Rounded, friendly shapes.`;

  const user = `Badge name (Hebrew): ${input.titleHe.trim()}${
    input.titleEn?.trim() ? `\nBadge name (English): ${input.titleEn.trim()}` : ''
  }\nDraw an icon that represents this achievement.`;

  const res = await anthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();

  return sanitizeSvg(text);
}
