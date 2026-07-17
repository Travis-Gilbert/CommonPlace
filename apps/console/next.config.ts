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
  // The dev-tools indicator is chrome that never exists in production; with it
  // on, dev-mode Playwright captures bake the badge into merge-gate baselines
  // (and it occludes the records table's last row). R4 punch list.
  devIndicators: false,
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
