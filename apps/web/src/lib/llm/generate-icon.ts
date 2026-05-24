/**
 * LLM badge-icon generator — Claude draws an original SVG from the badge name.
 *
 * Unlike suggest-fields (which PICKS an emblem from the locked em-* set), this
 * GENERATES a one-off vector icon for badges that need something the set
 * doesn't cover. Stays within the existing Anthropic vendor — no image model.
 *
 * Output is untrusted markup. Rather than hard-reject (which made valid icons
 * fail when Claude added a comment / <style> / data: accent), we STRIP unsafe
 * or unnecessary constructs: comments, XML decls, <script>/<style>/
 * <foreignObject> blocks, and on*= event handlers. The file is stored as .svg
 * and only ever rendered via <img> + nosniff + a sandbox CSP, so scripts can't
 * execute anyway — this is defense in depth, not the only line.
 */

import 'server-only';
import { anthropic } from './client';

export interface GenerateIconInput {
  titleHe: string;
  titleEn?: string;
  /** Badge color (#rrggbb) the icon should be drawn in. */
  color: string;
}

const MAX_SVG_BYTES = 16000;

function sanitizeSvg(raw: string): string {
  // Drop markdown fences Claude sometimes wraps around code.
  let s = raw.replace(/```(?:svg|xml|html)?/gi, '').trim();

  const start = s.search(/<svg[\s>]/i);
  const end = s.toLowerCase().lastIndexOf('</svg>');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('LLM output had no complete <svg> element');
  }
  s = s.slice(start, end + '</svg>'.length);

  // Strip (don't reject) anything unsafe or noisy.
  s = s
    .replace(/<!--[\s\S]*?-->/g, '') // comments
    .replace(/<\?[\s\S]*?\?>/g, '') // xml declarations
    .replace(/<!DOCTYPE[^>]*>/gi, '') // doctype
    .replace(/<script[\s\S]*?<\/script>/gi, '') // scripts
    .replace(/<style[\s\S]*?<\/style>/gi, '') // styles
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '') // html-in-svg
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '') // event handlers (")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '') // event handlers (')
    .replace(/javascript:/gi, '')
    .trim();

  if (s.length > MAX_SVG_BYTES) throw new Error('generated SVG too large');
  if (!/^<svg[\s>]/i.test(s)) throw new Error('sanitized output is not an <svg> root');
  return s;
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
  - NO <text>, NO <image>, NO <use>, NO <script>, NO <style>, NO comments, NO external references.
  - Keep it COMPACT — a handful of shapes, well under 1500 characters.
  - Centered, with a little padding inside the 24×24 box. Rounded, friendly shapes.`;

  const user = `Badge name (Hebrew): ${input.titleHe.trim()}${
    input.titleEn?.trim() ? `\nBadge name (English): ${input.titleEn.trim()}` : ''
  }\nDraw an icon that represents this achievement. Output only the SVG.`;

  const res = await anthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();

  return sanitizeSvg(text);
}
