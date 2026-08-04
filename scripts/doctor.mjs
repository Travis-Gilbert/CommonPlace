#!/usr/bin/env node
// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL4.
// Observes production. Does not believe harness receipts.
//
// Usage:
//   node scripts/doctor.mjs
//   DOCTOR_BASE_URL=https://v2.theoremharness.com node scripts/doctor.mjs
//
// Exit 0 only when every assertion is green. Staging reds:
//   DOCTOR_EXPECT_ENV_RED=THEOREM_API_TOKEN
//   DOCTOR_EXPECT_IMPL_RED=/Data-model:legacy.plan-id.Data-model

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const MARKER = path.join(repoRoot, '.commonplace-canonical');

const baseUrl = (process.env.DOCTOR_BASE_URL || 'https://v2.theoremharness.com').replace(/\/$/, '');
const expectEnvRed = process.env.DOCTOR_EXPECT_ENV_RED?.trim() || '';
const expectImplRed = process.env.DOCTOR_EXPECT_IMPL_RED?.trim() || '';

function fail(message) {
  console.error(`doctor FAIL: ${message}`);
}

function ok(message) {
  console.log(`doctor ok: ${message}`);
}

if (!existsSync(MARKER)) {
  fail('missing .commonplace-canonical');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MARKER, 'utf8'));
const results = [];

async function fetchText(url, init) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...init,
  });
  const text = await response.text();
  return { response, text };
}

async function checkConsoleHealth() {
  const { response, text } = await fetchText(`${baseUrl}/api/healthz`);
  const pass = response.ok && text.includes('commonplace-console');
  results.push({ id: 'console.health', pass, detail: `${response.status} ${text.slice(0, 120)}` });
  (pass ? ok : fail)(`console health ${response.status}`);
}

async function checkDoctorPage() {
  const { response, text } = await fetchText(`${baseUrl}/doctor`);
  const pass = response.ok && text.includes('data-doctor-page');
  results.push({ id: 'doctor.page', pass, detail: `${response.status}` });
  (pass ? ok : fail)(`doctor page ${response.status}`);
}

async function checkRegisterRoutes() {
  for (const row of manifest.registers ?? []) {
    const route = row.production_route;
    if (!route || route === '/') continue;
    const { response, text } = await fetchText(`${baseUrl}${route}`);
    const marker = `data-register-impl="${row.manifest_impl}"`;
    const hasMarker = text.includes(marker) || text.includes(`data-register-impl='${row.manifest_impl}'`);
    // Unauthenticated routes may redirect to login HTML without the marker.
    // Accept 200 with marker, or a login / console-shell response when the
    // register body is behind an authenticated place.
    const loginish = response.status === 200 && /callbackUrl|sign.?in|login/i.test(text);
    const consoleShell = response.status === 200 && /data-register="intui"|data-theme-mode/i.test(text);
    const pass = response.ok && (hasMarker || loginish || (consoleShell && row.id !== 'chat' && row.id !== 'ide'));
    results.push({
      id: `route.${row.id}`,
      pass,
      detail: `${response.status} marker=${hasMarker} loginish=${loginish} shell=${consoleShell}`,
    });
    (pass ? ok : fail)(`route ${route} (${row.manifest_impl}) marker=${hasMarker}`);
  }
}

async function checkDoctorApi() {
  const { response, text } = await fetchText(`${baseUrl}/api/doctor`);
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const pass = response.ok && body?.ok === true;
  results.push({ id: 'doctor.api', pass, detail: `${response.status} ${text.slice(0, 200)}` });
  (pass ? ok : fail)(`doctor api ok=${body?.ok}`);

  if (expectEnvRed) {
    const envDown = Array.isArray(body?.env) && body.env.some((row) => row.key === expectEnvRed && row.lit === false);
    results.push({ id: 'doctor.env_red', pass: envDown, detail: expectEnvRed });
    (envDown ? ok : fail)(`expected env red for ${expectEnvRed}`);
  }

  if (expectImplRed) {
    const [route, impl] = expectImplRed.split(':');
    const mismatch =
      Array.isArray(body?.routes) &&
      body.routes.some((row) => row.route === route && row.observed_impl === impl);
    results.push({ id: 'doctor.impl_red', pass: mismatch, detail: expectImplRed });
    (mismatch ? ok : fail)(`expected impl red ${expectImplRed}`);
  }

  if (Array.isArray(body?.resurrections)) {
    for (const row of body.resurrections) {
      // Superseded paths remain until GL8 deletion deadlines; only retired rows
      // must be absent for the doctor to stay green.
      if (row.pending_retirement) {
        ok(`resurrection pending ${row.id} present=${!row.absent}`);
        continue;
      }
      const passResurrection = row.absent === true;
      results.push({ id: `resurrection.${row.id}`, pass: passResurrection, detail: JSON.stringify(row) });
      (passResurrection ? ok : fail)(`resurrection ${row.id} absent=${row.absent}`);
    }
  }

  // IDE-007: substrate beyond HTML stamp (healthz + readiness GraphQL).
  if (body?.substrate) {
    const sub = body.substrate;
    const healthPass = sub.healthz?.ok === true;
    const readyPass = sub.readiness?.ok === true;
    results.push({
      id: 'substrate.healthz',
      pass: healthPass,
      detail: `${sub.url ?? 'none'} ${sub.healthz?.status} ${sub.healthz?.body ?? ''}`,
    });
    (healthPass ? ok : fail)(`substrate healthz ${sub.healthz?.status}`);
    results.push({
      id: 'substrate.readiness',
      pass: readyPass,
      detail: `${sub.readiness?.status} ${sub.readiness?.detail ?? ''}`,
    });
    (readyPass ? ok : fail)(`substrate readiness ${sub.readiness?.detail ?? ''}`);
  } else {
    results.push({ id: 'substrate', pass: false, detail: 'doctor api missing substrate field' });
    fail('doctor api missing substrate field');
  }

  // Production /api/doctor skips source-tree resurrection (standalone has no
  // apps/console/src). The CLI checkout still proves retired corpses are gone.
  for (const row of manifest.retired ?? []) {
    for (const filePath of row.paths ?? []) {
      const abs = path.join(repoRoot, filePath);
      const absent = !existsSync(abs);
      results.push({
        id: `resurrection.local.${row.id}`,
        pass: absent,
        detail: `${filePath} absent=${absent}`,
      });
      (absent ? ok : fail)(`local resurrection ${row.id} ${filePath} absent=${absent}`);
    }
  }
}

async function checkUpstreams() {
  const services = manifest.services ?? {};
  const probes = [
    ['consumer_graphql', services.consumer_graphql?.health],
    ['harness_http', services.harness_http?.health],
    ['object_seam_data_api', services.object_seam_data_api?.public_url ? `${services.object_seam_data_api.public_url.replace(/\/$/, '')}/healthz` : null],
  ];
  for (const [id, url] of probes) {
    if (!url) {
      results.push({ id: `upstream.${id}`, pass: false, detail: 'missing url in manifest' });
      fail(`upstream ${id} missing url`);
      continue;
    }
    try {
      const { response, text } = await fetchText(url);
      const pass = response.ok;
      results.push({ id: `upstream.${id}`, pass, detail: `${response.status} ${text.slice(0, 80)}` });
      (pass ? ok : fail)(`upstream ${id} ${response.status}`);
    } catch (error) {
      results.push({ id: `upstream.${id}`, pass: false, detail: String(error) });
      fail(`upstream ${id} ${error}`);
    }
  }
}

await checkConsoleHealth();
await checkDoctorPage();
await checkDoctorApi();
await checkRegisterRoutes();
await checkUpstreams();

const failed = results.filter((row) => !row.pass);
console.log(`doctor summary: ${results.length - failed.length}/${results.length} green`);
if (failed.length > 0) {
  for (const row of failed) console.error(`  - ${row.id}: ${row.detail}`);
  process.exit(1);
}
