import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transportMocks = vi.hoisted(() => {
  const session = {
    prepareTurn: vi.fn(),
    failPreparedTurn: vi.fn(),
    cancel: vi.fn(async () => {}),
    getState: vi.fn(() => ({ sessionId: 'session-1' })),
  };
  return {
    session,
    resolveSession: vi.fn(async () => session),
    dispatch: vi.fn(async () => {}),
    routingEnabled: vi.fn(() => true),
    routeTurn: vi.fn(async (): Promise<{
      route: 'chat' | 'research' | 'agent';
      acknowledgement: string;
    }> => ({
      route: 'chat' as const,
      acknowledgement: 'I will use the connected graph.',
    })),
    toTurnContext: vi.fn(
      (prelude: { route: 'chat' | 'research' | 'agent'; acknowledgement: string }) => ({
        schema_version: 'turn-context/1',
        route: prelude.route,
        published_acknowledgement: prelude.acknowledgement,
        context_anchors: [],
        required_capabilities: [],
      }),
    ),
    resolvePrincipal: vi.fn(),
    loadWebResearch: vi.fn(),
  };
});

vi.mock('@commonplace/theorem-acp/bridge', () => {
  class BridgeCommandError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return {
    BridgeCommandError,
    createStateStream: () => new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    }),
    dispatchBridgeCommands: transportMocks.dispatch,
    resolveBridgeSession: transportMocks.resolveSession,
    streamHeaders: () => new Headers({ 'Content-Type': 'text/event-stream' }),
    validateBridgeCommands: (commands: unknown) => commands,
    validateBridgePayload: (body: unknown) => body,
  };
});

vi.mock('@/lib/chat/server-catalog', () => ({
  getThread: async () => null,
  updateThread: async () => {},
}));

vi.mock('@/lib/server/harness-principal', () => ({
  configuredServiceTenantMatches: () => true,
  resolveHarnessPrincipal: transportMocks.resolvePrincipal,
}));

vi.mock('@/lib/server/instance-capabilities', () => ({
  loadInstanceCapabilities: async () => ({
    ok: true,
    capabilities: { webSearch: true },
  }),
}));

vi.mock('@/lib/server/turn-router', () => {
  class TurnRouterIdentityError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return {
    cohesiveTurnRoutingEnabled: transportMocks.routingEnabled,
    routeTurn: transportMocks.routeTurn,
    toTurnContext: transportMocks.toTurnContext,
    TurnRouterIdentityError,
  };
});

vi.mock('@/lib/server/web-research', () => ({
  loadWebResearch: transportMocks.loadWebResearch,
}));

const principal = {
  tenant: 'identity-tenant',
  githubLogin: 'identity-user',
  harnessIdentity: 'github:identity-user',
};

function request(turnRoute: 'auto' | 'chat' | 'research' | 'agent' = 'auto'): Request {
  return new Request('https://console.test/api/chat/transport', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'composed',
      bindingId: 'agent:theorem',
      turnRoute,
      commands: [{
        type: 'add-message',
        message: { role: 'user', parts: [{ type: 'text', text: 'Explain this record' }] },
        parentId: null,
        sourceId: null,
      }],
    }),
  });
}

beforeEach(() => {
  transportMocks.resolvePrincipal.mockResolvedValue({ ok: true, principal });
  transportMocks.routingEnabled.mockReturnValue(true);
  transportMocks.routeTurn.mockResolvedValue({
    route: 'chat',
    acknowledgement: 'I will use the connected graph.',
  });
  transportMocks.loadWebResearch.mockResolvedValue({ ok: true, sources: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AssistantTransport cohesive turn routing', () => {
  it('keeps the rollback path direct without preparing a turn', async () => {
    transportMocks.routingEnabled.mockReturnValue(false);
    const { POST } = await import('./route');

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('x-commonplace-turn-mode')).toBe('direct');
    expect(transportMocks.session.prepareTurn).not.toHaveBeenCalled();
    expect(transportMocks.dispatch).toHaveBeenCalledWith(
      transportMocks.session,
      [expect.not.objectContaining({ turnContext: expect.anything() })],
    );
  });

  it('publishes the prelude and continues the same prepared turn', async () => {
    transportMocks.routeTurn.mockResolvedValueOnce({
      route: 'research',
      acknowledgement: 'I will gather current sources first.',
    });
    transportMocks.loadWebResearch.mockResolvedValueOnce({
      ok: true,
      sources: [{ title: 'Primary source', url: 'https://example.test/source', snippet: 'Evidence' }],
    });
    const { POST } = await import('./route');

    const response = await POST(request('research'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-commonplace-turn-mode')).toBe('cohesive');
    expect(transportMocks.session.prepareTurn).toHaveBeenCalledWith(
      'Explain this record',
      expect.objectContaining({ route: 'research' }),
    );
    await vi.waitFor(() => {
      expect(transportMocks.dispatch).toHaveBeenCalledWith(
        transportMocks.session,
        [expect.objectContaining({
          turnContext: expect.objectContaining({ route: 'research' }),
          message: expect.objectContaining({
            parts: [expect.objectContaining({ text: expect.stringContaining('Primary source') })],
          }),
        })],
        { preparedTurn: true },
      );
    });
  });

  it('refuses an unresolved identity before preparing or dispatching', async () => {
    transportMocks.resolvePrincipal.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });
    const { POST } = await import('./route');

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(transportMocks.resolveSession).not.toHaveBeenCalled();
    expect(transportMocks.session.prepareTurn).not.toHaveBeenCalled();
    expect(transportMocks.dispatch).not.toHaveBeenCalled();
  });

  it('authenticates cancel commands before resolving a session', async () => {
    transportMocks.resolvePrincipal.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'unauthenticated' }, { status: 401 }),
    });
    const { POST } = await import('./route');
    const response = await POST(new Request('https://console.test/api/chat/transport', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'composed',
        bindingId: 'agent:theorem',
        commands: [{ type: 'cancel' }],
      }),
    }));

    expect(response.status).toBe(401);
    expect(transportMocks.resolveSession).not.toHaveBeenCalled();
    expect(transportMocks.dispatch).not.toHaveBeenCalled();
  });

  it('settles a prepared research turn when grounding fails', async () => {
    transportMocks.routeTurn.mockResolvedValueOnce({
      route: 'research',
      acknowledgement: 'I will gather current sources first.',
    });
    transportMocks.loadWebResearch.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ message: 'Research provider unavailable.' }, { status: 503 }),
    });
    const { POST } = await import('./route');

    const response = await POST(request('research'));

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(transportMocks.session.failPreparedTurn).toHaveBeenCalledWith(
        'Research provider unavailable.',
      );
    });
    expect(transportMocks.dispatch).not.toHaveBeenCalled();
  });
});
