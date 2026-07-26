// SOURCING: none. Dedicated server-side GraphQL client for the Harness Item
// projection. Tenant identity is admitted by the MCP connection.

import { callHarnessGraphql } from '@/lib/server/harness-graphql';

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

export async function GET(): Promise<Response> {
  const result = await callHarnessGraphql(MEMORY_QUERY);
  if (!result.ok) {
    if (result.response) return result.response;
    return Response.json({ error: result.error }, { status: result.status });
  }
  const items = Array.isArray(result.data.itemsByKind) ? result.data.itemsByKind : [];
  return Response.json({ tenant: result.principal.tenant, items });
}
