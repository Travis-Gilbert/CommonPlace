import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  explicitRouteForCapability,
  routeTurn,
  toTurnContext,
} from '@/lib/server/turn-router';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';

const principal: HarnessPrincipal = {
  tenant: 'identity-tenant',
  githubLogin: 'identity-user',
  harnessIdentity: 'github:identity-user',
};

const routeMocks = vi.hoisted(() => ({
  principal: {
    tenant: 'identity-tenant',
    githubLogin: 'identity-user',
    harnessIdentity: 'github:identity-user',
  },
  cancel: vi.fn(async () => {}),
  dispatch: vi.fn(async () => {}),
  loadWebResearch: vi.fn(),
  resolvePrincipal: vi.fn(async (): Promise<
    | {
        ok: true;
        principal: {
          tenant: string;
          githubLogin: string;
          harnessIdentity: string;
        };
      }
    | { ok: false; response: Response }
  > => ({
    ok: true,
    principal: {
      tenant: 'identity-tenant',
      githubLogin: 'identity-user',
      harnessIdentity: 'github:identity-user',
    },
  })),
  state: {
    sessionId: 's1',
    mode: 'composed' as const,
    bindingId: 'agent:theorem',
    turnStatus: 'running' as const,
    activityStatus: null,
    messages: [],
    pendingPermission: null,
    blockedReason: null,
    error: null,
    appliedUpdateKeys: [],
  } as Record<string, unknown>,
  listeners: [] as Array<(state: Record<string, unknown>) => void>,
}));

vi.mock('@/lib/server/harness-principal', () => ({
  configuredServiceTenantMatches: () => true,
  resolveHarnessPrincipal: routeMocks.resolvePrincipal,
}));

vi.mock('@/lib/server/instance-capabilities', () => ({
  loadInstanceCapabilities: async () => ({
    ok: true,
    capabilities: { webSearch: true },
  }),
}));

vi.mock('@/lib/server/web-research', () => ({
  loadWebResearch: routeMocks.loadWebResearch,
}));

vi.mock('@commonplace/theorem-acp/bridge', () => {
  class BridgeCommandError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return {
    BridgeCommandError,
    dispatchBridgeCommands: routeMocks.dispatch,
    resolveBridgeSession: async () => ({
      cancel: routeMocks.cancel,
      getState: () => routeMocks.state,
      subscribe: (listener: (state: Record<string, unknown>) => void) => {
        routeMocks.listeners.push(listener);
        return () => {
          routeMocks.listeners = routeMocks.listeners.filter((value) => value !== listener);
        };
      },
    }),
    streamHeaders: () => new Headers({ 'Content-Type': 'text/event-stream' }),
  };
});

beforeEach(() => {
  vi.stubEnv('CONSOLE_COHESIVE_TURN_ROUTING', 'identity-tenant');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  routeMocks.listeners = [];
  routeMocks.state = {
    sessionId: 's1',
    mode: 'composed',
    bindingId: 'agent:theorem',
    turnStatus: 'running',
    activityStatus: null,
    messages: [],
    pendingPermission: null,
    blockedReason: null,
    error: null,
    appliedUpdateKeys: [],
  };
  routeMocks.resolvePrincipal.mockResolvedValue({
    ok: true,
    principal: routeMocks.principal,
  });
});

function telemetryEvents(info: { mock: { calls: unknown[][] } }) {
  return info.mock.calls.map((call) => JSON.parse(String(call[0])) as {
    event: string;
    outcome?: string;
    fallback_reason?: string;
  });
}

function routerResponse(
  route: 'chat' | 'research' | 'agent',
  fallbackReason: string | null = null,
) {
  return Response.json({
    tenant: 'identity-tenant',
    prelude: {
      schema_version: 'turn-prelude/1',
      route,
      confidence: 1,
      context_anchors: [],
      required_capabilities: route === 'research' ? ['web_search', 'theorem_chat'] : ['theorem_chat'],
      acknowledgement: 'I will follow the exact request.',
      acknowledgement_omission_reason: null,
      fallback_reason: fallbackReason,
    },
  });
}

describe('cohesive turn routing', () => {
  it('restores the direct hosted ACP path when the tenant flag is off', async () => {
    vi.stubEnv('CONSOLE_COHESIVE_TURN_ROUTING', 'off');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');
    const abort = new AbortController();
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Use the direct path' }] }),
      signal: abort.signal,
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-commonplace-turn-mode')).toBe('direct');
    expect(response.headers.get('x-commonplace-turn-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(routeMocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.not.objectContaining({ turnContext: expect.anything() })],
    );
    abort.abort();
  });

  it('does not enable routing for a different tenant in the rollout list', async () => {
    vi.stubEnv('CONSOLE_COHESIVE_TURN_ROUTING', 'another-tenant');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');
    const abort = new AbortController();
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Keep this tenant direct' }] }),
      signal: abort.signal,
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    abort.abort();
  });

  it('preserves explicit Web research on the direct rollback path', async () => {
    vi.stubEnv('CONSOLE_COHESIVE_TURN_ROUTING', 'off');
    routeMocks.loadWebResearch.mockResolvedValueOnce({
      ok: true,
      sources: [{ title: 'Official source', url: 'https://example.test/source', snippet: 'Evidence' }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');
    const abort = new AbortController();
    const request = new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        content: [{ type: 'text', text: 'Find current evidence' }],
        capability: { kind: 'web' },
      }),
      signal: abort.signal,
    });
    const response = await POST(request);

    expect(response.headers.get('x-commonplace-turn-mode')).toBe('direct');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(routeMocks.loadWebResearch).toHaveBeenCalledWith(
      'Find current evidence',
      routeMocks.principal,
      request,
    );
    expect(routeMocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({
        message: expect.objectContaining({
          parts: [expect.objectContaining({ text: expect.stringContaining('Official source') })],
        }),
      })],
    );
    abort.abort();
  });

  it('maps explicit destinations before model routing', () => {
    expect(explicitRouteForCapability(undefined)).toBeUndefined();
    expect(explicitRouteForCapability({ kind: 'theorem' })).toBe('chat');
    expect(explicitRouteForCapability({ kind: 'web' })).toBe('research');
    expect(explicitRouteForCapability({ kind: 'object' })).toBe('agent');
  });

  it('forwards tenant identity and converts the published prelude', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        tenant: 'identity-tenant',
        input: 'Find current sources',
        explicit_route: 'research',
      });
      expect(new Headers(init?.headers).get('x-theorem-tenant')).toBe('identity-tenant');
      return Response.json({
        tenant: 'identity-tenant',
        prelude: {
          schema_version: 'turn-prelude/1',
          route: 'research',
          confidence: 1,
          context_anchors: [],
          required_capabilities: ['web_search', 'theorem_chat'],
          acknowledgement: null,
          acknowledgement_omission_reason: 'explicit_override',
          fallback_reason: null,
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const prelude = await routeTurn(
      'Find current sources',
      principal,
      new Request('https://console.test/api/chat/stream'),
      'research',
    );

    expect(toTurnContext(prelude)).toEqual({
      schema_version: 'turn-context/1',
      route: 'research',
      published_acknowledgement: null,
      context_anchors: [],
      required_capabilities: ['web_search', 'theorem_chat'],
    });
  });

  it('falls back without acknowledgement when routing is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const prelude = await routeTurn(
      'hello',
      principal,
      new Request('https://console.test/api/chat/stream'),
    );

    expect(prelude.route).toBe('agent');
    expect(prelude.acknowledgement).toBeNull();
    expect(prelude.fallback_reason).toBe('router_unreachable');
  });

  it('uses the typed no-ack fallback for malformed router output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ prelude: { route: 'chat' } })));
    const prelude = await routeTurn(
      'hello',
      principal,
      new Request('https://console.test/api/chat/stream'),
    );

    expect(prelude.acknowledgement).toBeNull();
    expect(prelude.fallback_reason).toBe('router_invalid_response');
  });

  it('buckets untrusted fallback reasons without logging their content', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const sensitiveFallback = 'sensitive_fixture_prompt';
    vi.stubGlobal('fetch', vi.fn(async () => routerResponse('agent', sensitiveFallback)));
    const { POST } = await import('./route');
    const abort = new AbortController();
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Route this' }] }),
      signal: abort.signal,
    }));
    await response.body!.getReader().read();
    abort.abort();

    expect(telemetryEvents(info)).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'router_completed', fallback_reason: 'unrecognized' }),
      expect.objectContaining({ event: 'prelude_published', fallback_reason: 'unrecognized' }),
    ]));
    expect(info.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain(
      sensitiveFallback,
    );
  });

  it('preserves an identity refusal instead of falling back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 401 })));

    await expect(routeTurn(
      'hello',
      principal,
      new Request('https://console.test/api/chat/stream'),
    )).rejects.toEqual(expect.objectContaining({ status: 401 }));
  });

  it('preserves an explicit override during router transport fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const prelude = await routeTurn(
      'Find sources',
      principal,
      new Request('https://console.test/api/chat/stream'),
      'research',
    );

    expect(prelude.route).toBe('research');
    expect(prelude.required_capabilities).toContain('web_search');
    expect(prelude.acknowledgement).toBeNull();
  });

  it('publishes the prelude before waiting for inferred research', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => routerResponse('research')));
    routeMocks.loadWebResearch.mockImplementation(
      (_query, _principal, request: Request) => new Promise((_resolve, reject) => {
        request.signal.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted', 'AbortError')),
          { once: true },
        );
      }),
    );
    const { POST } = await import('./route');
    const abort = new AbortController();
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Find current sources' }] }),
      signal: abort.signal,
    }));
    const reader = response.body!.getReader();
    expect(response.headers.get('x-commonplace-turn-mode')).toBe('cohesive');
    expect(response.headers.get('x-commonplace-turn-id')).toMatch(/^[0-9a-f-]{36}$/);
    const first = await reader.read();
    const frame = new TextDecoder().decode(first.value);

    expect(frame).toContain('event: turn_prelude');
    expect(frame).toContain('"route":"research"');
    expect(routeMocks.loadWebResearch).toHaveBeenCalledOnce();
    abort.abort();
    await reader.read();
    expect(telemetryEvents(info)).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'research_completed', outcome: 'cancelled' }),
      expect.objectContaining({ event: 'turn_cancelled', outcome: 'cancelled' }),
    ]));
  });

  it('cancels cleanly while routing is still in flight', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted', 'AbortError')),
          { once: true },
        );
      }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');
    const abort = new AbortController();
    const pending = POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Route this' }] }),
      signal: abort.signal,
    }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    abort.abort();
    const response = await pending;

    expect(response.status).toBe(499);
    expect(telemetryEvents(info)).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'turn_cancelled', outcome: 'cancelled' }),
      expect.objectContaining({ event: 'turn_completed', outcome: 'cancelled' }),
    ]));
  });

  it('cancels the hosted ACP prompt when the request aborts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => routerResponse('chat')));
    const { POST } = await import('./route');
    const abort = new AbortController();
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        content: [{ type: 'text', text: 'Explain this' }],
        capability: { kind: 'theorem' },
      }),
      signal: abort.signal,
    }));
    await response.body!.getReader().read();
    await vi.waitFor(() => expect(routeMocks.dispatch).toHaveBeenCalledOnce());
    expect(routeMocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({
        displayText: 'Explain this',
        message: expect.objectContaining({
          parts: [expect.objectContaining({
            text: expect.not.stringContaining('I will follow the exact request.'),
          })],
        }),
        turnContext: expect.objectContaining({
          route: 'chat',
          published_acknowledgement: 'I will follow the exact request.',
        }),
      })],
    );
    abort.abort();
    await vi.waitFor(() => expect(routeMocks.cancel).toHaveBeenCalledOnce());
  });

  it('records content-free lifecycle telemetry through first substantive token', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => routerResponse('chat')));
    const { POST } = await import('./route');
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Sensitive fixture prompt' }] }),
    }));
    const reader = response.body!.getReader();
    await reader.read();
    await vi.waitFor(() => expect(routeMocks.listeners).toHaveLength(1));
    routeMocks.state = {
      ...routeMocks.state,
      turnStatus: 'completed',
      activityStatus: 'completed',
      messages: [{
        id: 'm1',
        role: 'assistant',
        text: 'Substantive fixture answer',
        acknowledgement: null,
        contributions: [],
        toolCalls: [],
      }],
    };
    routeMocks.listeners.forEach((listener) => listener(routeMocks.state));
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(telemetryEvents(info).map((event) => event.event)).toEqual(expect.arrayContaining([
      'router_completed',
      'prelude_published',
      'composed_run_started',
      'first_substantive_token',
      'turn_completed',
    ]));
    const serialized = info.mock.calls.map((call) => String(call[0])).join('\n');
    expect(serialized).not.toContain('identity-tenant');
    expect(serialized).not.toContain('Sensitive fixture prompt');
    expect(serialized).not.toContain('I will follow the exact request.');
    expect(serialized).not.toContain('Substantive fixture answer');
  });

  it('streams ordered content-free lifecycle receipts bound to the turn id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => routerResponse('chat')));
    const { POST } = await import('./route');
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Receipt fixture prompt' }] }),
    }));
    const turnId = response.headers.get('x-commonplace-turn-id');
    const reader = response.body!.getReader();
    await reader.read();
    await vi.waitFor(() => expect(routeMocks.listeners).toHaveLength(1));
    routeMocks.state = {
      ...routeMocks.state,
      turnStatus: 'completed',
      activityStatus: 'completed',
      messages: [{
        id: 'm1',
        role: 'assistant',
        text: 'Receipt fixture response',
        acknowledgement: null,
        contributions: [],
        toolCalls: [],
      }],
    };
    routeMocks.listeners.forEach((listener) => listener(routeMocks.state));
    let stream = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      stream += new TextDecoder().decode(value);
    }
    const receipts = [...stream.matchAll(/event: turn_receipt\ndata: ([^\n]+)/g)]
      .map((match) => JSON.parse(match[1]) as { turn_id: string; stage: string });

    expect(receipts.map((receipt) => receipt.stage)).toEqual([
      'router_completed',
      'prelude_published',
      'composed_run_started',
      'first_substantive_token',
      'completion',
    ]);
    expect(receipts.every((receipt) => receipt.turn_id === turnId)).toBe(true);
    expect(JSON.stringify(receipts)).not.toContain('Receipt fixture');
  });

  it('reports research failure explicitly and never starts composed execution', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => routerResponse('research')));
    routeMocks.loadWebResearch.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ message: 'Research provider unavailable' }, { status: 502 }),
    });
    const { POST } = await import('./route');
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Find current sources' }] }),
    }));
    const body = await response.text();

    expect(body).toContain('Research provider unavailable');
    expect(routeMocks.dispatch).not.toHaveBeenCalled();
    expect(telemetryEvents(info)).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'research_completed', outcome: 'failed' }),
      expect.objectContaining({ event: 'turn_completed', outcome: 'failed' }),
    ]));
  });

  it('reports composed execution failure without fabricating activity', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => routerResponse('chat')));
    routeMocks.dispatch.mockRejectedValueOnce(new Error('Composed execution unavailable'));
    const { POST } = await import('./route');
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'Explain this' }] }),
    }));
    const body = await response.text();

    expect(body).toContain('Composed execution unavailable');
    expect(body).not.toContain('event: activity');
    expect(telemetryEvents(info)).toContainEqual(
      expect.objectContaining({ event: 'turn_completed', outcome: 'failed' }),
    );
  });

  it('refuses a missing identity before routing', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    routeMocks.resolvePrincipal.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');
    const response = await POST(new Request('https://console.test/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ content: [{ type: 'text', text: 'hello' }] }),
    }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(telemetryEvents(info)).toContainEqual(
      expect.objectContaining({ event: 'identity_refused' }),
    );
  });
});
