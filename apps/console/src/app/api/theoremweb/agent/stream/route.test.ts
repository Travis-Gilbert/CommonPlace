import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type MockStreamOptions = {
  readonly sources: readonly unknown[];
  readonly start: () => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(async () => {}),
  resolveSession: vi.fn(async () => ({
    sessionId: 'session-route-1',
    getState: () => ({
      sessionId: 'session-route-1',
      mode: 'composed',
      bindingId: 'agent:theorem',
      turnStatus: 'running',
      activityStatus: 'running',
      messages: [],
      pendingPermission: null,
      blockedReason: null,
      bootBrief: null,
      error: null,
      appliedUpdateKeys: [],
    }),
  })),
  createStream: vi.fn((_options: MockStreamOptions) => new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  })),
  loadWebResearch: vi.fn(),
}));

vi.mock('@commonplace/theorem-acp/bridge', () => {
  class BridgeCommandError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return {
    BridgeCommandError,
    dispatchBridgeCommands: mocks.dispatch,
    resolveBridgeSession: mocks.resolveSession,
    validateBridgeCommands: (commands: unknown) => commands,
  };
});

vi.mock('@/lib/server/theoremweb-ui-message-stream', () => ({
  createTheoremUiMessageStream: mocks.createStream,
  theoremUiMessageStreamHeaders: () => new Headers({
    'Content-Type': 'text/event-stream',
    'x-vercel-ai-ui-message-stream': 'v1',
  }),
}));

vi.mock('@/lib/server/instance-capabilities', () => ({
  loadInstanceCapabilities: async () => ({ ok: true, capabilities: { webSearch: true } }),
}));

vi.mock('@/lib/server/web-research', () => ({
  loadWebResearch: mocks.loadWebResearch,
}));

beforeEach(() => {
  vi.stubEnv('THEOREMWEB_AGENT_STREAM_TOKEN', 'route-secret');
  vi.stubEnv('THEOREMWEB_AGENT_STREAM_TENANT', 'tenant-a');
  vi.stubEnv('THEOREMWEB_ACP_TOKEN', 'private-acp-secret');
  vi.stubEnv('THEOREMWEB_ACP_MODE', 'single');
  mocks.loadWebResearch.mockResolvedValue({ ok: true, sources: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function request(token = 'route-secret', body: Record<string, unknown> = {
  content: [{ type: 'text', text: 'Run the real agent' }],
}): Request {
  return new Request('https://console.test/api/theoremweb/agent/stream', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('Theorem UI-message route', () => {
  it('refuses an invalid bearer before resolving an ACP session', async () => {
    const { POST } = await import('./route');
    const response = await POST(request('wrong-secret'));

    expect(response.status).toBe(401);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it('binds the bearer to the configured tenant and returns protocol v1', async () => {
    const { POST } = await import('./route');
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    expect(response.headers.get('x-theorem-agent-session')).toBe('session-route-1');
    expect(mocks.resolveSession).toHaveBeenCalledWith(expect.objectContaining({
      tenant: 'tenant-a',
      authToken: 'private-acp-secret',
      mode: 'single',
    }));
    const start = mocks.createStream.mock.calls[0]?.[0]?.start as () => Promise<void>;
    await start();
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ type: 'add-message' })],
    );
  });

  it('emits only sources returned by the live research seam', async () => {
    const sources = [{
      title: 'Live source',
      url: 'https://example.test/live',
      snippet: 'Current evidence',
      provider: 'RustyWeb',
    }];
    mocks.loadWebResearch.mockResolvedValueOnce({ ok: true, sources });
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Find current evidence' }],
      capability: { kind: 'web' },
    }));

    expect(response.status).toBe(200);
    expect(mocks.createStream).toHaveBeenCalledWith(expect.objectContaining({ sources }));
    const start = mocks.createStream.mock.calls[0]?.[0]?.start as () => Promise<void>;
    await start();
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({
        message: expect.objectContaining({
          parts: [expect.objectContaining({ text: expect.stringContaining('Live source') })],
        }),
      })],
    );
  });

  it('carries validated caller-resolved sources without claiming a web fetch', async () => {
    const sources = [{
      title: 'V06 stream contract',
      url: 'https://apps.theoremweb.com/api/theoremweb/agent/stream',
      snippet: 'Authenticated AI SDK UI-message SSE endpoint.',
    }];
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Run the sourced agent turn' }],
      sources,
    }));

    expect(response.status).toBe(200);
    expect(mocks.loadWebResearch).not.toHaveBeenCalled();
    expect(mocks.createStream).toHaveBeenCalledWith(expect.objectContaining({
      sources: [expect.objectContaining({
        ...sources[0],
        provider: 'TheoremWeb request',
      })],
    }));
    const start = mocks.createStream.mock.calls[0]?.[0]?.start as () => Promise<void>;
    await start();
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({
        message: expect.objectContaining({
          parts: [expect.objectContaining({
            text: expect.stringContaining('The endpoint has not fetched their contents.'),
          })],
        }),
      })],
    );
  });

  it('refuses unsafe caller-resolved source URLs', async () => {
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Run the sourced agent turn' }],
      sources: [{ title: 'Local file', url: 'file:///etc/passwd' }],
    }));

    expect(response.status).toBe(400);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it('folds a resolved graph-document attachment into the prompt without a second fetch', async () => {
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Summarize the attached runbook' }],
      attachments: [{
        kind: 'document',
        document_id: 'doc-1',
        title: 'Runbook',
        media_type: 'text/markdown',
        content: 'Restart the service.',
      }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.loadWebResearch).not.toHaveBeenCalled();
    const start = mocks.createStream.mock.calls[0]?.[0]?.start as () => Promise<void>;
    await start();
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({
        message: expect.objectContaining({
          parts: [expect.objectContaining({
            text: expect.stringContaining('Restart the service.'),
          })],
        }),
      })],
    );
  });

  it('folds a resolved graph-image attachment in as a URL reference only', async () => {
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Describe the attached diagram' }],
      attachments: [{
        kind: 'image',
        name: 'architecture.png',
        media_type: 'image/png',
        url: 'https://graph.example.test/architecture.png',
      }],
    }));

    expect(response.status).toBe(200);
    const start = mocks.createStream.mock.calls[0]?.[0]?.start as () => Promise<void>;
    await start();
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({
        message: expect.objectContaining({
          parts: [expect.objectContaining({
            text: expect.stringContaining('https://graph.example.test/architecture.png'),
          })],
        }),
      })],
    );
  });

  it('requires an add-message command when attachments are supplied without one', async () => {
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      commands: [{ type: 'permission-response', callId: 'call-1', decision: 'allow' }],
      attachments: [{
        kind: 'document',
        document_id: 'doc-1',
        title: 'Runbook',
        media_type: 'text/markdown',
        content: 'Steps.',
      }],
    }));

    expect(response.status).toBe(400);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it('refuses a malformed attachment kind', async () => {
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Run the attached turn' }],
      attachments: [{ kind: 'video', name: 'clip.mp4' }],
    }));

    expect(response.status).toBe(400);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it('refuses an unsafe image attachment URL', async () => {
    const { POST } = await import('./route');
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Run the attached turn' }],
      attachments: [{
        kind: 'image',
        name: 'local.png',
        media_type: 'image/png',
        url: 'file:///etc/passwd',
      }],
    }));

    expect(response.status).toBe(400);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it('refuses more than the maximum number of attachments', async () => {
    const { POST } = await import('./route');
    const attachments = Array.from({ length: 6 }, (_unused, index) => ({
      kind: 'document',
      document_id: `doc-${index}`,
      title: `Doc ${index}`,
      media_type: 'text/plain',
      content: 'content',
    }));
    const response = await POST(request('route-secret', {
      content: [{ type: 'text', text: 'Run the attached turn' }],
      attachments,
    }));

    expect(response.status).toBe(400);
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });
});
