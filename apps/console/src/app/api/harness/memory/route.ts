// SOURCING: none. Dedicated server-side GraphQL client for the Harness Item
// projection. Tenant identity is mandatory and travels on the connection;
// this route never falls back to a default tenant.

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
  const tenant = process.env.CONSOLE_HARNESS_TENANT?.trim();
  if (!tenant) {
    return Response.json({ error: 'missing_mcp_tenant' }, { status: 400 });
  }
  const endpoint = graphqlUrl();
  if (!endpoint) {
    return Response.json({ error: 'harness_graphql_unconfigured' }, { status: 404 });
  }
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-theorem-tenant': tenant,
        'x-tenant-id': tenant,
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY
          ? { 'x-api-key': process.env.THEOREM_API_KEY }
          : {}),
      },
      body: JSON.stringify({ query: MEMORY_QUERY }),
      cache: 'no-store',
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
    return Response.json({ error: 'harness_graphql_unreachable' }, { status: 502 });
  }
}
