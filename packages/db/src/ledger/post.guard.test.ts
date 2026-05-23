/**
 * Static guard: no source file outside this directory may issue a raw
 * INSERT INTO ledger_entry. Per SCHEMA.md §13 invariant 1, all ledger writes
 * funnel through ledgerPost(). Tests (which intentionally test the DB CHECK
 * constraints with bad raw INSERTs) and the schema docs are exempt.
 *
 * Why a test and not a lint rule: this needs ZERO setup for a fresh
 * contributor — it just runs as part of `pnpm --filter @reco/db test`,
 * which is on the CI critical path anyway.
 */

import { describe, it, expect } from 'vitest';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');

// Roots scanned for offending writes. Each is repo-relative.
const SCAN_ROOTS = ['apps', 'packages'];

// Patterns to flag. The match is intentionally lenient so a typo like
// `Insert  Into ledger_entry` still triggers; we lowercase before regexing.
const FORBIDDEN_PATTERN = /insert\s+into\s+ledger_entry/;

// Files allowed to contain the forbidden pattern.
function isAllowed(absPath: string): boolean {
  const rel = path.relative(PROJECT_ROOT, absPath).replace(/\\/g, '/');
  return (
    // The writer itself.
    rel === 'packages/db/src/ledger/post.ts' ||
    // The grep guard's own source (where the pattern appears in regex form).
    rel === 'packages/db/src/ledger/post.guard.test.ts' ||
    // Invariant + schema-tooling tests intentionally exercise raw INSERTs.
    rel === 'packages/db/src/ledger/post.test.ts' ||
    // SQL migrations are the canonical schema; the INSERT into ledger_entry
    // appears in raw SQL strings inside the smoke + invariant tests too.
    rel.startsWith('packages/db/migrations/') ||
    // Build artifacts.
    rel.includes('/node_modules/') ||
    rel.includes('/dist/') ||
    rel.includes('/.next/') ||
    rel.endsWith('.tsbuildinfo')
  );
}

async function collectFiles(root: string, acc: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.next' ||
        entry.name === '.turbo'
      ) {
        continue;
      }
      await collectFiles(full, acc);
      continue;
    }
    if (entry.isFile()) {
      if (/\.(ts|tsx|js|jsx|sql)$/.test(entry.name)) {
        acc.push(full);
      }
    }
  }
  return acc;
}

describe('ledger writer is the only INSERT INTO ledger_entry', () => {
  it('rejects any other source file containing INSERT INTO ledger_entry', async () => {
    const offenders: string[] = [];

    for (const root of SCAN_ROOTS) {
      const abs = path.join(PROJECT_ROOT, root);
      try {
        await stat(abs);
      } catch {
        continue;
      }
      const files = await collectFiles(abs);
      for (const file of files) {
        if (isAllowed(file)) continue;
        const content = await readFile(file, 'utf8');
        if (FORBIDDEN_PATTERN.test(content.toLowerCase())) {
          offenders.push(path.relative(PROJECT_ROOT, file));
        }
      }
    }

    expect(offenders, `Direct ledger_entry INSERTs found in:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});
