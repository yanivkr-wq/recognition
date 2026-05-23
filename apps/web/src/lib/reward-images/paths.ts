/**
 * Reward-image volume path helpers.
 *
 * Per Gate 2 (memory `project_recognition_gate2_decisions.md` §Q3), reward
 * images live on the SAME Docker volume as evidence, in a sibling `rewards/`
 * subdirectory. The evidence-purge cron is row-driven against the `evidence`
 * table (apps/worker/src/cron/evidence-purge.ts) — it walks `evidence` row
 * filenames, NOT the directory tree — so co-locating is safe.
 *
 * In prod: `reco-evidence` volume mounted at `/var/lib/reco/evidence`; this
 * helper appends `/rewards/` so files land at
 * `/var/lib/reco/evidence/rewards/YYYY/MM/DD/<uuid>.<ext>`.
 *
 * In dev: `.evidence-dev/rewards/` at the repo root (the existing
 * `.evidence-dev/` is already gitignored, so no new entry is needed).
 *
 * Security contract mirrors evidence/paths.ts:
 *   - UUID-only filenames; never trust the client's name.
 *   - `..` / absolute-path inputs are rejected with a hard throw.
 *   - Path traversal guard: the resolved absolute path must stay inside the
 *     rewards root (not the parent evidence root).
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_REWARD_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedRewardMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function rewardExtensionFor(mime: string): string | null {
  return MIME_TO_EXT[mime.toLowerCase()] ?? null;
}

function rewardImageRoot(): string {
  // Co-located with evidence per Gate 2; the existing EVIDENCE_VOLUME_PATH
  // env var anchors both. No new env knob to ship.
  const raw = process.env.EVIDENCE_VOLUME_PATH;
  if (!raw) {
    throw new Error(
      'EVIDENCE_VOLUME_PATH is required (reward images share this volume)',
    );
  }
  return path.resolve(raw, 'rewards');
}

export function freshRewardImageFilename(mime: string, now: Date = new Date()): string {
  const ext = rewardExtensionFor(mime);
  if (!ext) throw new Error(`unsupported mime: ${mime}`);
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}/${randomUUID()}.${ext}`;
}

export function rewardImagePathFor(filename: string): string {
  if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
    throw new Error(`unsafe reward image filename: ${filename}`);
  }
  const root = rewardImageRoot();
  const abs = path.resolve(root, filename);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`reward image path escapes root: ${filename}`);
  }
  return abs;
}

export async function ensureRewardImageDirFor(filename: string): Promise<void> {
  const abs = rewardImagePathFor(filename);
  await mkdir(path.dirname(abs), { recursive: true });
}

export async function statRewardImage(filename: string): Promise<number | null> {
  try {
    const s = await stat(rewardImagePathFor(filename));
    return s.size;
  } catch {
    return null;
  }
}

/** Returns true when the stored image_path is a legacy/demo absolute URL
 *  rather than a relative volume filename. Useful for the renderer that
 *  needs to choose between direct <img src> and the /api/reward-images route. */
export function isExternalImageUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}
