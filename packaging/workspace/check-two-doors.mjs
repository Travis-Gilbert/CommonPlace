#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW5 acceptance, checked statically.
//
// The deliverable's two claims are structural, not behavioral: both doors open
// the same directory, and both authenticate against the same secret. Both are
// decided entirely by the entrypoint, so they can be checked without a running
// container, and checking them here is what makes the claims falsifiable on a
// machine that has no Docker daemon.
//
// This is not a substitute for running the image. It catches the failure that
// actually happens in practice: someone adds a second path or a second secret
// and the drift is invisible until a user's edit vanishes between the doors.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const entrypoint = readFileSync(path.join(here, 'entrypoint.sh'), 'utf8');
const dockerfile = readFileSync(path.join(here, 'Dockerfile'), 'utf8');

const failures = [];
const checks = [];

function check(label, ok, detail) {
  checks.push({ label, ok });
  if (!ok) failures.push(detail ?? label);
}

// Strip comments: the prose below legitimately names the very things these
// checks forbid, the same reason the fork's conformance audit strips them.
const code = entrypoint
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

// --- One checkout ---------------------------------------------------------
const codeServerRoot = code.match(/code-server[\s\S]*?"(\$\{WORKSPACE_DIR\})"/);
const openworkRoot = code.match(/--workspace "(\$\{WORKSPACE_DIR\})"/);
check(
  'the IDE door opens ${WORKSPACE_DIR}',
  Boolean(codeServerRoot),
  'code-server is not started against ${WORKSPACE_DIR}',
);
check(
  'the chat door opens ${WORKSPACE_DIR}',
  Boolean(openworkRoot),
  'openwork-server is not started with --workspace "${WORKSPACE_DIR}"',
);

// A second root anywhere in the started commands is the drift this exists to
// catch: two paths means a copy, and a copy means a sync step.
const roots = new Set([...code.matchAll(/\$\{(WORKSPACE_DIR|[A-Z_]*DIR)[^}]*\}/g)].map((m) => m[1]));
check(
  'exactly one workspace root is referenced',
  roots.size === 1 && roots.has('WORKSPACE_DIR'),
  `expected only WORKSPACE_DIR, found: ${[...roots].join(', ')}`,
);

// --- One token ------------------------------------------------------------
check(
  'the IDE door authenticates against WORKSPACE_TOKEN',
  /export PASSWORD="\$\{WORKSPACE_TOKEN\}"/.test(code) && /--auth password/.test(code),
  'code-server does not read WORKSPACE_TOKEN through PASSWORD with --auth password',
);
check(
  'the chat door authenticates against WORKSPACE_TOKEN',
  /export OPENWORK_HOST_TOKEN="\$\{WORKSPACE_TOKEN\}"/.test(code),
  'openwork-server does not read WORKSPACE_TOKEN through OPENWORK_HOST_TOKEN',
);
check(
  'a missing token stops the container',
  /if \[ -z "\$\{WORKSPACE_TOKEN:-\}" \]/.test(code) && /exit 64/.test(code),
  'the entrypoint starts without WORKSPACE_TOKEN, which would expose an unauthenticated IDE',
);

// --- The volume -----------------------------------------------------------
check(
  'the checkout is on a volume',
  /VOLUME \["\/workspace"\]/.test(dockerfile),
  'no VOLUME at /workspace: the checkout would live in the container layer and be discarded on deploy',
);
check(
  'both doors are exposed',
  /EXPOSE 8787 8080/.test(dockerfile),
  'the image does not expose both door ports',
);

// --- Pins -----------------------------------------------------------------
check(
  'code-server is version-pinned',
  /ARG CODE_SERVER_VERSION=\d+\.\d+\.\d+/.test(dockerfile),
  'code-server is installed unpinned, so every build produces a different image',
);
check(
  'opencode is version-pinned',
  /ARG OPENCODE_VERSION=\d+\.\d+\.\d+/.test(dockerfile),
  'opencode is installed unpinned',
);

for (const { label, ok } of checks) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
}

if (failures.length === 0) {
  console.log(`\nPASS - two doors, one checkout, one token (${checks.length} checks).`);
  process.exit(0);
}

console.error(`\nFAIL - ${failures.length} of ${checks.length} checks failed:`);
for (const failure of failures) console.error(`  ${failure}`);
process.exit(1);
