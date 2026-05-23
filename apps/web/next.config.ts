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
};

export default config;
