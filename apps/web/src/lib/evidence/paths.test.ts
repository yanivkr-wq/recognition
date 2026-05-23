/**
 * Pure-unit tests for the evidence path helpers.
 *
 * Filename injection is the single highest-risk vector in Phase 5 — every
 * upload runs through `freshFilename` (UUID + safe ext) and every serve
 * runs the result through `evidencePathFor` (traversal guard). These tests
 * are the contract: a malicious upload CAN'T land outside the volume,
 * regardless of what the client sends.
 *
 * No DB, no network — just the path module. Runs as part of `pnpm --filter
 * @reco/web test` (vitest.config in apps/web sets resolution).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import {
  freshFilename,
  evidencePathFor,
  isAllowedMime,
  extensionFor,
  MAX_EVIDENCE_BYTES,
} from './paths';

const ORIG_PATH = process.env.EVIDENCE_VOLUME_PATH;
const TEST_ROOT = path.resolve(__dirname, '../../../../../.evidence-test');

beforeAll(() => {
  process.env.EVIDENCE_VOLUME_PATH = TEST_ROOT;
});

afterAll(() => {
  if (ORIG_PATH === undefined) delete process.env.EVIDENCE_VOLUME_PATH;
  else process.env.EVIDENCE_VOLUME_PATH = ORIG_PATH;
});

describe('mime + extension allowlist', () => {
  it('accepts the supported image mimes', () => {
    for (const m of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
      expect(isAllowedMime(m)).toBe(true);
      expect(extensionFor(m)).toMatch(/^(jpg|png|webp|heic)$/);
    }
  });
  it('rejects unsafe mimes', () => {
    for (const m of ['text/html', 'application/javascript', 'video/mp4', 'image/svg+xml']) {
      expect(isAllowedMime(m)).toBe(false);
      expect(extensionFor(m)).toBeNull();
    }
  });
  it('matches mime case-insensitively', () => {
    expect(isAllowedMime('IMAGE/PNG')).toBe(true);
    expect(extensionFor('Image/JPEG')).toBe('jpg');
  });
  it('exports a 10 MB size cap', () => {
    expect(MAX_EVIDENCE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('freshFilename', () => {
  it('produces a UUID-named, date-sharded path', () => {
    const fn = freshFilename('image/png', new Date('2026-05-22T12:00:00Z'));
    expect(fn).toMatch(/^2026\/05\/22\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/);
  });
  it('NEVER reflects any client-supplied name', () => {
    // The function takes a MIME (and optional `now` for deterministic
    // tests), never a name. There is no way to express a caller-supplied
    // filename in the signature — verify the only inputs are exactly those.
    expect(freshFilename.length).toBe(1); // 1 required (mime); `now` has a default
    // And the output never contains anything other than digits, dashes, and
    // the safe extension — i.e., never echoes random characters that could
    // have come from a client name.
    expect(freshFilename('image/png')).toMatch(/^\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]+\.png$/);
  });
  it('produces unique filenames across calls', () => {
    const a = freshFilename('image/png');
    const b = freshFilename('image/png');
    expect(a).not.toBe(b);
  });
  it('throws on unsupported MIME', () => {
    expect(() => freshFilename('text/html')).toThrow(/unsupported mime/);
  });
});

describe('evidencePathFor — path traversal guard', () => {
  it('resolves a safe UUID filename inside the root', () => {
    const fn = freshFilename('image/png');
    const abs = evidencePathFor(fn);
    expect(abs.startsWith(path.resolve(TEST_ROOT) + path.sep)).toBe(true);
  });

  it('rejects "..": parent escape', () => {
    expect(() => evidencePathFor('../etc/passwd')).toThrow(/unsafe evidence filename/);
  });
  it('rejects deeply nested "..": multi-segment escape', () => {
    expect(() => evidencePathFor('2026/05/../../../etc/passwd')).toThrow(
      /unsafe evidence filename/,
    );
  });
  it('rejects an absolute Unix path', () => {
    expect(() => evidencePathFor('/etc/passwd')).toThrow(/unsafe evidence filename/);
  });
  it('rejects an absolute Windows path', () => {
    expect(() => evidencePathFor('\\Windows\\System32\\config\\SAM')).toThrow(
      /unsafe evidence filename/,
    );
  });
  it('rejects a backslash-traversal hybrid', () => {
    // ".." check fires first.
    expect(() => evidencePathFor('..\\..\\..\\etc\\passwd')).toThrow(/unsafe evidence filename/);
  });

  it('throws when EVIDENCE_VOLUME_PATH is missing', () => {
    const prev = process.env.EVIDENCE_VOLUME_PATH;
    delete process.env.EVIDENCE_VOLUME_PATH;
    try {
      expect(() => evidencePathFor('2026/05/22/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png')).toThrow(
        /EVIDENCE_VOLUME_PATH/,
      );
    } finally {
      process.env.EVIDENCE_VOLUME_PATH = prev;
    }
  });
});
