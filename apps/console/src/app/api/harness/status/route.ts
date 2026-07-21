// SOURCING: none. Same-origin route adapter over the Harness status contract.

import { callHarnessMcp } from '@/lib/server/harness-mcp';
import { callHarnessGraphql } from '@/lib/server/harness-graphql';
import {
  normalizeStatusReport,
  readStatusScope,
  serializeStatusScope,
  type StatusReport,
  type StatusScope,
} from '@/lib/harness-ux';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = record(await request.json().catch(() => null));
  const scope = readStatusScope(body?.scope ?? { kind: 'all' });
  if (!scope) return Response.json({ error: 'status_scope_required' }, { status: 400 });
  return statusResponse(scope);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const scope = readStatusScope(
    kind === 'run'
      ? { kind, runId: url.searchParams.get('runId') }
      : kind === 'room'
        ? { kind, roomId: url.searchParams.get('roomId') }
        : { kind: 'all' },
  );
  if (!scope) return Response.json({ error: 'status_scope_required' }, { status: 400 });
  return statusResponse(scope);
}

function statusQuery(): string {
  return 'query ConsoleHarnessStatus($scope: JSON) { status(scope: $scope) }';
}

async function statusResponse(scope: StatusScope): Promise<Response> {
  const graphql = await callHarnessGraphql(statusQuery(), {
    scope: serializeStatusScope(scope),
  });
  if (!graphql.ok && graphql.response && (graphql.status === 401 || graphql.status === 403)) return graphql.response;
  if (graphql.ok) {
    const report = normalizeStatusReport(graphql.data.status);
    if (report) return Response.json(withMissing(report, ['live_refresh']));
  }

  const flat = await callHarnessMcp('status', { scope: serializeStatusScope(scope) });
  if (!flat.ok) {
    if (flat.response.status === 401 || flat.response.status === 403) return flat.response;
    return Response.json(degradedStatus([
      `graphql:${graphql.ok ? 'invalid_status_projection' : graphql.error}`,
      `mcp:${await responseError(flat.response)}`,
      'live_refresh',
    ]));
  }
  const report = normalizeStatusReport(flat.data.status ?? flat.data);
  if (report) return Response.json(withMissing(report, ['live_refresh']));
  return Response.json(degradedStatus(['status_projection_invalid', 'live_refresh']));
}

function withMissing(report: StatusReport, missing: string[]): StatusReport {
  const merged = [...report.degradation.missing];
  for (const item of missing) {
    if (!merged.includes(item)) merged.push(item);
  }
  return {
    ...report,
    degradation: { degraded: report.degradation.degraded || merged.length > 0, missing: merged },
  };
}

function degradedStatus(missing: string[]): StatusReport {
  return {
    runs: [],
    waitingOnYou: [],
    coordination: { roomId: null, intents: [], unreadStreamDeltas: 0 },
    cost: { visible: false, today: null, perRun: [], priceTableVersion: null },
    degradation: { degraded: true, missing },
    generation: 0,
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
