// SOURCING: none. Same-origin route adapter for ACP boot context.

import { callHarnessMcp } from '@/lib/server/harness-mcp';
import { callHarnessGraphql } from '@/lib/server/harness-graphql';
import {
  normalizeBootPayload,
  normalizeStatusReport,
  type BootPayload,
} from '@/lib/harness-ux';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  // Boot is a flat/hook door (U6). There is no GraphQL root boot field.
  const flat = await callHarnessMcp('boot', { token_cap: 2000 });
  if (flat.ok) {
    const boot = normalizeBootPayload(flat.data);
    if (boot) return Response.json(boot);
  } else if (flat.response.status === 401 || flat.response.status === 403) {
    return flat.response;
  }

  const mcpMissing = flat.ok
    ? 'boot_projection_invalid'
    : `mcp:${await responseError(flat.response)}`;

  // Fallback: pull a status digest so ACP still gets a bounded orientation brief.
  const graphql = await callHarnessGraphql(
    'query ConsoleHarnessStatusDigest($scope: JSON) { status(scope: $scope) }',
    { scope: { kind: 'all' } },
  );
  if (!graphql.ok && graphql.response && (graphql.status === 401 || graphql.status === 403)) {
    return graphql.response;
  }
  if (graphql.ok) {
    const status = normalizeStatusReport(graphql.data.status);
    return Response.json({
      brief: 'Harness session boot.',
      markdown: status
        ? `## Harness boot\n\nStatus digest available. Live boot door degraded.\n`
        : null,
      status,
      context: null,
      degradation: {
        degraded: true,
        missing: ['boot_door', mcpMissing],
      },
      generation: 0,
    } satisfies BootPayload);
  }

  return Response.json(degradedBoot([
    mcpMissing,
    `graphql:${graphql.error}`,
  ]));
}

function degradedBoot(missing: string[]): BootPayload {
  return {
    brief: null,
    markdown: null,
    status: null,
    context: null,
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
