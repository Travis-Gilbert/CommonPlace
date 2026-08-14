#!/usr/bin/env node
/**
 * SI-R2 / HANDOFF-SIGNED-PRINCIPAL-IDENTITY D3:
 * Scan Next client bundle assets for signing-key leakage.
 *
 * Exit 0: no hits (or .next missing and CONSOLE_REQUIRE_BUNDLE_SCAN unset).
 * Exit 1: hits found, or .next missing when CONSOLE_REQUIRE_BUNDLE_SCAN=1.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const nextDir = join(root, '.next');
const requireScan = process.env.CONSOLE_REQUIRE_BUNDLE_SCAN === '1';

const patterns = [
  /CONSOLE_SIGNED_REQUEST_SECRET_KEY_HEX/,
  /CONSOLE_SIGNED_REQUEST_SEEDS_JSON/,
  /signed-request-custody/,
  /secretKeyHex/,
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(path, out);
    else if (/\.(js|mjs|cjs|css|map|html)$/.test(name)) out.push(path);
  }
  return out;
}

if (!existsSync(nextDir)) {
  if (requireScan) {
    console.error('check-signed-request-client-bundle: .next missing and CONSOLE_REQUIRE_BUNDLE_SCAN=1');
    process.exit(1);
  }
  console.log('check-signed-request-client-bundle: .next absent; skip (set CONSOLE_REQUIRE_BUNDLE_SCAN=1 to require)');
  process.exit(0);
}

// Client assets only. Server chunks may legally reference custody env names.
const targets = [
  join(nextDir, 'static'),
].filter((p) => existsSync(p));

const files = targets.flatMap((dir) => walk(dir));
const hits = [];

for (const file of files) {
  // Skip sourceless huge maps only when clearly server-only RSC flight dumps.
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      hits.push(`${relative(root, file)} matches ${pattern}`);
      break;
    }
  }
}

if (hits.length > 0) {
  console.error('check-signed-request-client-bundle: FAIL');
  for (const hit of hits.slice(0, 40)) console.error(`  ${hit}`);
  if (hits.length > 40) console.error(`  ... ${hits.length - 40} more`);
  process.exit(1);
}

console.log(`check-signed-request-client-bundle: ok (${files.length} files scanned)`);
process.exit(0);
