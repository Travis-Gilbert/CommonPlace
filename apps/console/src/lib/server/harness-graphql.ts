// SOURCING: none. Server-side GraphQL transport helper for Harness routes.

import 'server-only';

import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

export type HarnessGraphqlResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; response?: Response };

export async function callHarnessGraphql(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<HarnessGraphqlResult> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return {
      ok: false,
      status: resolution.response.status,
      error: 'principal_resolution=unauthenticated',
      response: resolution.response,
    };
  }
  const endpoint = graphqlUrl();
  if (!endpoint) return { ok: false, status: 404, error: 'harness_graphql_unconfigured' };
  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY ? { 'x-api-key': process.env.THEOREM_API_KEY } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const passthrough = upstream.status === 401 || upstream.status === 403 ? upstream.clone() : undefined;
    const payload = await upstream.json().catch(() => null) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message?: unknown }>;
      error?: unknown;
    } | null;
    if (!upstream.ok) {
      const detail = payload?.errors?.[0]?.message ?? payload?.error;
      return {
        ok: false,
        status: upstream.status,
        error: typeof detail === 'string' ? detail : 'harness_graphql_failed',
        response: passthrough,
      };
    }
    if (payload?.errors || !payload?.data) {
      const detail = payload?.errors?.[0]?.message ?? payload?.error;
      return {
        ok: false,
        status: 502,
        error: typeof detail === 'string' ? detail : 'harness_graphql_failed',
      };
    }
    return { ok: true, data: payload.data };
  } catch {
    return {
      ok: false,
      status: timeout.didTimeout() ? 504 : 502,
      error: timeout.didTimeout() ? 'harness_graphql_timeout' : 'harness_graphql_unreachable',
    };
  } finally {
    timeout.clear();
  }
}

function graphqlUrl(): string | null {
  const explicit = process.env.THEOREM_GRAPHQL_URL;
  if (explicit) return explicit;
  const base = process.env.CONSOLE_HARNESS_URL;
  return base ? `${base.replace(/\/$/, '')}/graphql` : null;
}
