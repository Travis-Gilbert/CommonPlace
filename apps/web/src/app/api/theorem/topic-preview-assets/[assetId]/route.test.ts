import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/theorem/topic-preview-assets/[assetId]', () => {
  const originalFetch = globalThis.fetch;
  const assetId = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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

  it('serves only tenant-scoped held bytes and keeps the MCP credential server-side', async () => {
    let rpcBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      rpcBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        jsonrpc: '2.0', id: '1', result: { structuredContent: { data: {
          topicPreviewAsset: { content_type: 'image/png', bytes_base64: Buffer.from('held-png').toString('base64') },
        } } },
      });
    }) as typeof fetch;

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ assetId }) });
    const params = rpcBody.params as { name?: string; arguments?: { tenant?: string; variables?: { assetId?: string } } };

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    await expect(response.text()).resolves.toBe('held-png');
    expect(params.name).toBe('graphql_query');
    expect(params.arguments?.tenant).toBe('Travis-Gilbert');
    expect(params.arguments?.variables?.assetId).toBe(assetId);
  });

  it('rejects invalid asset paths before contacting Theorem', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ assetId: '../../remote.png' }) });

    expect(response.status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
