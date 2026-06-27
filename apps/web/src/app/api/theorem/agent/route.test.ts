import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/theorem/agent/route';

const AGENT_ENV = [
  'THEOREM_AGENT_ENDPOINT',
  'THEOREM_AGENT_API_URL',
  'THEOREM_AGENT_URL',
  'THEOREM_PRODUCT_API_URL',
  'THEOREM_API_URL',
  'RUSTYRED_AGENT_URL',
  'NEXT_PUBLIC_THEOREM_AGENT_API_URL',
  'NEXT_PUBLIC_THEOREM_API_URL',
  'NEXT_PUBLIC_HARNESS_URL',
  'THEOREM_AGENT_API_TOKEN',
  'THEOREM_API_TOKEN',
  'THEOREM_AGENT_API_BEARER',
  'THEOREM_AGENT_BEARER',
  'RUSTYRED_AGENT_BEARER',
  'HARNESS_API_KEY',
  'THEOREM_AGENT_HEADS',
  'THEOREM_AGENT_HEAD_DEEPSEEK_PROVIDER',
  'THEOREM_AGENT_HEAD_DEEPSEEK_MODEL',
  'THEOREM_AGENT_HEAD_DEEPSEEK_CREDENTIAL_REF',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_CHAT_URL',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL',
  'MISTRAL_API_KEY',
  'MISTRAL_CHAT_URL',
  'MISTRAL_BASE_URL',
  'MISTRAL_MODEL',
  'MINIMAX_API_KEY',
  'MINIMAX_CHAT_URL',
  'MINIMAX_BASE_URL',
  'MINIMAX_MODEL',
] as const;

describe('POST /api/theorem/agent', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(AGENT_ENV.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    for (const name of AGENT_ENV) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of AGENT_ENV) {
      restoreEnv(name, originalEnv[name]);
    }
    vi.restoreAllMocks();
  });

  it.each([
    ['base URL', 'https://example.test', 'https://example.test/v1/theorem/agent/run'],
    [
      'path-prefixed base URL',
      'https://example.test/theorem',
      'https://example.test/theorem/v1/theorem/agent/run',
    ],
    ['GraphQL URL', 'https://example.test/graphql', 'https://example.test/v1/theorem/agent/run'],
    [
      'nested GraphQL URL',
      'https://example.test/theorem/graphql',
      'https://example.test/theorem/v1/theorem/agent/run',
    ],
    ['MCP URL', 'https://example.test/mcp/', 'https://example.test/v1/theorem/agent/run'],
    [
      'same-origin proxy URL',
      'https://example.test/api/theorem/agent',
      'https://example.test/v1/theorem/agent/run',
    ],
    [
      'agent-run URL',
      'https://example.test/v1/theorem/agent/run',
      'https://example.test/v1/theorem/agent/run',
    ],
  ])('normalizes %s to the product agent endpoint', async (_label, configuredUrl, expectedUrl) => {
    const calls: Array<{ url: string; body: unknown; authorization?: string | null }> = [];
    process.env.THEOREM_AGENT_URL = configuredUrl;
    process.env.THEOREM_AGENT_API_TOKEN = 'test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        authorization: headers.get('authorization'),
      });
      return new Response(JSON.stringify(agentPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Wire the Omnibar to the product agent.',
          tenant: 'Travis-Gilbert',
          bindingId: 'agent:theorem',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(expectedUrl);
    expect(calls[0].authorization).toBe('Bearer test-token');
    expect(calls[0].body).toMatchObject({
      tenant: 'Travis-Gilbert',
      tenant_slug: 'Travis-Gilbert',
      binding_id: 'agent:theorem',
      task: 'Wire the Omnibar to the product agent.',
    });
    expect(body.answer).toBe('CommonPlace agent response');
  });

  it.each([
    ['missing task', {}],
    ['non-string task', { task: 12 }],
  ])('returns a clear request error for %s', async (_label, body) => {
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'invalid_agent_request',
      message: 'Theorem agent requires a task.',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['non-string tenant', { task: 'Run the agent.', tenant: 12 }, 'Theorem agent tenant must be a string.'],
    [
      'non-string bindingId',
      { task: 'Run the agent.', bindingId: 12 },
      'Theorem agent bindingId must be a string.',
    ],
  ])('returns a clear request error for %s', async (_label, body, message) => {
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'invalid_agent_request',
      message,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('can answer directly from DeepSeek when only DEEPSEEK_API_KEY is configured', async () => {
    const calls: Array<{ url: string; body: unknown; authorization?: string | null }> = [];
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        authorization: headers.get('authorization'),
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'DeepSeek is live from CommonPlace.' } }],
          usage: { prompt_tokens: 12, completion_tokens: 8 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Say hello from DeepSeek.',
          tenant: 'Travis-Gilbert',
          bindingId: 'agent:theorem',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(calls[0].authorization).toBe('Bearer deepseek-test-token');
    expect(calls[0].body).toMatchObject({
      model: 'deepseek-v4-pro',
      stream: false,
    });
    expect(body).toMatchObject({
      answer: 'DeepSeek is live from CommonPlace.',
      answerKind: 'MODEL',
      bindingId: 'agent:theorem',
      heads: ['deepseek'],
    });
  });

  it('skips explicit heads without keys and uses the first configured provider key', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    process.env.THEOREM_AGENT_HEADS = 'mistral,deepseek';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'DeepSeek handled the explicit head list.' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Use whichever configured head can run.',
          tenant: 'Travis-Gilbert',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(body).toMatchObject({
      answer: 'DeepSeek handled the explicit head list.',
      heads: ['deepseek'],
    });
  });
});

function agentPayload(): unknown {
  return {
    tenant: 'Travis-Gilbert',
    result: {
      binding_id: 'agent:theorem',
      run_id: 'run:test',
      published_claims: [],
      consensus_head_set: ['deepseek'],
      alignment_verdict: { allowed: true },
      invocation_receipts: [
        {
          invocation_id: 'invocation:test',
          head_id: 'deepseek',
          output_summary: 'provider summary',
          payload: { text: 'CommonPlace agent response' },
          claims: [],
          created_at: '2026-06-26T00:00:00Z',
        },
      ],
    },
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
