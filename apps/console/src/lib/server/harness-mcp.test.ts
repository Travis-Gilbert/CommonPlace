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

import { callHarnessMcp } from './harness-mcp';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:owner',
};

function sse(payload: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return new Response(`:\n\ndata: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      ...headers,
    },
  });
}

function multilineSse(payload: Record<string, unknown>): Response {
  const serialized = JSON.stringify(payload);
  const splitAt = serialized.indexOf(',') + 1;
  return new Response(
    `:\n\ndata: ${serialized.slice(0, splitAt)}\ndata: ${serialized.slice(splitAt)}\n\n`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}

beforeEach(() => {
  process.env.CONSOLE_HARNESS_URL = 'https://api.theoremharness.com';
  process.env.CONSOLE_HARNESS_TOKEN = 'test-harness-token';
  resolveHarnessPrincipalMock.mockResolvedValue({ ok: true, principal });
  principalTenantHeadersMock.mockReturnValue({
    'x-theorem-tenant': principal.tenant,
    'x-theorem-principal': principal.harnessIdentity,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.CONSOLE_HARNESS_URL;
  delete process.env.CONSOLE_HARNESS_TOKEN;
});

describe('callHarnessMcp', () => {
  it('initializes a principal-bound MCP session before calling a tool', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sse(
        {
          jsonrpc: '2.0',
          id: 'initialize',
          result: {
            protocolVersion: '2025-06-18',
            serverInfo: { name: 'theorem-mcp-server', version: '0.1.0' },
          },
        },
        { 'MCP-Session-Id': 'session-1' },
      ))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(multilineSse({
        jsonrpc: '2.0',
        id: 'graphql_query',
        result: {
          structuredContent: {
            data: { observedModel: { eventCount: 0 } },
          },
        },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callHarnessMcp('graphql_query', {
      query: 'query { observedModel(topicId: "topic") }',
    });

    expect(result).toEqual({
      ok: true,
      data: { data: { observedModel: { eventCount: 0 } } },
      principal,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const initialize = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(initialize[1].headers).toMatchObject({
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer test-harness-token',
      'MCP-Protocol-Version': '2025-06-18',
    });
    expect(JSON.parse(String(initialize[1].body))).toMatchObject({
      method: 'initialize',
      params: { protocolVersion: '2025-06-18' },
    });

    const ready = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(ready[1].headers).toMatchObject({ 'MCP-Session-Id': 'session-1' });
    expect(JSON.parse(String(ready[1].body))).toMatchObject({
      method: 'notifications/initialized',
    });

    const toolCall = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(toolCall[1].headers).toMatchObject({ 'MCP-Session-Id': 'session-1' });
    expect(JSON.parse(String(toolCall[1].body))).toMatchObject({
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

    const close = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(close[1]).toMatchObject({
      method: 'DELETE',
      headers: expect.objectContaining({ 'MCP-Session-Id': 'session-1' }),
    });
    expect(close[1].signal).not.toBe(toolCall[1].signal);
  });

  it('fails closed when initialization does not return a session id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sse({
      jsonrpc: '2.0',
      id: 'initialize',
      result: {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'theorem-mcp-server', version: '0.1.0' },
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callHarnessMcp('graphql_query', { query: 'query { status }' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      await expect(result.response.json()).resolves.toMatchObject({
        error: 'harness_mcp_initialization_failed',
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
