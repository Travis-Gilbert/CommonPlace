#!/usr/bin/env node
// SOURCING: none. C5 hardening for checkout consolidation.
// Fails when this tree is not the canonical CommonPlace product checkout
// (missing MaterialLayer and/or .commonplace-canonical marker).
//
// Limitation: both checked files are version-controlled, so any clone of this
// commit passes. Machine-specific path validation is intentionally out of
// scope for cloud and CI checkouts; use scripts/retire-techdev-clone.sh on the
// Mac host that still has the duplicate tree.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const MARKER = path.join(repoRoot, '.commonplace-canonical');
const MATERIAL = path.join(
  repoRoot,
  'apps/console/src/components/ground/MaterialLayer.tsx',
);

const missing = [];
if (!existsSync(MARKER)) missing.push('.commonplace-canonical');
if (!existsSync(MATERIAL)) {
  missing.push('apps/console/src/components/ground/MaterialLayer.tsx');
}

if (missing.length > 0) {
  console.error('Canonical-root assert failed. Missing:');
  for (const item of missing) console.error(`  - ${item}`);
  console.error(
    'This tree is not the Creative/Website CommonPlace canonical checkout.',
  );
  console.error(
    'Open /Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace',
  );
  console.error(
    '(or the cloud clone that carries MaterialLayer) before console island work.',
  );
  process.exit(1);
}

// SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL1: the marker is now the register
// manifest (JSON). Keep accepting presence alone for older clones, but when
// the body parses as JSON require the cutover schema so silent reversion to
// the three-line sentinel fails the gate.
const raw = readFileSync(MARKER, 'utf8').trim();
if (raw.startsWith('{')) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(
      `Canonical-root assert failed: .commonplace-canonical is not valid JSON (${error.message}).`,
    );
    process.exit(1);
  }
  if (parsed.schema !== 'commonplace-canonical/v1') {
    console.error(
      'Canonical-root assert failed: .commonplace-canonical missing schema commonplace-canonical/v1.',
    );
    process.exit(1);
  }
  if (!parsed.sentinel || !Array.isArray(parsed.registers)) {
    console.error(
      'Canonical-root assert failed: .commonplace-canonical must carry sentinel and registers[].',
    );
    process.exit(1);
  }
}

console.log('Canonical-root assert: ok (MaterialLayer + .commonplace-canonical).');
