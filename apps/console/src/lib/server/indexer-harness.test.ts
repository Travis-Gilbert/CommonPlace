import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveHarnessPrincipalMock,
  resolveUpstreamCredentialMock,
  fetchMock,
} = vi.hoisted(() => ({
  resolveHarnessPrincipalMock: vi.fn(),
  resolveUpstreamCredentialMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: resolveHarnessPrincipalMock,
  principalTenantHeaders: () => ({ 'x-theorem-tenant': 'Travis-Gilbert' }),
}));
vi.mock('@/lib/server/upstream-credential', () => ({
  resolveUpstreamCredential: resolveUpstreamCredentialMock,
  credentialHeaders: () => ({ 'x-api-key': 'test-key' }),
}));
vi.mock('@/lib/server/consumer-graphql', () => ({
  consumerGraphqlUrl: () => 'https://data.example/graphql',
}));
vi.mock('@/lib/server/harness-timeout', () => ({
  startHarnessRequestTimeout: () => ({
    signal: undefined,
    didTimeout: () => false,
    clear: () => undefined,
  }),
}));

import { readIndexerObjects } from './indexer-harness';

const principal = {
  tenant: 'Travis-Gilbert',
  githubLogin: 'Travis-Gilbert',
  harnessIdentity: 'github:owner',
};

beforeEach(() => {
  resolveHarnessPrincipalMock.mockReset();
  resolveUpstreamCredentialMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  resolveHarnessPrincipalMock.mockResolvedValue({ ok: true, principal });
  resolveUpstreamCredentialMock.mockResolvedValue({
    ok: true,
    credential: { kind: 'service', key: 'test-key' },
  });
});

describe('Indexer consumer GraphQL transport', () => {
  it('reads Indexer objects through CONSOLE_DATA_API GraphQL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          topicIndexerObjects: {
            objects: [{
              id: 'topic:one',
              type: 'topic',
              properties: { title: 'One' },
            }],
          },
        },
      }),
    });

    const result = await readIndexerObjects({ topicId: 'one' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://data.example/graphql',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('topicIndexerObjects'),
      }),
    );
    expect(result).toEqual({
      ok: true,
      tenant: 'Travis-Gilbert',
      objects: [{
        id: 'topic:one',
        type: 'topic',
        properties: { title: 'One' },
      }],
    });
  });

  it('maps transport failures to the Indexer vocabulary', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({ errors: [{ message: 'timeout' }] }),
    });

    await expect(readIndexerObjects({})).resolves.toEqual({
      ok: false,
      status: 504,
      error: 'timeout',
    });
  });
});
