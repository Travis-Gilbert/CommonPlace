#!/usr/bin/env node
// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL1.
// Fails when registry.tsx view ids and the register manifest disagree.
//
// Rules:
// 1. Every register.registry_entry must exist as `id: '...'` in registry.tsx.
// 2. An addition to registry.tsx that is a PLACE/register surface must have a
//    manifest row (swap rule). Descriptor-only companions may exist without a
//    top-level register row; they are listed in ALLOWED_UNMANIFESTED.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const MARKER = path.join(repoRoot, '.commonplace-canonical');
const REGISTRY = path.join(
  repoRoot,
  'apps/console/src/views/registry.tsx',
);

/** Descriptors that are companions/blocks, not top-level registers. */
const ALLOWED_UNMANIFESTED = new Set([
  'chat.thread',
  'thread.list',
  'files.tree',
  'context.graph',
  'doc.list',
  'index.rail',
  'index.stream',
  'index.rules',
  'index.urgent',
  'card.full',
  'cards.grid',
  'hunk.review',
  'proactivity.graph',
  'survey.board',
  'program.canvas',
  'search.stack',
  'workspace.substrate',
  'harness.why',
  'settings.appearance',
  'settings.account',
  'kanban',
  'canvas',
  'automation.history',
  'commands.gallery',
  'agent.rail',
  'records.block',
  'record.page',
  'commonplace.console',
  'browser.pane',
  'prototype.stage',
]);

function fail(message) {
  console.error(`register-manifest check failed: ${message}`);
  process.exit(1);
}

if (!existsSync(MARKER)) fail('missing .commonplace-canonical');
if (!existsSync(REGISTRY)) fail('missing apps/console/src/views/registry.tsx');

let manifest;
try {
  manifest = JSON.parse(readFileSync(MARKER, 'utf8'));
} catch (error) {
  fail(`.commonplace-canonical is not valid JSON: ${error.message}`);
}

if (manifest.schema !== 'commonplace-canonical/v1') {
  fail(`unexpected schema ${JSON.stringify(manifest.schema)}`);
}
if (!Array.isArray(manifest.registers) || manifest.registers.length === 0) {
  fail('manifest.registers must be a non-empty array');
}

const registrySource = readFileSync(REGISTRY, 'utf8');
// Only top-level view descriptors: `id` immediately followed by `name`.
// Nested palette ids (`palette: { id: 'records' }`) are not registers.
const registryIds = new Set(
  [
    ...registrySource.matchAll(
      /\n\s*id:\s*'([^']+)',\n\s*name:\s*'/g,
    ),
  ].map((match) => match[1]),
);

if (registryIds.size === 0) {
  fail('could not extract any descriptor ids from registry.tsx');
}

const requiredEntries = new Set();
const errors = [];

for (const row of manifest.registers) {
  if (!row?.id || !row?.registry_entry || !row?.manifest_impl) {
    errors.push(`register row missing id/registry_entry/manifest_impl: ${JSON.stringify(row)}`);
    continue;
  }
  if (requiredEntries.has(row.registry_entry)) {
    errors.push(`duplicate registry_entry ${row.registry_entry}`);
  }
  requiredEntries.add(row.registry_entry);
  if (!registryIds.has(row.registry_entry)) {
    errors.push(
      `manifest register "${row.id}" names registry_entry "${row.registry_entry}" which is absent from registry.tsx`,
    );
  }
  if (!row.production_route) {
    errors.push(`register "${row.id}" missing production_route`);
  }
  if (!Array.isArray(row.superseded)) {
    errors.push(`register "${row.id}" missing superseded array`);
  } else {
    for (const item of row.superseded) {
      if (!item?.impl || !item?.deletion_deadline) {
        errors.push(`register "${row.id}" superseded item missing impl/deletion_deadline`);
      }
    }
  }
}

const registerImplPath = path.join(
  repoRoot,
  'apps/console/src/lib/register-impl.ts',
);
if (!existsSync(registerImplPath)) {
  errors.push('missing apps/console/src/lib/register-impl.ts');
} else {
  const implSource = readFileSync(registerImplPath, 'utf8');
  for (const row of manifest.registers) {
    const expected = `'${row.registry_entry}': '${row.manifest_impl}'`;
    if (!implSource.includes(expected)) {
      errors.push(
        `register-impl.ts missing mapping ${expected} (must match .commonplace-canonical)`,
      );
    }
  }
}

for (const id of registryIds) {
  if (requiredEntries.has(id)) continue;
  if (ALLOWED_UNMANIFESTED.has(id)) continue;
  // Generated palette ids like record.table.foo are allowed.
  if (id.startsWith('record.table.')) continue;
  errors.push(
    `registry.tsx declares "${id}" with no manifest register row and no ALLOWED_UNMANIFESTED entry (swap rule)`,
  );
}

if (errors.length > 0) {
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `register-manifest check: ok (${manifest.registers.length} registers, ${registryIds.size} registry ids)`,
);
