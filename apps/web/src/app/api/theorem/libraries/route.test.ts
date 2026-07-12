import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('POST /api/theorem/libraries', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env.THEOREM_MCP_URL = 'https://node.example/mcp';
    process.env.THEOREM_MCP_BEARER_TOKEN = 'server-secret';
    process.env.THEOREM_TENANT_SLUG = 'Travis-Gilbert';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.THEOREM_MCP_URL;
    delete process.env.THEOREM_MCP_BEARER_TOKEN;
    delete process.env.THEOREM_TENANT_SLUG;
    vi.restoreAllMocks();
  });

  it('keeps the substrate token server-side and lists through graphql_query', async () => {
    const calls: Array<{ authorization: string | null; body: Record<string, unknown> }> = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        authorization: new Headers(init?.headers).get('Authorization'),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return Response.json({ jsonrpc: '2.0', id: '1', result: { structuredContent: { data: { libraries: [] } } } });
    }) as typeof fetch;

    const { POST } = await import('./route');
    const response = await POST(request({ action: 'list' }));
    const params = calls[0]?.body.params as { name?: string; arguments?: { tenant?: string } };

    expect(response.status).toBe(200);
    expect(calls[0]?.authorization).toBe('Bearer server-secret');
    expect(params.name).toBe('graphql_query');
    expect(params.arguments?.tenant).toBe('Travis-Gilbert');
  });

  it('maps the operator form to the snake-case Library contract', async () => {
    let rpcBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ jsonrpc: '2.0', id: '1', result: { structuredContent: { data: { upsertLibrary: {} } } } });
    }) as typeof fetch;

    const { POST } = await import('./route');
    const response = await POST(request({
      action: 'create',
      config: {
        id: 'docs', name: 'Docs', rootUrl: 'https://example.com/', maxPages: 25, maxDepth: 2,
        includeUrlRules: [], excludeUrlRules: [], renderMode: 'fetch', refreshPolicy: 'cron',
        refreshSchedule: 'daily',
      },
    }));
    const params = rpcBody.params as { name?: string; arguments?: { variables?: { config?: Record<string, unknown> } } };

    expect(response.status).toBe(200);
    expect(params.name).toBe('graphql_mutate');
    expect(params.arguments?.variables?.config).toMatchObject({
      root_url: 'https://example.com/', max_pages: 25, refresh_policy: 'cron', refresh_schedule: 'daily',
    });
  });

  it('rejects unknown actions without contacting the substrate', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const { POST } = await import('./route');
    const response = await POST(request({ action: 'erase_everything' }));

    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

function request(body: unknown): Request {
  return new Request('http://localhost/api/theorem/libraries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
