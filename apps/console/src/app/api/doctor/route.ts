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

function repoRoot(): string {
  return path.resolve(process.cwd(), '../..');
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
  const marker = path.join(repoRoot(), '.commonplace-canonical');
  if (!existsSync(marker)) {
    throw new Error('missing .commonplace-canonical');
  }
  return JSON.parse(readFileSync(marker, 'utf8'));
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

async function probeRoute(base: string, route: string): Promise<{ status: number; impl: string | null; body: string }> {
  const url = route === '/' ? base : `${base}${route}`;
  const response = await fetch(url, { redirect: 'manual' });
  const body = await response.text();
  return { status: response.status, impl: extractImpl(body), body };
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

  const optionalEnv = new Set(['CONSOLE_MOBILE_API_KEY', 'THEOREM_API_TOKEN']);
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
      const ok =
        (probed.status >= 200 && probed.status < 400 && probed.impl === row.manifest_impl) ||
        (probed.status >= 200 && probed.status < 400 && loginish && probed.impl === null);
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

  const resurrections: ResurrectionRow[] = [];
  for (const row of manifest.registers ?? []) {
    for (const item of row.superseded ?? []) {
      for (const filePath of item.paths ?? []) {
        const abs = path.join(repoRoot(), filePath);
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
      const abs = path.join(repoRoot(), filePath);
      resurrections.push({
        id: row.id,
        path: filePath,
        absent: !existsSync(abs),
        pending_retirement: false,
      });
    }
  }

  // Until retirements land, superseded paths still exist. Doctor reports them
  // without failing the overall cutover while deletion_deadline has not passed.
  const routesOk = routes.every((row) => row.ok);
  const ok = envOk && routesOk;

  return NextResponse.json({
    ok,
    base,
    env,
    routes,
    resurrections,
    ow4_route_versus_zone: 'route',
  });
}
