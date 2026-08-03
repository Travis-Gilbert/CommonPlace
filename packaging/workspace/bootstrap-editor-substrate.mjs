#!/usr/bin/env node
// SOURCING: none. IDE-006 — wait for co-located commonplace-api, createProject
// against /workspace/repo, persist project id for the theorem-vscode pack.
//
// Exit 0 when substrate is ready (or already bootstrapped). Exit nonzero only
// when the binary is expected and health/bootstrap fails hard.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const port = Number(process.env.EDITOR_SUBSTRATE_PORT || '50090');
const base = (process.env.EDITOR_SUBSTRATE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const rootPath = process.env.WORKSPACE_DIR || '/workspace/repo';
const stateDir = process.env.EDITOR_SUBSTRATE_STATE_DIR || '/workspace/state/editor-substrate';
const apiKey = process.env.THEOREM_EDITOR_API_KEY || process.env.COMMONPLACE_API_KEY || process.env.WORKSPACE_TOKEN || '';
const projectName = process.env.EDITOR_SUBSTRATE_PROJECT_NAME || 'workspace';
const timeoutMs = Number(process.env.EDITOR_SUBSTRATE_BOOTSTRAP_TIMEOUT_MS || '120000');
const envOut = process.env.EDITOR_SUBSTRATE_ENV_FILE || path.join(stateDir, 'editor.env');
const projectFile = path.join(stateDir, 'project_id');

function fail(message) {
  console.error(`editor-substrate: ${message}`);
  process.exit(1);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitHealthy() {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/healthz`);
      const text = await response.text();
      last = `${response.status} ${text.slice(0, 80)}`;
      if (response.ok) {
        console.log(`editor-substrate: healthy at ${base} (${last})`);
        return;
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  fail(`healthz not ready within ${timeoutMs}ms: ${last}`);
}

async function graphql(query) {
  const response = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ query }),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) {
    const detail = JSON.stringify(body.errors ?? body).slice(0, 400);
    throw new Error(`graphql ${response.status}: ${detail}`);
  }
  return body.data;
}

function writeEnv(projectId) {
  mkdirSync(stateDir, { recursive: true });
  const graphqlUrl = `${base}/graphql`;
  const invalidationsUrl = `${base}/v1/editor/invalidations?project_id=${encodeURIComponent(projectId)}`;
  const lines = [
    `THEOREM_EDITOR_GRAPHQL_URL=${graphqlUrl}`,
    `THEOREM_EDITOR_INVALIDATIONS_URL=${invalidationsUrl}`,
    `THEOREM_EDITOR_PROJECT_ID=${projectId}`,
    `THEOREM_EDITOR_API_KEY=${apiKey}`,
  ];
  writeFileSync(envOut, `${lines.join('\n')}\n`);
  writeFileSync(projectFile, `${projectId}\n`);
  console.log(`editor-substrate: wrote ${envOut} project_id=${projectId}`);
}

async function main() {
  if (!apiKey) fail('COMMONPLACE_API_KEY / WORKSPACE_TOKEN required for bootstrap');
  mkdirSync(stateDir, { recursive: true });
  await waitHealthy();

  if (existsSync(projectFile)) {
    const existing = readFileSync(projectFile, 'utf8').trim();
    if (existing) {
      // Prove the project still answers readiness before trusting the stamp.
      try {
        await graphql(`query { readiness { generation } }`);
        writeEnv(existing);
        console.log(`editor-substrate: reused project_id=${existing}`);
        return;
      } catch (error) {
        console.warn(
          `editor-substrate: stored project_id unusable (${error instanceof Error ? error.message : error}); recreating`,
        );
      }
    }
  }

  const data = await graphql(
    `mutation { createProject(name: ${JSON.stringify(projectName)}, rootPath: ${JSON.stringify(rootPath)}) { projectId } }`,
  );
  const projectId = data?.createProject?.projectId;
  if (!projectId) fail(`createProject returned no projectId: ${JSON.stringify(data)}`);
  writeEnv(projectId);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
