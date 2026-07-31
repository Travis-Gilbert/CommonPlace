import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { principalTenantHeadersMock, resolveHarnessPrincipalMock } = vi.hoisted(() => ({
  principalTenantHeadersMock: vi.fn(),
  resolveHarnessPrincipalMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-principal', () => ({
  principalTenantHeaders: principalTenantHeadersMock,
  resolveHarnessPrincipal: resolveHarnessPrincipalMock,
}));

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:owner',
};

type RecordedRequest = {
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
};

type FetchHarness = {
  fetchMock: ReturnType<typeof vi.fn>;
  requests: RecordedRequest[];
};

function sse(payload: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      ...headers,
    },
  });
}

function jsonError(status: number, code: string): Response {
  return Response.json({ error: { code } }, { status });
}

function fetchHarness(options: {
  closeFirstToolCall?: boolean;
  failEveryToolCall?: boolean;
  failFirstSession?: boolean;
  initializeStatus?: number;
  returnBareSession404?: boolean;
  omitSessionId?: boolean;
} = {}): FetchHarness {
  const requests: RecordedRequest[] = [];
  let initializeCount = 0;
  let toolCallCount = 0;
  const fetchMock = vi.fn(async (_input: string | URL | Request, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    const body = typeof init.body === 'string'
      ? record(JSON.parse(init.body))
      : null;
    requests.push({ method, headers, body });

    if (method === 'DELETE') return new Response(null, { status: 200 });
    if (method === 'GET') return new Response(null, { status: 405 });

    if (body?.method === 'initialize') {
      initializeCount += 1;
      if (options.initializeStatus) {
        return jsonError(options.initializeStatus, 'edge_refused');
      }
      return sse({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'theorem-mcp-server', version: '0.1.0' },
        },
      }, options.omitSessionId ? {} : { 'MCP-Session-Id': `session-${initializeCount}` });
    }

    if (body?.method === 'notifications/initialized') {
      return new Response(null, { status: 200 });
    }

    if (body?.method === 'tools/call') {
      toolCallCount += 1;
      if (options.closeFirstToolCall && toolCallCount === 1) {
        throw new Error('connection closed');
      }
      const sessionId = headers.get('mcp-session-id');
      if (
        options.failEveryToolCall
        || (options.failFirstSession && sessionId === 'session-1')
      ) {
        if (options.returnBareSession404) {
          return new Response(null, { status: 404 });
        }
        return jsonError(404, 'mcp_session_uninitialized');
      }
      return sse({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [],
          structuredContent: {
            data: { observedModel: { eventCount: 0 } },
          },
        },
      });
    }

    throw new Error(`Unexpected MCP request: ${method} ${String(body?.method)}`);
  });
  return { fetchMock, requests };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('CONSOLE_HARNESS_URL', 'https://api.theoremharness.com');
  vi.stubEnv('CONSOLE_HARNESS_TOKEN', 'test-harness-token');
  resolveHarnessPrincipalMock.mockReset();
  resolveHarnessPrincipalMock.mockResolvedValue({ ok: true, principal });
  principalTenantHeadersMock.mockReset();
  principalTenantHeadersMock.mockImplementation((value: typeof principal) => ({
    'x-theorem-tenant': value.tenant,
    'x-theorem-principal': value.harnessIdentity,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('callHarnessMcp', () => {
  it('reuses one initialized MCP session for repeated calls with one credential', async () => {
    const harness = fetchHarness();
    vi.stubGlobal('fetch', harness.fetchMock);
    const { callHarnessMcp } = await import('./harness-mcp');

    const first = await callHarnessMcp('graphql_query', {
      query: 'query { observedModel(topicId: "topic") }',
    });
    const second = await callHarnessMcp('graphql_query', {
      query: 'query { observedModel(topicId: "other") }',
    });

    expect(first).toEqual({
      ok: true,
      data: { data: { observedModel: { eventCount: 0 } } },
      principal,
    });
    expect(second.ok).toBe(true);

    const initialize = harness.requests.filter(
      (request) => request.body?.method === 'initialize',
    );
    const toolCalls = harness.requests.filter(
      (request) => request.body?.method === 'tools/call',
    );
    expect(initialize).toHaveLength(1);
    expect(toolCalls).toHaveLength(2);
    expect(harness.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);
    expect(initialize[0]?.headers.get('accept')).toBe('application/json, text/event-stream');
    expect(initialize[0]?.headers.get('authorization')).toBe('Bearer test-harness-token');
    expect(toolCalls[0]?.headers.get('accept')).toBe('application/json, text/event-stream');
    expect(toolCalls[0]?.headers.get('mcp-session-id')).toBe('session-1');
    expect(toolCalls[0]?.headers.get('mcp-protocol-version')).toBe('2025-03-26');
    expect(toolCalls[1]?.headers.get('mcp-session-id')).toBe('session-1');
    expect(toolCalls[0]?.body).toMatchObject({
      method: 'tools/call',
      params: {
        name: 'graphql_query',
        arguments: {
          tenant: principal.tenant,
          tenant_slug: principal.tenant,
          actor: principal.harnessIdentity,
        },
      },
    });
  });

  it('keys sessions by credential and the complete principal binding', async () => {
    const harness = fetchHarness();
    vi.stubGlobal('fetch', harness.fetchMock);
    const otherPrincipal = {
      tenant: 'Other-Workspace',
      githubLogin: 'Travis-Gilbert',
      harnessIdentity: 'github:owner',
    };
    const otherIdentity = {
      tenant: principal.tenant,
      githubLogin: 'Other-User',
      harnessIdentity: 'github:other-user',
    };
    resolveHarnessPrincipalMock
      .mockResolvedValueOnce({ ok: true, principal })
      .mockResolvedValueOnce({ ok: true, principal: otherPrincipal })
      .mockResolvedValueOnce({ ok: true, principal: otherPrincipal })
      .mockResolvedValueOnce({ ok: true, principal: otherIdentity });
    const { callHarnessMcp } = await import('./harness-mcp');

    await callHarnessMcp('status', {});
    await callHarnessMcp('status', {});
    vi.stubEnv('CONSOLE_HARNESS_TOKEN', 'rotated-harness-token');
    await callHarnessMcp('status', {});
    await callHarnessMcp('status', {});

    const initialize = harness.requests.filter(
      (request) => request.body?.method === 'initialize',
    );
    expect(initialize).toHaveLength(4);
    expect(initialize[0]?.headers.get('authorization')).toBe('Bearer test-harness-token');
    expect(initialize[1]?.headers.get('x-theorem-tenant')).toBe('Other-Workspace');
    expect(initialize[2]?.headers.get('authorization')).toBe('Bearer rotated-harness-token');
    expect(initialize[3]?.headers.get('x-theorem-principal')).toBe('github:other-user');
  });

  it('closes and reinitializes an idle cached session', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const harness = fetchHarness();
    vi.stubGlobal('fetch', harness.fetchMock);
    const { callHarnessMcp } = await import('./harness-mcp');

    await callHarnessMcp('status', {});
    now += 10 * 60_000;
    await callHarnessMcp('status', {});

    expect(harness.requests.filter(
      (request) => request.body?.method === 'initialize',
    )).toHaveLength(2);
    expect(harness.requests.filter((request) => request.method === 'DELETE')).toHaveLength(1);
  });

  it('reinitializes once and retries after the server rejects an expired session', async () => {
    const harness = fetchHarness({
      failFirstSession: true,
      returnBareSession404: true,
    });
    vi.stubGlobal('fetch', harness.fetchMock);
    const { callHarnessMcp } = await import('./harness-mcp');

    const result = await callHarnessMcp('graphql_query', { query: 'query { status }' });

    expect(result.ok).toBe(true);
    expect(harness.requests.filter(
      (request) => request.body?.method === 'initialize',
    )).toHaveLength(2);
    const toolCalls = harness.requests.filter(
      (request) => request.body?.method === 'tools/call',
    );
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0]?.headers.get('mcp-session-id')).toBe('session-1');
    expect(toolCalls[1]?.headers.get('mcp-session-id')).toBe('session-2');
  });

  it('does not retry a session failure more than once', async () => {
    const harness = fetchHarness({ failEveryToolCall: true });
    vi.stubGlobal('fetch', harness.fetchMock);
    const { callHarnessMcp } = await import('./harness-mcp');

    const result = await callHarnessMcp('graphql_query', { query: 'query { status }' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
      await expect(result.response.json()).resolves.toMatchObject({
        error: 'mcp_session_uninitialized',
      });
    }
    expect(harness.requests.filter(
      (request) => request.body?.method === 'initialize',
    )).toHaveLength(2);
    expect(harness.requests.filter(
      (request) => request.body?.method === 'tools/call',
    )).toHaveLength(2);
  });

  it('does not replay a tool call after an ambiguous connection close', async () => {
    const harness = fetchHarness({ closeFirstToolCall: true });
    vi.stubGlobal('fetch', harness.fetchMock);
    const { callHarnessMcp } = await import('./harness-mcp');

    const result = await callHarnessMcp('graphql_mutate', {
      query: 'mutation { pinObserved(input: {}) }',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      await expect(result.response.json()).resolves.toMatchObject({
        error: 'harness_mcp_unreachable',
      });
    }
    expect(harness.requests.filter(
      (request) => request.body?.method === 'initialize',
    )).toHaveLength(1);
    expect(harness.requests.filter(
      (request) => request.body?.method === 'tools/call',
    )).toHaveLength(1);
  });

  it('fails closed when initialize does not return a session id', async () => {
    const harness = fetchHarness({ omitSessionId: true });
    vi.stubGlobal('fetch', harness.fetchMock);
    const { callHarnessMcp } = await import('./harness-mcp');

    const result = await callHarnessMcp('graphql_query', { query: 'query { status }' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(502);
      await expect(result.response.json()).resolves.toMatchObject({
        error: 'harness_mcp_initialization_failed',
      });
    }
  });

  it.each([
    [401, 'mcp_authentication_failed'],
    [406, 'mcp_not_acceptable'],
  ])('preserves the edge failure vocabulary for HTTP %s', async (status, error) => {
    const harness = fetchHarness({ initializeStatus: status });
    vi.stubGlobal('fetch', harness.fetchMock);
    const { callHarnessMcp } = await import('./harness-mcp');

    const result = await callHarnessMcp('graphql_query', { query: 'query { status }' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(status);
      await expect(result.response.json()).resolves.toMatchObject({ error });
    }
  });
});

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
