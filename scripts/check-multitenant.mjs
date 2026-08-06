#!/usr/bin/env node
// SOURCING: none. SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0 WT8 first cut.
// Fails when packaging reintroduces boot-clone or image ENV that names a tenant/repo.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

function read(rel) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    problems.push(`missing: ${rel}`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

const entry = read('packaging/workspace/entrypoint.sh');
if (entry) {
  const activeClone = entry
    .split('\n')
    .filter((line) => /^\s*git clone\b/.test(line));
  if (activeClone.length) {
    problems.push('entrypoint.sh: boot-time git clone still present');
  }
  if (!/WORKSPACE_REPO/.test(entry) || !/retired/.test(entry)) {
    problems.push('entrypoint.sh: must refuse WORKSPACE_REPO (retired)');
  }
  // Must not compose a clone URL from THEOREM_GIT_TOKEN anymore.
  if (/x-access-token:\$\{THEOREM_GIT_TOKEN\}/.test(entry)) {
    problems.push('entrypoint.sh: still embeds THEOREM_GIT_TOKEN in clone URL');
  }
}

const docker = read('packaging/workspace/Dockerfile');
if (docker) {
  if (/COMMONPLACE_SERVICE_ALLOWED_TENANTS=Travis-Gilbert/.test(docker)) {
    problems.push('Dockerfile: default tenant ENV Travis-Gilbert');
  }
  if (/WORKSPACE_DIR=\/workspace\/repo/.test(docker)) {
    problems.push('Dockerfile: WORKSPACE_DIR still /workspace/repo');
  }
  if (/COMMONPLACE_WORKSPACE_TENANT_ALLOWED_ROOTS=.*workspace\/repo/.test(docker)) {
    problems.push('Dockerfile: tenant roots still pin /workspace/repo');
  }
}

const railway = read('packaging/workspace/railway.toml');
if (railway && /WORKSPACE_REPO_URL\s+Cloned/.test(railway)) {
  problems.push('railway.toml: still documents WORKSPACE_REPO as optional clone');
}

const opener = read('apps/theorem-vscode/src/agent/session-opener.ts');
if (opener && (/['"]\/workspace\/repo['"]/.test(opener))) {
  problems.push('session-opener.ts: hardcoded /workspace/repo cwd fallback');
}

if (problems.length) {
  console.error('gate:multitenant FAILED');
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log('gate:multitenant ok (WT8 first cut)');
