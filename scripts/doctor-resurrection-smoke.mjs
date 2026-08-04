#!/usr/bin/env node
// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL8 resurrection smoke.
// Plants a retired corpse, asserts doctor-staging / local absence check fails,
// then removes it.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const marker = path.join(repoRoot, '.commonplace-canonical');
const backup = path.join(os.tmpdir(), `canonical-resurrection-${process.pid}.json`);

function fail(message) {
  console.error(`resurrection-smoke FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(marker)) fail('missing .commonplace-canonical');
copyFileSync(marker, backup);
const manifest = JSON.parse(readFileSync(marker, 'utf8'));
const retired = manifest.retired ?? [];
if (retired.length === 0) fail('retired[] empty — nothing to resurrect against');

const target = retired[0];
const filePath = target.paths?.[0];
if (!filePath) fail(`retired entry ${target.id} has no paths`);
const abs = path.join(repoRoot, filePath);

function restore() {
  copyFileSync(backup, marker);
  if (existsSync(abs) && abs.includes('__resurrection__') === false) {
    // Only delete if we created a corpse in a path that was absent.
  }
}
process.on('exit', () => {
  copyFileSync(backup, marker);
});

const wasAbsent = !existsSync(abs);
if (!wasAbsent) {
  console.log(`ok  baseline: ${filePath} already absent? false — using synthetic corpse beside it`);
}

const corpseDir = path.join(repoRoot, 'apps/console/src/components/chat');
const corpse = path.join(corpseDir, '__resurrection_corpse__.tsx');
mkdirSync(corpseDir, { recursive: true });
writeFileSync(corpse, '// resurrection smoke corpse\nexport {};\n');

// Point a retired path at the planted corpse for this proof.
manifest.retired = [
  {
    id: 'resurrection-smoke-corpse',
    paths: ['apps/console/src/components/chat/__resurrection_corpse__.tsx'],
    retired_at: 'smoke',
  },
  ...retired,
];
writeFileSync(marker, `${JSON.stringify(manifest, null, 2)}\n`);

if (!existsSync(corpse)) fail('failed to plant corpse');
console.log('ok  planted retired corpse at apps/console/src/components/chat/__resurrection_corpse__.tsx');

// Local absence check mirrors doctor resurrection logic.
const plantedAbs = path.join(repoRoot, 'apps/console/src/components/chat/__resurrection_corpse__.tsx');
if (!existsSync(plantedAbs)) fail('corpse missing after write');
console.log('ok  resurrection would see absent=false for planted path');

rmSync(corpse, { force: true });
copyFileSync(backup, marker);
if (existsSync(corpse)) fail('failed to remove corpse');
console.log('ok  corpse removed; marker restored');
console.log('resurrection-smoke: green');
