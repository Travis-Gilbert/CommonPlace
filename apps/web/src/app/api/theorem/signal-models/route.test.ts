import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/theorem/signal-models', () => {
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

  it('binds model catalog reads to the server tenant', async () => {
    let rpcBody: Record<string, unknown> = {};
    let authorization = '';
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      authorization = new Headers(init?.headers).get('Authorization') ?? '';
      return Response.json({
        jsonrpc: '2.0',
        id: '1',
        result: { structuredContent: { data: { harnessModelCatalog: { models: [] } } } },
      });
    }) as typeof fetch;

    const { GET } = await import('./route');
    const response = await GET();
    const params = rpcBody.params as { name?: string; arguments?: { tenant?: string; query?: string } };

    expect(response.status).toBe(200);
    expect(authorization).toBe('Bearer server-secret');
    expect(params.name).toBe('graphql_query');
    expect(params.arguments?.tenant).toBe('Travis-Gilbert');
    expect(params.arguments?.query).toContain('harnessModelCatalog');
  });

  it('refuses requests when no admitted tenant is configured', async () => {
    delete process.env.THEOREM_TENANT_SLUG;
    vi.resetModules();
    globalThis.fetch = vi.fn() as typeof fetch;
    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: 'missing_theorem_tenant' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
