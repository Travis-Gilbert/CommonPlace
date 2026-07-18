const MCP_URL = process.env.THEOREM_MCP_URL?.trim() || 'http://127.0.0.1:50090/mcp';
const MCP_TOKEN = process.env.THEOREM_MCP_BEARER_TOKEN?.trim();
const TENANT = process.env.THEOREM_TENANT_SLUG?.trim();

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (!TENANT) {
    return Response.json({ ok: false, error: 'missing_theorem_tenant' }, { status: 503 });
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (MCP_TOKEN) headers.set('Authorization', 'Bearer ' + MCP_TOKEN);
  try {
    const upstream = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: {
          name: 'graphql_query',
          arguments: {
            tenant: TENANT,
            query: 'query CanonHarnessModelCatalog { harnessModelCatalog }',
            variables: {},
          },
        },
      }),
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
    if (!upstream.ok || !payload || payload.error) {
      return Response.json(
        { ok: false, error: mcpError(payload) || 'Model substrate unavailable (' + upstream.status + ').' },
        { status: upstream.ok ? 502 : upstream.status },
      );
    }
    return Response.json({ ok: true, data: payload });
  } catch {
    return Response.json({ ok: false, error: 'Model substrate unreachable.' }, { status: 502 });
  }
}

function mcpError(payload: Record<string, unknown> | null): string {
  const error = payload?.error;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : '';
  }
  return '';
}
