#!/usr/bin/env node
/**
 * SI-R3 / D3 acceptance: live Workspace path authenticated by signature.
 *
 * Requires:
 *   CONSOLE_SIGNED_REQUEST_SMOKE=1
 *   CONSOLE_BASE_URL (default http://127.0.0.1:3010)
 *   Session cookie or auth headers for a signed-in user whose principal is
 *   bound to a seed (CONSOLE_SIGNED_REQUEST_SEEDS_JSON or owner global seed).
 *   Upstream COMMONPLACE_SIGNED_PUBLIC_KEYS must register the matching pubkey.
 *
 * Without CONSOLE_SIGNED_REQUEST_SMOKE=1 this exits 0 and prints skipped.
 */

const enabled = process.env.CONSOLE_SIGNED_REQUEST_SMOKE === '1';
if (!enabled) {
  console.log('smoke-signed-workspace: skipped (set CONSOLE_SIGNED_REQUEST_SMOKE=1)');
  process.exit(0);
}

const base = (process.env.CONSOLE_BASE_URL ?? 'http://127.0.0.1:3010').replace(/\/$/, '');
const cookie = process.env.CONSOLE_SMOKE_COOKIE ?? '';
const path = process.env.CONSOLE_SMOKE_WORKSPACE_PATH ?? '/api/workspace';

const headers = { accept: 'application/json' };
if (cookie) headers.cookie = cookie;

const url = `${base}${path}`;
const res = await fetch(url, { headers, redirect: 'manual' });
const body = await res.text();

if (res.status === 401 || res.status === 403) {
  console.error(`smoke-signed-workspace: auth refused ${res.status}`);
  console.error(body.slice(0, 500));
  process.exit(1);
}

if (res.status < 200 || res.status >= 300) {
  console.error(`smoke-signed-workspace: unexpected status ${res.status}`);
  console.error(body.slice(0, 500));
  process.exit(1);
}

if (/unknown_key|bad_signature|principal_credential_unavailable|signed_request/.test(body)
  && /error/.test(body)) {
  console.error('smoke-signed-workspace: response body looks like a credential error');
  console.error(body.slice(0, 500));
  process.exit(1);
}

console.log(`smoke-signed-workspace: ok ${res.status} ${url}`);
process.exit(0);
