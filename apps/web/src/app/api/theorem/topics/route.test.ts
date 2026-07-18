import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('POST /api/theorem/topics', () => {
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

  it('keeps the substrate token and tenant server-side', async () => {
    const calls: Array<{ authorization: string | null; body: Record<string, unknown> }> = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        authorization: new Headers(init?.headers).get('Authorization'),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return Response.json({ jsonrpc: '2.0', id: '1', result: { structuredContent: { data: { topics: [] } } } });
    }) as typeof fetch;

    const { POST } = await import('./route');
    const response = await POST(request({ action: 'list' }));
    const params = calls[0]?.body.params as { name?: string; arguments?: { tenant?: string } };

    expect(response.status).toBe(200);
    expect(calls[0]?.authorization).toBe('Bearer server-secret');
    expect(params.name).toBe('graphql_query');
    expect(params.arguments?.tenant).toBe('Travis-Gilbert');
  });

  it('maps the topic form to the standing-topic contract', async () => {
    let rpcBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ jsonrpc: '2.0', id: '1', result: { structuredContent: { data: { upsertTopic: {} } } } });
    }) as typeof fetch;

    const { POST } = await import('./route');
    const response = await POST(request({
      action: 'create',
      config: {
        id: 'rust-databases', name: 'Rust databases', intent: 'Track releases', status: 'active',
        cadenceSeconds: 3600, seedUrls: ['https://example.com/rust'], queries: ['rust database release'],
        allowedHosts: ['example.com'], maxDepth: 2, maxItems: 100, maxBytes: 16_000_000,
        maxSeconds: 60, maxWorkUnits: 32,
      },
    }));
    const params = rpcBody.params as {
      name?: string;
      arguments?: { variables?: { config?: Record<string, unknown> } };
    };
    const config = params.arguments?.variables?.config;

    expect(response.status).toBe(200);
    expect(params.name).toBe('graphql_mutate');
    expect(config).toMatchObject({
      tenant_slug: 'Travis-Gilbert',
      cadence: { kind: 'interval', every_seconds: 3600 },
      scope: { allowed_hosts: ['example.com'], max_depth: 2 },
      filing_policy: { auto_threshold: 0.8, flagged_threshold: 0.5 },
    });
    expect(config?.connectors).toEqual([
      { kind: 'site_scope', id: 'sites', seeds: ['https://example.com/rust'] },
      { kind: 'search_fanout', id: 'search', queries: ['rust database release'] },
    ]);
  });

  it('rejects invalid actions without contacting the substrate', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const { POST } = await import('./route');
    const response = await POST(request({ action: 'delete_all_topics' }));

    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('refuses requests when no admitted tenant is configured', async () => {
    delete process.env.THEOREM_TENANT_SLUG;
    vi.resetModules();
    globalThis.fetch = vi.fn() as typeof fetch;
    const { POST } = await import('./route');
    const response = await POST(request({ action: 'list' }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: 'missing_theorem_tenant' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

function request(body: unknown): Request {
  return new Request('http://localhost/api/theorem/topics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
