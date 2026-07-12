import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const standaloneDir = join(root, '.next', 'standalone');

if (!existsSync(standaloneDir)) {
  throw new Error('Missing .next/standalone. Run the Railway standalone build first.');
}

// Next emits server.js next to a copy of the app tree. Its location depends on
// the file-tracing root: a single-package build puts it at the standalone root,
// but this monorepo build (turbopack.root = repo root) nests it under apps/web.
// The standalone server serves /_next/static from <serverDir>/.next/static and
// public/ from <serverDir>/public, so both must land next to the ACTUAL
// server.js, not at the standalone root. Mirror start-railway.mjs's candidates.
const serverDirCandidates = [standaloneDir, join(standaloneDir, 'apps', 'web')];
const serverDir = serverDirCandidates.find((dir) => existsSync(join(dir, 'server.js')));

if (!serverDir) {
  throw new Error(
    `Missing standalone server.js. Checked: ${serverDirCandidates
      .map((dir) => join(dir, 'server.js'))
      .join(', ')}`
  );
}

// Next 16 already copies public/ into the standalone tree, but repeat it so the
// repo public/ stays the source of truth and the step is idempotent.
const publicSource = join(root, 'public');
const publicTarget = join(serverDir, 'public');
if (existsSync(publicSource)) {
  rmSync(publicTarget, { force: true, recursive: true });
  cpSync(publicSource, publicTarget, { recursive: true });
}

// .next/static is never auto-copied. Without this the standalone server 404s
// every JS/CSS chunk and the app renders as unstyled raw HTML.
const staticSource = join(root, '.next', 'static');
const staticTarget = join(serverDir, '.next', 'static');
if (existsSync(staticSource)) {
  mkdirSync(dirname(staticTarget), { recursive: true });
  rmSync(staticTarget, { force: true, recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true });
}

console.log(`Prepared ${serverDir} for Railway (public + .next/static copied).`);
