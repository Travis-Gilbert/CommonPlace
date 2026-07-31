// SOURCING: none. Server-side GraphQL transport helper for Harness routes.

import 'server-only';

import { callHarnessMcp } from '@/lib/server/harness-mcp';
import type { HarnessPrincipal } from '@/lib/server/harness-principal';

export type HarnessGraphqlMode = 'query' | 'mutate';

export type HarnessGraphqlResult =
  | { ok: true; data: Record<string, unknown>; principal: HarnessPrincipal }
  | { ok: false; status: number; error: string; response?: Response };

const NAMED_MCP_FAILURES = new Set([
  'mcp_authentication_failed',
  'mcp_session_uninitialized',
  'mcp_not_acceptable',
]);

export async function callHarnessGraphql(
  query: string,
  variables: Record<string, unknown> = {},
  mode: HarnessGraphqlMode = 'query',
): Promise<HarnessGraphqlResult> {
  const result = await callHarnessMcp(
    mode === 'mutate' ? 'graphql_mutate' : 'graphql_query',
    { query, variables },
  );
  if (!result.ok) {
    return graphqlFailure(result.response);
  }

  const errors = Array.isArray(result.data.errors) ? result.data.errors : [];
  const data = record(result.data.data);
  if (errors.length > 0 || !data) {
    const first = record(errors[0]);
    return {
      ok: false,
      status: 502,
      error: typeof first?.message === 'string' ? first.message : 'harness_graphql_failed',
    };
  }
  return { ok: true, data, principal: result.principal };
}

async function graphqlFailure(response: Response): Promise<HarnessGraphqlResult> {
  const payload = await response.clone().json().catch(() => null) as {
    error?: unknown;
  } | null;
  const code = typeof payload?.error === 'string' ? payload.error : '';
  const responseForCaller =
    response.status === 401 || response.status === 403 ? response : undefined;
  if (NAMED_MCP_FAILURES.has(code)) {
    return {
      ok: false,
      status: response.status,
      error: code,
      ...(responseForCaller ? { response: responseForCaller } : {}),
    };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      status: response.status,
      error: 'principal_resolution=unauthenticated',
      response: responseForCaller,
    };
  }
  const error =
    code === 'console_harness_unconfigured'
      ? 'harness_graphql_unconfigured'
      : code === 'harness_mcp_timeout'
        ? 'harness_graphql_timeout'
        : code === 'harness_mcp_unreachable'
          ? 'harness_graphql_unreachable'
          : 'harness_graphql_failed';
  return { ok: false, status: response.status, error };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
