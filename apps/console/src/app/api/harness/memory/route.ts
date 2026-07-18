// SOURCING: none. Dedicated server-side GraphQL client for the Harness Item
// projection. Tenant identity is mandatory and travels on the connection;
// this route never falls back to a default tenant.

import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import { principalTenantHeaders, resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export const dynamic = 'force-dynamic';

const MEMORY_QUERY = `
  query ConsoleMemoryFiles {
    itemsByKind(kind: "memory", limit: 5000) {
      id
      kind
      title
      source
      createdAtMs
      updatedAtMs
      extra
    }
  }
`;

function graphqlUrl(): string | null {
  const explicit = process.env.THEOREM_GRAPHQL_URL;
  if (explicit) return explicit;
  const base = process.env.CONSOLE_HARNESS_URL;
  return base ? `${base.replace(/\/$/, '')}/graphql` : null;
}

export async function GET(): Promise<Response> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const tenant = resolution.principal.tenant;
  const endpoint = graphqlUrl();
  if (!endpoint) {
    return Response.json({ error: 'harness_graphql_unconfigured' }, { status: 404 });
  }
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
        ...(process.env.THEOREM_API_KEY
          ? { 'x-api-key': process.env.THEOREM_API_KEY }
          : {}),
      },
      body: JSON.stringify({ query: MEMORY_QUERY }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = (await upstream.json()) as {
      data?: { itemsByKind?: unknown[] };
      errors?: unknown[];
      error?: string;
    };
    if (!upstream.ok || payload.errors) {
      return Response.json(
        { error: 'harness_graphql_failed', detail: payload.errors ?? payload.error ?? upstream.status },
        { status: upstream.ok ? 502 : upstream.status },
      );
    }
    return Response.json({ tenant, items: payload.data?.itemsByKind ?? [] });
  } catch {
    if (timeout.didTimeout()) {
      return Response.json({ error: 'harness_graphql_timeout' }, { status: 504 });
    }
    return Response.json({ error: 'harness_graphql_unreachable' }, { status: 502 });
  } finally {
    timeout.clear();
  }
}
