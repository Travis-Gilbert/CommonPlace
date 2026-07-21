// SOURCING: none. Same-origin route adapter over the Harness why contract.

import { callHarnessMcp } from '@/lib/server/harness-mcp';
import { callHarnessGraphql } from '@/lib/server/harness-graphql';
import {
  normalizeWhyReport,
  readWhyTarget,
  type WhyReport,
  type WhyTarget,
} from '@/lib/harness-ux';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = record(await request.json().catch(() => null));
  const target = readWhyTarget(body?.target);
  if (!target) return Response.json({ error: 'why_target_required' }, { status: 400 });
  return whyResponse(target);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = readWhyTarget({
    kind: url.searchParams.get('kind'),
    id: url.searchParams.get('id'),
  });
  if (!target) return Response.json({ error: 'why_target_required' }, { status: 400 });
  return whyResponse(target);
}

async function whyResponse(target: WhyTarget): Promise<Response> {
  const graphql = await callHarnessGraphql(
    'query ConsoleHarnessWhy($target: JSON!) { why(target: $target) }',
    { target },
  );
  if (!graphql.ok && graphql.response && (graphql.status === 401 || graphql.status === 403)) return graphql.response;
  if (graphql.ok) {
    const report = normalizeWhyReport(graphql.data.why);
    if (report) return Response.json(report);
  }

  const flat = await callHarnessMcp('why', { target });
  if (!flat.ok) {
    if (flat.response.status === 401 || flat.response.status === 403) return flat.response;
    return Response.json(degradedWhy(target, [
      `graphql:${graphql.ok ? 'invalid_why_projection' : graphql.error}`,
      `mcp:${await responseError(flat.response)}`,
    ]));
  }
  const report = normalizeWhyReport(flat.data.why ?? flat.data);
  if (report) return Response.json(report);
  return Response.json(degradedWhy(target, ['why_projection_invalid']));
}

function degradedWhy(target: WhyTarget, missing: string[]): WhyReport {
  return {
    target,
    kind: 'unavailable',
    trace: { reason: 'why door unavailable' },
    refs: [],
    degradation: { degraded: true, missing },
    refusal: null,
  };
}

async function responseError(response: Response): Promise<string> {
  const body = record(await response.clone().json().catch(() => null));
  return typeof body?.error === 'string' ? body.error : `http_${response.status}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
