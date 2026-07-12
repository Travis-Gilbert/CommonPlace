import type { LibraryAction } from '@/lib/theorem-libraries';

const MCP_URL = process.env.THEOREM_MCP_URL?.trim() || 'http://127.0.0.1:50090/mcp';
const MCP_TOKEN = process.env.THEOREM_MCP_BEARER_TOKEN?.trim();
const TENANT = process.env.THEOREM_TENANT_SLUG?.trim() || 'Travis-Gilbert';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const action = await request.json().catch(() => null) as LibraryAction | null;
  const operation = graphqlOperation(action);
  if (!operation) {
    return Response.json({ ok: false, error: 'invalid_library_action' }, { status: 400 });
  }

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
        params: {
          name: operation.mutation ? 'graphql_mutate' : 'graphql_query',
          arguments: { tenant: TENANT, query: operation.query, variables: operation.variables },
        },
      }),
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
    if (!upstream.ok || !payload || payload.error) {
      return Response.json(
        { ok: false, error: mcpError(payload) || `Library substrate unavailable (${upstream.status}).` },
        { status: upstream.ok ? 502 : upstream.status },
      );
    }
    return Response.json({ ok: true, data: payload });
  } catch {
    return Response.json({ ok: false, error: 'Library substrate unreachable.' }, { status: 502 });
  }
}

interface GraphqlOperation {
  mutation: boolean;
  query: string;
  variables: Record<string, unknown>;
}

function graphqlOperation(action: LibraryAction | null): GraphqlOperation | null {
  if (!action || typeof action !== 'object') return null;
  if (action.action === 'list') {
    return { mutation: false, query: 'query OperatorLibraries { libraries }', variables: {} };
  }
  if (action.action === 'create' && action.config) {
    const config = action.config;
    return {
      mutation: true,
      query: 'mutation OperatorUpsertLibrary($config: JSON!) { upsertLibrary(config: $config) }',
      variables: {
        config: {
          id: config.id,
          name: config.name,
          root_url: config.rootUrl,
          max_pages: config.maxPages,
          max_depth: config.maxDepth,
          include_url_rules: config.includeUrlRules,
          exclude_url_rules: config.excludeUrlRules,
          render_mode: config.renderMode,
          refresh_policy: config.refreshPolicy,
          refresh_schedule: config.refreshPolicy === 'cron' ? config.refreshSchedule : null,
        },
      },
    };
  }
  if (action.action === 'query' && action.libraryId) {
    return {
      mutation: false,
      query: 'query OperatorLibraryQuery($libraryId: String!, $input: JSON) { libraryQuery(libraryId: $libraryId, input: $input) }',
      variables: { libraryId: action.libraryId, input: action.query },
    };
  }
  return null;
}

function mcpError(payload: Record<string, unknown> | null): string {
  const error = payload?.error;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : '';
  }
  return '';
}
