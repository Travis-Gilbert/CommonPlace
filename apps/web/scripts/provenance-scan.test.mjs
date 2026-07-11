// Planted-file self-test for the provenance gate.
//
// It writes a temporary file under apps/web/src that imports from a twenty
// package, asserts scanPath() reports a violation for that file, removes the
// temp file, then asserts the real src tree scans clean. The temp file is
// always removed, even when an assertion fails (try/finally).
//
// Usage: node scripts/provenance-scan.test.mjs
//   Prints PASS and exits 0 when both assertions hold.
//   Prints FAIL and exits nonzero otherwise.

import { writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { scanPath } from './provenance-scan.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(SCRIPT_DIR, '..', 'src');
const PLANTED_NAME = '__provenance_planted__.tmp.ts';
const PLANTED_PATH = path.join(SRC_DIR, PLANTED_NAME);

// A fixture that trips both violation classes: a twenty-package import and a
// copied-source marker string.
const PLANTED_CONTENT = [
  '// Temporary fixture written by provenance-scan.test.mjs. Auto-removed.',
  "import { Button } from 'twenty-ui';",
  '',
  '// copied from twentyhq/twenty',
  '',
  'export const planted = Button;',
  '',
].join('\n');

let plantedOnDisk = false;

try {
  writeFileSync(PLANTED_PATH, PLANTED_CONTENT, 'utf8');
  plantedOnDisk = true;

  // Assertion 1: the planted file trips both violation classes (a twenty import
  // and a copied-source marker), so the self-test exercises the whole scanner.
  const withPlanted = scanPath(SRC_DIR);
  const plantedHits = withPlanted.filter(
    (violation) => violation.file === PLANTED_PATH || violation.file.endsWith(PLANTED_NAME),
  );
  if (plantedHits.length === 0) {
    throw new Error(`planted violations in ${PLANTED_NAME} were not detected by scanPath()`);
  }
  const plantedReasons = plantedHits.map((violation) => violation.reason).join('; ');
  if (!plantedReasons.includes('import from twenty package')) {
    throw new Error(`planted twenty import not detected; reasons: ${plantedReasons}`);
  }
  if (!plantedReasons.includes('copied-source marker')) {
    throw new Error(`planted copied-source marker not detected; reasons: ${plantedReasons}`);
  }

  // Remove the temp file so the clean check runs against the real tree only.
  rmSync(PLANTED_PATH, { force: true });
  plantedOnDisk = false;

  // Assertion 2: the real src tree (temp excluded) is clean.
  const clean = scanPath(SRC_DIR);
  if (clean.length > 0) {
    const listed = clean.map((v) => `  ${v.file}:${v.line}: ${v.reason}`).join('\n');
    throw new Error(`real src tree is not clean: ${clean.length} violation(s)\n${listed}`);
  }

  console.log(`PASS: planted import + marker detected [${plantedReasons}]; real src tree scans clean (0 violations).`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (plantedOnDisk && existsSync(PLANTED_PATH)) {
    rmSync(PLANTED_PATH, { force: true });
  }
}
