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
