// SOURCING: none. Deploy plumbing, mirrored from apps/web's proven
// prepare-railway-standalone.mjs (the repo's Railway pattern; the console
// deploys as a second service without disturbing the web one).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const standaloneDir = join(root, '.next', 'standalone');

if (!existsSync(standaloneDir)) {
  throw new Error('Missing .next/standalone. Run the Railway standalone build first.');
}

// The monorepo build (turbopack.root = repo root) nests server.js under
// apps/console; a single-package build puts it at the standalone root.
const serverDirCandidates = [standaloneDir, join(standaloneDir, 'apps', 'console')];
const serverDir = serverDirCandidates.find((dir) => existsSync(join(dir, 'server.js')));

if (!serverDir) {
  throw new Error(
    `Missing standalone server.js. Checked: ${serverDirCandidates
      .map((dir) => join(dir, 'server.js'))
      .join(', ')}`,
  );
}

const publicSource = join(root, 'public');
const publicTarget = join(serverDir, 'public');
if (existsSync(publicSource)) {
  rmSync(publicTarget, { force: true, recursive: true });
  cpSync(publicSource, publicTarget, { recursive: true });
}

// Cutover doctor (GL4) reads the register manifest at runtime. Standalone
// next does not include the monorepo root, so copy the marker next to server.js
// and also two levels up for the ../.. lookup used by the API route.
const markerSource = join(root, '..', '..', '.commonplace-canonical');
const markerAlt = join(root, '.commonplace-canonical');
const marker = existsSync(markerSource) ? markerSource : markerAlt;
if (existsSync(marker)) {
  cpSync(marker, join(serverDir, '.commonplace-canonical'));
  const monorepoShape = join(serverDir, '..', '..');
  mkdirSync(monorepoShape, { recursive: true });
  cpSync(marker, join(monorepoShape, '.commonplace-canonical'));
  console.log(`Copied .commonplace-canonical into ${serverDir} for /api/doctor.`);
} else {
  console.warn('WARNING: .commonplace-canonical missing; /api/doctor will 500 in production.');
}

// .next/static is never auto-copied; without it the standalone server 404s
// every chunk and the app renders unstyled.
const staticSource = join(root, '.next', 'static');
const staticTarget = join(serverDir, '.next', 'static');
if (existsSync(staticSource)) {
  mkdirSync(dirname(staticTarget), { recursive: true });
  rmSync(staticTarget, { force: true, recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true });
}

console.log(`Prepared ${serverDir} for Railway (public + .next/static copied).`);
