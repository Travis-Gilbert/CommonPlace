import type { TopicAction } from '@/lib/theorem-topics';

const MCP_URL = process.env.THEOREM_MCP_URL?.trim() || 'http://127.0.0.1:50090/mcp';
const MCP_TOKEN = process.env.THEOREM_MCP_BEARER_TOKEN?.trim();
const TENANT = process.env.THEOREM_TENANT_SLUG?.trim();

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (!TENANT) {
    return Response.json({ ok: false, error: 'missing_theorem_tenant' }, { status: 503 });
  }
  const action = await request.json().catch(() => null) as TopicAction | null;
  const operation = graphqlOperation(action, TENANT);
  if (!operation) return Response.json({ ok: false, error: 'invalid_topic_action' }, { status: 400 });

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
        { ok: false, error: mcpError(payload) || `Topic substrate unavailable (${upstream.status}).` },
        { status: upstream.ok ? 502 : upstream.status },
      );
    }
    return Response.json({ ok: true, data: payload });
  } catch {
    return Response.json({ ok: false, error: 'Topic substrate unreachable.' }, { status: 502 });
  }
}

interface GraphqlOperation {
  mutation: boolean;
  query: string;
  variables: Record<string, unknown>;
}

function graphqlOperation(action: TopicAction | null, tenant: string): GraphqlOperation | null {
  if (!action || typeof action !== 'object') return null;
  if (action.action === 'list') {
    return { mutation: false, query: 'query OperatorTopics { topics }', variables: {} };
  }
  if (action.action === 'plan' && action.topicId) {
    return {
      mutation: false,
      query: 'query OperatorTopicWork($topicId: String!, $sequence: Int) { topicWork(topicId: $topicId, sequence: $sequence) }',
      variables: { topicId: action.topicId, sequence: action.sequence ?? 0 },
    };
  }
  if (action.action === 'create' && action.config) {
    const config = action.config;
    const connectors: Array<Record<string, unknown>> = [];
    if (config.seedUrls.length > 0) {
      connectors.push({ kind: 'site_scope', id: 'sites', seeds: config.seedUrls });
    }
    if (config.queries.length > 0) {
      connectors.push({ kind: 'search_fanout', id: 'search', queries: config.queries });
    }
    return {
      mutation: true,
      query: 'mutation OperatorUpsertTopic($config: JSON!) { upsertTopic(config: $config) }',
      variables: {
        config: {
          id: config.id,
          tenant_slug: tenant,
          name: config.name,
          intent: config.intent,
          status: config.status,
          cadence: { kind: 'interval', every_seconds: config.cadenceSeconds },
          event_triggers: [],
          connectors,
          scope: {
            allowed_hosts: config.allowedHosts,
            allowed_url_prefixes: [],
            excluded_url_prefixes: [],
            max_depth: config.maxDepth,
          },
          budget: {
            work: {
              max_items: config.maxItems,
              max_bytes: config.maxBytes,
              max_seconds: config.maxSeconds,
            },
            max_work_units: config.maxWorkUnits,
          },
          filing_policy: { auto_threshold: 0.8, flagged_threshold: 0.5 },
          destinations: [{ id: 'index', object_kind: 'record' }],
          sentinels: [],
        },
      },
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
