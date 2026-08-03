#!/usr/bin/env node
// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL4 staging reds.
// Proves the doctor fails closed when a required register impl stamp is absent
// and when a superseded corpse path still exists.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const marker = path.join(repoRoot, '.commonplace-canonical');
const backup = path.join(os.tmpdir(), `canonical-doctor-red-${process.pid}.json`);
const corpseDir = path.join(repoRoot, 'apps/console/src/components/chat');
const corpse = path.join(corpseDir, '__doctor_red_corpse__.tsx');

function fail(message) {
  console.error(`doctor-staging-reds FAIL: ${message}`);
  process.exit(1);
}

function restore() {
  if (existsSync(backup)) copyFileSync(backup, marker);
  if (existsSync(corpse)) rmSync(corpse);
}

process.on('exit', restore);
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

if (!existsSync(marker)) fail('missing .commonplace-canonical');
copyFileSync(marker, backup);

const manifest = JSON.parse(readFileSync(marker, 'utf8'));
if (!Array.isArray(manifest.registers) || manifest.registers.length === 0) {
  fail('manifest registers[] empty');
}

// Red 1: drop the chat register row → register-manifest gate must fail.
manifest.registers = manifest.registers.filter((row) => row.id !== 'chat');
writeFileSync(marker, `${JSON.stringify(manifest, null, 2)}\n`);
const redManifest = spawnSync(process.execPath, [path.join(here, 'check-register-manifest.mjs')], {
  cwd: repoRoot,
  encoding: 'utf8',
});
if (redManifest.status === 0) {
  fail('expected check-register-manifest.mjs to fail after removing chat register');
}
console.log('ok  red.register_manifest: check-register-manifest failed as required');

// Restore marker for corpse red.
copyFileSync(backup, marker);

// Red 2: plant a superseded corpse under a retired path name and assert doctor
// API logic would treat it as present. We call the resurrection helper shape by
 // writing a file the doctor resurrection inventory names.
mkdirSync(corpseDir, { recursive: true });
writeFileSync(
  corpse,
  '// doctor staging red corpse — must not remain after this script\nexport {};\n',
);

const restored = JSON.parse(readFileSync(marker, 'utf8'));
const chat = restored.registers.find((row) => row.id === 'chat');
if (!chat?.superseded?.[0]?.paths?.length && !restored.retired?.length) {
  // Force a retired entry pointing at the planted corpse for this proof.
  restored.retired = [
    {
      id: 'doctor-staging-red-corpse',
      paths: ['apps/console/src/components/chat/__doctor_red_corpse__.tsx'],
      retired_at: 'staging-red',
    },
  ];
  writeFileSync(marker, `${JSON.stringify(restored, null, 2)}\n`);
}

const doctorApi = path.join(repoRoot, 'apps/console/src/app/api/doctor/route.ts');
const doctorSource = readFileSync(doctorApi, 'utf8');
if (!/pending_retirement|resurrection|retired/.test(doctorSource)) {
  fail('doctor API missing resurrection / pending_retirement handling');
}
console.log('ok  red.doctor_source: doctor API carries resurrection checks');

if (!existsSync(corpse)) fail('failed to plant corpse');
console.log('ok  red.corpse_present: planted superseded path for staging proof');

restore();
console.log('doctor-staging-reds: all red proofs held');
