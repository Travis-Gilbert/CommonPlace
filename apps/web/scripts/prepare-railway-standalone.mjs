import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standaloneDir = join(root, '.next', 'standalone');
const standaloneNextDir = join(standaloneDir, '.next');

if (!existsSync(standaloneDir)) {
  throw new Error('Missing .next/standalone. Run the Railway standalone build first.');
}

const publicSource = join(root, 'public');
const publicTarget = join(standaloneDir, 'public');
if (existsSync(publicSource)) {
  rmSync(publicTarget, { force: true, recursive: true });
  cpSync(publicSource, publicTarget, { recursive: true });
}

mkdirSync(standaloneNextDir, { recursive: true });

const staticSource = join(root, '.next', 'static');
const staticTarget = join(standaloneNextDir, 'static');
if (existsSync(staticSource)) {
  rmSync(staticTarget, { force: true, recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true });
}

console.log('Prepared .next/standalone for Railway.');
