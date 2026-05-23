/**
 * Evidence-volume path helpers.
 *
 * All photo storage lives under EVIDENCE_VOLUME_PATH (per docker-compose §9
 * in ARCHITECTURE.md; both reco-web and reco-worker mount the same named
 * volume at `/var/lib/reco/evidence` in prod). The dev override lands in
 * `.evidence-dev/` at the repo root (gitignored) so the host can write +
 * read uploads without containers.
 *
 * Security contract:
 *   - NEVER use a client-supplied filename. Every upload gets `<uuid>.<safe_ext>`
 *     where `safe_ext` is constrained to a small allowlist (`extensionFor`).
 *   - NEVER concatenate paths with user input. `evidencePathFor` accepts only
 *     the relative filename produced by `freshFilename` (UUID + ext).
 *   - `evidencePathFor` rejects any relative path that escapes the root via
 *     `..` segments — defense-in-depth on top of the uuid-only filename.
 *
 * Directory layout: `<root>/YYYY/MM/DD/<uuid>.<ext>` — date-sharded so a
 * single day's upload doesn't bloat one inode listing, and `find` / cron
 * tooling can scope-iterate to a window cheaply.
 */

// No `import 'server-only'` here — the file is pure Node (node:crypto +
// node:fs/promises), wouldn't compile to browser, and the consumers
// (actions.ts + route.ts) carry their own server-only / runtime boundary.
// Importing 'server-only' breaks Vitest unit tests against this module.
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function extensionFor(mime: string): string | null {
  return MIME_TO_EXT[mime.toLowerCase()] ?? null;
}

function evidenceRoot(): string {
  const raw = process.env.EVIDENCE_VOLUME_PATH;
  if (!raw) {
    throw new Error(
      'EVIDENCE_VOLUME_PATH is required for Phase 5 evidence uploads',
    );
  }
  // Node resolves relative paths against the process cwd. For `pnpm --filter
  // @reco/web dev`, cwd is `apps/web`, so `../../.evidence-dev` lands at the
  // repo root. For the worker, cwd is `apps/worker` — same anchor.
  return path.resolve(raw);
}

/** Date-sharded relative filename (DB stores this as `evidence.filename`). */
export function freshFilename(mime: string, now: Date = new Date()): string {
  const ext = extensionFor(mime);
  if (!ext) throw new Error(`unsupported mime: ${mime}`);
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}/${randomUUID()}.${ext}`;
}

/** Absolute path on disk for a stored evidence row's `filename`. */
export function evidencePathFor(filename: string): string {
  // Reject any traversal segment as defense-in-depth. The UUID-only filename
  // from freshFilename() can't produce these, but a future code path that
  // accepts a DB row might be tampered with — better to fail loudly.
  if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
    throw new Error(`unsafe evidence filename: ${filename}`);
  }
  const root = evidenceRoot();
  const abs = path.resolve(root, filename);
  // Sanity: the resolved path must STILL be inside the root.
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`evidence path escapes root: ${filename}`);
  }
  return abs;
}

/** Create the date-sharded directory for an upload. Idempotent. */
export async function ensureDirFor(filename: string): Promise<void> {
  const abs = evidencePathFor(filename);
  await mkdir(path.dirname(abs), { recursive: true });
}

/** Returns size in bytes if the file exists on disk, null otherwise. */
export async function statEvidence(filename: string): Promise<number | null> {
  try {
    const s = await stat(evidencePathFor(filename));
    return s.size;
  } catch {
    return null;
  }
}
