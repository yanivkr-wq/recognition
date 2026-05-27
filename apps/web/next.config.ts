/**
 * Reco web — Next.js 16 (App Router, Turbopack, React 19, Tailwind 4).
 *
 * Kept intentionally minimal. transpilePackages pulls our workspace packages
 * through Next's transformer so server components can import from @reco/db
 * and @reco/shared without a separate build step.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  transpilePackages: ['@reco/db', '@reco/shared'],
  reactStrictMode: true,
  // Standalone bundle for Dockerfile.web — Next traces every imported file
  // (including workspace siblings) and emits a self-contained server.
  output: 'standalone',
  // In a monorepo Next needs to know where the tracing root lives so
  // pnpm-symlinked workspace packages are followed correctly.
  outputFileTracingRoot: path.join(here, '../..'),
  // Photo uploads (evidence for approval, reward/badge images, feedback
  // attachments) go through Server Actions as multipart FormData. Next's
  // default Server Action body cap is 1 MB — phone photos are 2-5 MB, so the
  // POST was rejected with "Body exceeded 1 MB limit" before the action ran.
  // Our own per-feature caps are the real limits: evidence 10 MB, reward/badge
  // images 5 MB. Set 12 MB here to clear the largest (10 MB) plus multipart
  // encoding overhead; the action-level size checks still enforce the rest.
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default config;
