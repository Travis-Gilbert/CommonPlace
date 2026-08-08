#!/usr/bin/env node
/**
 * Env-gated live smoke for harness `/rest/metadata/*`.
 *
 * Required: CONSOLE_METADATA_URL or CONSOLE_HARNESS_URL (mcp suffix stripped).
 * Without either, exits 0 with skipped message — LocalDev is never treated as pass.
 *
 * Usage:
 *   CONSOLE_METADATA_URL=http://127.0.0.1:8080 node apps/console/scripts/smoke-metadata-rest.mjs
 */
const baseRaw =
  process.env.CONSOLE_METADATA_URL?.trim() ||
  process.env.CONSOLE_HARNESS_URL?.trim()?.replace(/\/(?:mcp)?\/?$/, '') ||
  '';

if (!baseRaw) {
  console.log(
    'smoke-metadata-rest: SKIPPED — set CONSOLE_METADATA_URL or CONSOLE_HARNESS_URL for live oracle',
  );
  process.exit(0);
}

const base = baseRaw.replace(/\/$/, '');
const url = `${base}/rest/metadata/objects`;

const headers = {
  Accept: 'application/json',
  ...(process.env.CONSOLE_HARNESS_TOKEN
    ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
    : {}),
};

const response = await fetch(url, { headers, cache: 'no-store' });
const text = await response.text();
if (!response.ok) {
  console.error(`smoke-metadata-rest: FAIL ${response.status} ${url}\n${text.slice(0, 500)}`);
  process.exit(1);
}
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  console.error('smoke-metadata-rest: FAIL non-JSON body');
  process.exit(1);
}
const edges = parsed?.objects?.edges;
if (!Array.isArray(edges)) {
  console.error('smoke-metadata-rest: FAIL missing objects.edges');
  process.exit(1);
}
console.log(`smoke-metadata-rest: OK ${edges.length} object edge(s) from ${url}`);
