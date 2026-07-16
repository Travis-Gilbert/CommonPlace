// SOURCING: none — pure logic API route, no upstream component applies
/**
 * Path lens substrate proxy. Calls Theorem MCP tools for pathTo scopes.
 * Browser never holds service credentials; this route owns the MCP token.
 */

import { createPathClients } from '@/lib/path/clients';
import { isPathScope, pathTo } from '@/lib/path/pathTo';

const MCP_URL = process.env.THEOREM_MCP_URL?.trim() || 'http://127.0.0.1:50090/mcp';
const MCP_TOKEN = process.env.THEOREM_MCP_BEARER_TOKEN?.trim();

export const dynamic = 'force-dynamic';

async function callMcp(tool: string, args: Record<string, unknown>) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (MCP_TOKEN) headers.set('Authorization', `Bearer ${MCP_TOKEN}`);
  try {
    const upstream = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: { name: tool, arguments: args },
      }),
      cache: 'no-store',
    });
    const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    if (!upstream.ok || !payload || payload.error) {
      const err =
        typeof payload?.error === 'object' &&
        payload.error &&
        'message' in payload.error &&
        typeof (payload.error as { message: unknown }).message === 'string'
          ? (payload.error as { message: string }).message
          : `MCP ${tool} unavailable (${upstream.status})`;
      return { ok: false as const, error: err };
    }
    return { ok: true as const, data: payload };
  } catch {
    return { ok: false as const, error: 'Path substrate unreachable.' };
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    nodeId?: string;
    scope?: string;
  } | null;
  const nodeId = body?.nodeId?.trim() ?? '';
  const scope = body?.scope?.trim() ?? '';
  if (!nodeId || !isPathScope(scope)) {
    return Response.json(
      { ok: false, error: 'path requires nodeId and scope in derivation|plan|memory|code' },
      { status: 400 },
    );
  }

  try {
    const clients = createPathClients(callMcp);
    const result = await pathTo(nodeId, scope, clients);
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'pathTo failed' },
      { status: 502 },
    );
  }
}
