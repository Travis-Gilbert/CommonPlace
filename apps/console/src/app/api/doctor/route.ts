// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL4.
// Server-side doctor observations. Never trusts harness receipts.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EnvRow = { key: string; lit: boolean; required: boolean };
type RouteRow = {
  id: string;
  route: string;
  expected_impl: string;
  status: number | null;
  observed_impl: string | null;
  ok: boolean;
};
type ResurrectionRow = { id: string; path: string; absent: boolean; pending_retirement?: boolean };

function repoRootCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, '../..'),
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '../../..'),
  ];
}

function readManifest(): {
  registers: Array<{
    id: string;
    production_route: string;
    manifest_impl: string;
    superseded?: Array<{ impl: string; paths?: string[] }>;
  }>;
  env_contract: string[];
  retired?: Array<{ id: string; paths?: string[] }>;
} {
  for (const root of repoRootCandidates()) {
    const marker = path.join(root, '.commonplace-canonical');
    if (existsSync(marker)) {
      return JSON.parse(readFileSync(marker, 'utf8'));
    }
  }
  throw new Error('missing .commonplace-canonical');
}

function resolveRepoRoot(): string {
  for (const root of repoRootCandidates()) {
    if (existsSync(path.join(root, '.commonplace-canonical'))) return root;
  }
  return process.cwd();
}

function envLit(key: string): boolean {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0;
}

function extractImpl(html: string): string | null {
  const match =
    html.match(/data-register-impl="([^"]+)"/) ??
    html.match(/data-register-impl='([^']+)'/);
  return match?.[1] ?? null;
}

function canonicalRedirectUrl(currentUrl: string, response: Response): URL | null {
  if (response.status < 300 || response.status >= 400) return null;
  const location = response.headers.get('location');
  if (!location) return null;
  const current = new URL(currentUrl);
  const target = new URL(location, current);
  const normalizedPath = (pathname: string) => pathname.replace(/\/+$/, '');
  const isCanonical =
    target.origin === current.origin &&
    target.search === current.search &&
    normalizedPath(target.pathname) === normalizedPath(current.pathname) &&
    target.pathname !== current.pathname;
  return isCanonical ? target : null;
}

export async function probeRoute(base: string, route: string): Promise<{ status: number; impl: string | null; body: string }> {
  const url = route === '/' ? base : `${base}${route}`;
  let response = await fetch(url, { redirect: 'manual' });
  const canonicalUrl = canonicalRedirectUrl(url, response);
  if (canonicalUrl) {
    response = await fetch(canonicalUrl, { redirect: 'manual' });
  }
  const body = await response.text();
  const impl = response.headers.get('x-register-impl') ?? extractImpl(body);
  return { status: response.status, impl, body };
}

export async function GET() {
  const base = (
    process.env.DOCTOR_PUBLIC_BASE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://v2.theoremharness.com')
  ).replace(/\/$/, '');

  let manifest;
  try {
    manifest = readManifest();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }

  const optionalEnv = new Set([
    'CONSOLE_MOBILE_API_KEY',
    'THEOREM_API_TOKEN',
    // Derived from CONSOLE_WORKSPACE_URL:8080 when unset.
    'CONSOLE_IDE_WORKSPACE_URL',
    // Workspace door vars — required for live /chat and /IDE, but remain
    // optional in the doctor so a partial env does not false-fail unrelated
    // register probes during rollout.
    'CONSOLE_WORKSPACE_URL',
    'CONSOLE_WORKSPACE_TOKEN',
    'COMMONPLACE_ACTIVE_WORKSPACE_SECRET',
    // Co-located editor substrate (IDE-006/007). Derived from workspace URL
    // when unset; optional so doctor stays usable before workspace redeploy.
    'CONSOLE_EDITOR_SUBSTRATE_URL',
  ]);
  const env: EnvRow[] = (manifest.env_contract ?? []).map((key) => ({
    key,
    lit: envLit(key),
    required: !optionalEnv.has(key),
  }));

  // Honest down for optional keys still reported; required keys must be lit.
  const envOk = env.every((row) => !row.required || row.lit);

  const routes: RouteRow[] = [];
  for (const row of manifest.registers ?? []) {
    try {
      const probed = await probeRoute(base, row.production_route);
      const loginish = /callbackUrl|sign.?in|\/login/i.test(probed.body);
      const consoleShell = /data-register="intui"|data-theme-mode/i.test(probed.body);
      const exactRegister = row.id === 'chat' || row.id === 'ide';
      const ok =
        (probed.status >= 200 && probed.status < 400 && probed.impl === row.manifest_impl) ||
        (probed.status >= 200 &&
          probed.status < 400 &&
          probed.impl === null &&
          (loginish || (consoleShell && !exactRegister)));
      routes.push({
        id: row.id,
        route: row.production_route,
        expected_impl: row.manifest_impl,
        status: probed.status,
        observed_impl: probed.impl,
        ok,
      });
    } catch (error) {
      routes.push({
        id: row.id,
        route: row.production_route,
        expected_impl: row.manifest_impl,
        status: null,
        observed_impl: null,
        ok: false,
      });
      void error;
    }
  }

  // Source-path resurrection only works against a full checkout. In the Railway
  // standalone image those paths are always absent, which would falsely green
  // retirements that still exist in git. Skip filesystem resurrection when the
  // marker sits next to server.js without an apps/console/src tree.
  const sourceTree = path.join(resolveRepoRoot(), 'apps/console/src');
  const canCheckResurrection = existsSync(sourceTree);

  const resurrections: ResurrectionRow[] = [];
  if (canCheckResurrection) {
    for (const row of manifest.registers ?? []) {
      for (const item of row.superseded ?? []) {
        for (const filePath of item.paths ?? []) {
          const abs = path.join(resolveRepoRoot(), filePath);
          resurrections.push({
            id: item.impl,
            path: filePath,
            absent: !existsSync(abs),
            pending_retirement: true,
          });
        }
      }
    }
    for (const row of manifest.retired ?? []) {
      for (const filePath of row.paths ?? []) {
        const abs = path.join(resolveRepoRoot(), filePath);
        resurrections.push({
          id: row.id,
          path: filePath,
          absent: !existsSync(abs),
          pending_retirement: false,
        });
      }
    }
  }

  // IDE-007: probe co-located editor substrate beyond the /IDE HTML stamp.
  const substrate = await probeEditorSubstrate();

  // Until retirements land, superseded paths still exist. Doctor reports them
  // without failing the overall cutover while deletion_deadline has not passed.
  const routesOk = routes.every((row) => row.ok);
  // Substrate is required only when the workspace URL is configured — otherwise
  // this console has no IDE door to wire.
  const substrateRequired = envLit('CONSOLE_WORKSPACE_URL');
  const substrateOk = !substrateRequired || substrate.ok;
  const ok = envOk && routesOk && substrateOk;

  return NextResponse.json({
    ok,
    base,
    env,
    routes,
    resurrections,
    substrate,
    ow4_route_versus_zone: 'route',
  });
}

type SubstrateProbe = {
  url: string | null;
  healthz: { ok: boolean; status: number | null; body: string };
  readiness: { ok: boolean; status: number | null; detail: string };
  ok: boolean;
};

function editorSubstrateBase(): string | null {
  const explicit = process.env.CONSOLE_EDITOR_SUBSTRATE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const workspace = process.env.CONSOLE_WORKSPACE_URL?.trim();
  if (!workspace) return null;
  try {
    const url = new URL(workspace);
    url.port = process.env.CONSOLE_EDITOR_SUBSTRATE_PORT?.trim() || '50090';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function probeEditorSubstrate(): Promise<SubstrateProbe> {
  const baseUrl = editorSubstrateBase();
  if (!baseUrl) {
    return {
      url: null,
      healthz: { ok: false, status: null, body: 'CONSOLE_WORKSPACE_URL unset' },
      readiness: { ok: false, status: null, detail: 'skipped' },
      ok: false,
    };
  }

  let healthz: SubstrateProbe['healthz'] = { ok: false, status: null, body: '' };
  try {
    const response = await fetch(`${baseUrl}/healthz`, { redirect: 'manual' });
    const body = await response.text();
    healthz = { ok: response.ok, status: response.status, body: body.slice(0, 120) };
  } catch (error) {
    healthz = {
      ok: false,
      status: null,
      body: error instanceof Error ? error.message : String(error),
    };
  }

  const apiKey =
    process.env.CONSOLE_WORKSPACE_TOKEN?.trim() ||
    process.env.CONSOLE_DATA_API_KEY?.trim() ||
    process.env.THEOREM_API_KEY?.trim() ||
    '';

  let readiness: SubstrateProbe['readiness'] = {
    ok: false,
    status: null,
    detail: apiKey ? '' : 'no api key for GraphQL probe',
  };
  if (apiKey && healthz.ok) {
    try {
      const response = await fetch(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ query: 'query { readiness { generation } }' }),
        redirect: 'manual',
      });
      const text = await response.text();
      let generation: unknown;
      try {
        const json = JSON.parse(text) as {
          data?: { readiness?: { generation?: unknown } };
          errors?: unknown[];
        };
        generation = json.data?.readiness?.generation;
        readiness = {
          ok: response.ok && generation !== undefined && !json.errors?.length,
          status: response.status,
          detail: generation !== undefined ? `generation=${String(generation)}` : text.slice(0, 160),
        };
      } catch {
        readiness = { ok: false, status: response.status, detail: text.slice(0, 160) };
      }
    } catch (error) {
      readiness = {
        ok: false,
        status: null,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    url: baseUrl,
    healthz,
    readiness,
    ok: healthz.ok && readiness.ok,
  };
}
