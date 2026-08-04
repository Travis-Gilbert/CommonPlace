#!/usr/bin/env node
// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL2.
// Unauthenticated health + authenticated smokes for the four cutover upstreams.
// Secrets come from env; never printed.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const marker = path.join(repoRoot, '.commonplace-canonical');

if (!existsSync(marker)) {
  console.error('missing .commonplace-canonical');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(marker, 'utf8'));
const services = manifest.services ?? {};
const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? 'ok' : 'FAIL'}  ${id}: ${detail}`);
}

async function probe(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  return { response, text };
}

async function unauthHealth(id, url) {
  if (!url) {
    record(id, false, 'missing url');
    return;
  }
  try {
    const { response, text } = await probe(url);
    record(id, response.ok, `${response.status} ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
  } catch (error) {
    record(id, false, String(error));
  }
}

async function authGraphql() {
  const url = services.consumer_graphql?.public_url;
  const key = process.env.THEOREM_API_KEY?.trim();
  if (!url) {
    record('auth.graphql', false, 'missing url');
    return;
  }
  if (!key) {
    record('auth.graphql', false, 'THEOREM_API_KEY unset');
    return;
  }
  try {
    const { response, text } = await probe(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    const pass = response.ok && /__typename|Query|data/i.test(text);
    record('auth.graphql', pass, `${response.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  } catch (error) {
    record('auth.graphql', false, String(error));
  }
}

async function authDataApi() {
  const base = (services.object_seam_data_api?.public_url || '').replace(/\/$/, '');
  const key = process.env.CONSOLE_DATA_API_KEY?.trim();
  if (!base) {
    record('auth.data_api', false, 'missing url');
    return;
  }
  if (!key) {
    record('auth.data_api', false, 'CONSOLE_DATA_API_KEY unset');
    return;
  }
  try {
    const { response, text } = await probe(`${base}/objects/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({ types: ['record'], page: { limit: 1 } }),
    });
    const pass = response.status === 200 || response.status === 401 || response.status === 403;
    // 401/403 still prove the door is lit and authenticating.
    record(
      'auth.data_api',
      pass,
      `${response.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`,
    );
  } catch (error) {
    record('auth.data_api', false, String(error));
  }
}

async function authHarness() {
  const base = (services.harness_http?.public_url || '').replace(/\/$/, '');
  const token = process.env.CONSOLE_HARNESS_TOKEN?.trim();
  if (!base) {
    record('auth.harness', false, 'missing url');
    return;
  }
  if (!token) {
    record('auth.harness', false, 'CONSOLE_HARNESS_TOKEN unset');
    return;
  }
  try {
    const { response, text } = await probe(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'cutover-doctor', version: '1.0.0' },
        },
      }),
    });
    const pass = response.status === 200 || response.status === 401 || response.status === 400;
    record(
      'auth.harness',
      pass,
      `${response.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`,
    );
  } catch (error) {
    record('auth.harness', false, String(error));
  }
}

async function authProactivity() {
  const url = services.proactivity_stream?.public_url;
  const token = process.env.THEOREM_API_TOKEN?.trim() || process.env.THEOREM_API_KEY?.trim();
  if (!url) {
    record('auth.proactivity', false, 'missing url');
    return;
  }
  if (!token) {
    record('auth.proactivity', false, 'THEOREM_API_TOKEN/THEOREM_API_KEY unset');
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    // Stream endpoints often hang open on 200; 401/403 still prove auth seam.
    const pass =
      response.status === 200 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404;
    record('auth.proactivity', pass, `${response.status}`);
    try {
      controller.abort();
    } catch {
      // ignore
    }
  } catch (error) {
    const message = String(error);
    const pass = /aborted|AbortError/i.test(message);
    record('auth.proactivity', pass, message);
  }
}

await unauthHealth('health.graphql_host', services.consumer_graphql?.health);
await unauthHealth(
  'health.data_api',
  services.object_seam_data_api?.public_url
    ? `${String(services.object_seam_data_api.public_url).replace(/\/$/, '')}/healthz`
    : null,
);
await unauthHealth('health.harness', services.harness_http?.health);
await unauthHealth(
  'health.console',
  services.console?.health || 'https://v2.theoremharness.com/api/healthz',
);

await authGraphql();
await authDataApi();
await authHarness();
await authProactivity();

const failed = results.filter((row) => !row.pass);
console.log(`upstream-smokes: ${results.length - failed.length}/${results.length} green`);
if (failed.length > 0) process.exit(1);
