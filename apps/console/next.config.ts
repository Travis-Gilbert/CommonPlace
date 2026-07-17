import path from 'node:path';
import type { NextConfig } from 'next';

// Explicit Turbopack workspace root, same convention as apps/web: the monorepo
// root, so Turbopack resolves workspace packages (e.g. @commonplace/block-view)
// that live outside the app directory.
const projectRoot = path.resolve('..', '..');

const isStandaloneServerBuild =
  process.env.RAILWAY_STANDALONE === '1' || process.env.NEXT_OUTPUT === 'standalone';

const nextConfig: NextConfig = {
  output: isStandaloneServerBuild ? 'standalone' : undefined,
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
