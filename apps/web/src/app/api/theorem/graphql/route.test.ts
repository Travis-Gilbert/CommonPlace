import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMMONPLACE_INSTANCE_KEY_HEADER,
  COMMONPLACE_INSTANCE_URL_HEADER,
} from '@/lib/commonplace-instance';

const GRAPHQL_ENV = [
  'THEOREM_GRAPHQL_URL',
  'THEOREM_API_KEY',
  'COMMONPLACE_CLIENT_INSTANCE_DEFAULT_API_KEY',
  'COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE',
] as const;

describe('POST /api/theorem/graphql', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(GRAPHQL_ENV.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    vi.resetModules();
    for (const name of GRAPHQL_ENV) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of GRAPHQL_ENV) {
      restoreEnv(name, originalEnv[name]);
    }
    vi.restoreAllMocks();
  });

  it('forwards to the configured cloud instance with the server API key', async () => {
    process.env.THEOREM_GRAPHQL_URL = 'https://cloud.example/commonplace';
    process.env.THEOREM_API_KEY = 'cloud-key';
    const calls: Array<{ url: string; apiKey?: string | null }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), apiKey: headers.get('x-api-key') });
      return new Response(JSON.stringify({ data: { __typename: 'Query' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const { POST } = await import('@/app/api/theorem/graphql/route');
    const response = await POST(graphqlRequest());

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { url: 'https://cloud.example/commonplace/graphql', apiKey: 'cloud-key' },
    ]);
  });

  it('can forward a browser-selected local instance when overrides are enabled', async () => {
    process.env.THEOREM_GRAPHQL_URL = 'https://cloud.example/graphql';
    process.env.THEOREM_API_KEY = 'cloud-key';
    process.env.COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE = '1';
    const calls: Array<{ url: string; apiKey?: string | null }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), apiKey: headers.get('x-api-key') });
      return new Response(JSON.stringify({ data: { __typename: 'Query' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const { POST } = await import('@/app/api/theorem/graphql/route');
    const response = await POST(
      graphqlRequest({
        [COMMONPLACE_INSTANCE_URL_HEADER]: 'http://127.0.0.1:50090',
        [COMMONPLACE_INSTANCE_KEY_HEADER]: 'local-key',
      }),
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { url: 'http://127.0.0.1:50090/graphql', apiKey: 'local-key' },
    ]);
  });

  it('defaults browser-selected local instances to dev-key when no key is supplied', async () => {
    process.env.THEOREM_GRAPHQL_URL = 'https://cloud.example/graphql';
    process.env.THEOREM_API_KEY = 'cloud-key';
    process.env.COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE = '1';
    const calls: Array<{ url: string; apiKey?: string | null }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), apiKey: headers.get('x-api-key') });
      return new Response(JSON.stringify({ data: { __typename: 'Query' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const { POST } = await import('@/app/api/theorem/graphql/route');
    const response = await POST(
      graphqlRequest({
        [COMMONPLACE_INSTANCE_URL_HEADER]: 'http://localhost:50090',
      }),
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { url: 'http://localhost:50090/graphql', apiKey: 'dev-key' },
    ]);
  });

  it('rejects public client-selected instance hosts', async () => {
    process.env.COMMONPLACE_ALLOW_CLIENT_INSTANCE_OVERRIDE = '1';
    globalThis.fetch = vi.fn() as typeof fetch;

    const { POST } = await import('@/app/api/theorem/graphql/route');
    const response = await POST(
      graphqlRequest({
        [COMMONPLACE_INSTANCE_URL_HEADER]: 'https://example.com/graphql',
        [COMMONPLACE_INSTANCE_KEY_HEADER]: 'public-key',
      }),
    );
    const payload = (await response.json()) as { errors?: Array<{ message?: string }> };

    expect(response.status).toBe(400);
    expect(payload.errors?.[0]?.message).toContain('localhost or a private LAN host');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects client-selected instances when overrides are disabled', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;

    const { POST } = await import('@/app/api/theorem/graphql/route');
    const response = await POST(
      graphqlRequest({
        [COMMONPLACE_INSTANCE_URL_HEADER]: 'http://127.0.0.1:50090',
        [COMMONPLACE_INSTANCE_KEY_HEADER]: 'local-key',
      }),
    );
    const payload = (await response.json()) as { errors?: Array<{ message?: string }> };

    expect(response.status).toBe(403);
    expect(payload.errors?.[0]?.message).toContain('not enabled');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

function graphqlRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/theorem/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'query CommonPlaceInstanceProbe { __typename }' }),
  });
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
