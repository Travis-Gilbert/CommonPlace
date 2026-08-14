// @vitest-environment node
// SOURCING: none. OKF consumer GraphQL HTTP data-door acceptance tests.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  credentialHeadersMock,
  fetchMock,
  resolveHarnessPrincipalMock,
  resolveUpstreamCredentialMock,
  startHarnessRequestTimeoutMock,
} = vi.hoisted(() => ({
  credentialHeadersMock: vi.fn(),
  fetchMock: vi.fn(),
  resolveHarnessPrincipalMock: vi.fn(),
  resolveUpstreamCredentialMock: vi.fn(),
  startHarnessRequestTimeoutMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: resolveHarnessPrincipalMock,
  principalTenantHeaders: () => ({ 'x-theorem-tenant': 'Travis-Gilbert' }),
}));
vi.mock('@/lib/server/upstream-credential', () => ({
  resolveUpstreamCredential: resolveUpstreamCredentialMock,
  credentialHeaders: credentialHeadersMock,
}));
vi.mock('@/lib/server/harness-timeout', () => ({
  startHarnessRequestTimeout: startHarnessRequestTimeoutMock,
}));

import { POST } from './route';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'service:console-tests',
};

function request(body: Record<string, unknown>): Request {
  return new Request('https://console.example/api/observed-model/okf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function graphqlResponse(data: Record<string, unknown>): Response {
  return Response.json({ data });
}

function capturedGraphqlRequest(): {
  readonly endpoint: string;
  readonly init: RequestInit;
  readonly body: {
    readonly query: string;
    readonly variables: Record<string, unknown>;
  };
} {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    endpoint,
    init,
    body: JSON.parse(String(init.body)) as {
      query: string;
      variables: Record<string, unknown>;
    },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  resolveHarnessPrincipalMock.mockReset();
  resolveUpstreamCredentialMock.mockReset();
  credentialHeadersMock.mockReset();
  startHarnessRequestTimeoutMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('CONSOLE_DATA_API_URL', 'https://data.example');
  vi.stubEnv('THEOREM_GRAPHQL_URL', '');
  resolveHarnessPrincipalMock.mockResolvedValue({ ok: true, principal });
  resolveUpstreamCredentialMock.mockResolvedValue({
    ok: true,
    credential: { kind: 'service_key', key: 'test-key' },
  });
  credentialHeadersMock.mockReturnValue({ 'x-api-key': 'test-key' });
  startHarnessRequestTimeoutMock.mockReturnValue({
    signal: undefined,
    didTimeout: () => false,
    clear: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('OKF consumer data door', () => {
  it('previews a bundle through authenticated consumer HTTP GraphQL', async () => {
    fetchMock.mockResolvedValue(graphqlResponse({
      okfModel: { action: 'preview', valid: true },
    }));

    const response = await POST(request({
      bundleId: 'bundle-one',
      files: { 'model.okf.json': '{}' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ action: 'preview', valid: true });
    const graphql = capturedGraphqlRequest();
    expect(graphql.endpoint).toBe('https://data.example/graphql');
    expect(graphql.init.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      'x-api-key': 'test-key',
      'x-theorem-tenant': 'Travis-Gilbert',
    }));
    expect(graphql.body.query).toContain('query ConsoleOkfModel');
    expect(graphql.body.variables).toEqual({
      action: 'preview',
      bundleId: 'bundle-one',
      files: { 'model.okf.json': '{}' },
    });
  });

  it('exports a bundle through authenticated consumer HTTP GraphQL without files', async () => {
    fetchMock.mockResolvedValue(graphqlResponse({
      okfModel: { action: 'export', files: { 'model.okf.json': '{}' } },
    }));

    const response = await POST(request({ bundleId: 'bundle-one', action: 'export' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      action: 'export',
      files: { 'model.okf.json': '{}' },
    });
    const graphql = capturedGraphqlRequest();
    expect(graphql.endpoint).toBe('https://data.example/graphql');
    expect(graphql.init.headers).toEqual(expect.objectContaining({
      'x-api-key': 'test-key',
      'x-theorem-tenant': 'Travis-Gilbert',
    }));
    expect(graphql.body.query).toContain('query ConsoleOkfModel');
    expect(graphql.body.variables).toEqual({
      action: 'export',
      bundleId: 'bundle-one',
    });
  });

  it('imports a bundle through authenticated consumer HTTP GraphQL', async () => {
    fetchMock.mockResolvedValue(graphqlResponse({
      okfModelApply: { action: 'import', applied: true },
    }));

    const response = await POST(request({
      bundleId: 'bundle-one',
      action: 'import',
      files: { 'model.okf.json': '{}' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ action: 'import', applied: true });
    const graphql = capturedGraphqlRequest();
    expect(graphql.endpoint).toBe('https://data.example/graphql');
    expect(graphql.init.headers).toEqual(expect.objectContaining({
      'x-api-key': 'test-key',
      'x-theorem-tenant': 'Travis-Gilbert',
    }));
    expect(graphql.body.query).toContain('mutation ConsoleOkfModelApply');
    expect(graphql.body.variables).toEqual({
      bundleId: 'bundle-one',
      files: { 'model.okf.json': '{}' },
    });
  });
});
