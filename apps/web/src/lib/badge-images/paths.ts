/**
 * Badge-image volume path helpers.
 *
 * Custom badge images share the evidence volume (EVIDENCE_VOLUME_PATH) under
 * a sibling `badges/` subdir: `<volume>/badges/YYYY/MM/DD/<uuid>.<ext>`.
 * Mirrors lib/reward-images/paths.ts — UUID-only filenames, traversal guard,
 * 5 MB cap, image MIME allowlist.
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_BADGE_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedBadgeMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function badgeExtensionFor(mime: string): string | null {
  return MIME_TO_EXT[mime.toLowerCase()] ?? null;
}

function badgeImageRoot(): string {
  const raw = process.env.EVIDENCE_VOLUME_PATH;
  if (!raw) {
    throw new Error('EVIDENCE_VOLUME_PATH is required (badge images share this volume)');
  }
  return path.resolve(raw, 'badges');
}

export function freshBadgeImageFilename(mime: string, now: Date = new Date()): string {
  const ext = badgeExtensionFor(mime);
  if (!ext) throw new Error(`unsupported mime: ${mime}`);
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}/${randomUUID()}.${ext}`;
}

export function badgeImagePathFor(filename: string): string {
  if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
    throw new Error(`unsafe badge image filename: ${filename}`);
  }
  const root = badgeImageRoot();
  const abs = path.resolve(root, filename);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`badge image path escapes root: ${filename}`);
  }
  return abs;
}

export async function ensureBadgeImageDirFor(filename: string): Promise<void> {
  const abs = badgeImagePathFor(filename);
  await mkdir(path.dirname(abs), { recursive: true });
}
