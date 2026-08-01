import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestForkIdentity: vi.fn(),
  resolveForkIdentityPrincipal: vi.fn(),
}));

vi.mock('@/lib/server/fork-identity', () => ({
  assertSameOriginIdentityMutation: vi.fn(),
  forkIdentityErrorResponse: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'identity_error' },
      { status: 401 },
    ),
  forkIdentityResponse: (result: { status: number; body: unknown }) =>
    Response.json(result.body, { status: result.status }),
  requestForkIdentity: mocks.requestForkIdentity,
  resolveForkIdentityPrincipal: mocks.resolveForkIdentityPrincipal,
}));

import { API_KEY_REVOCATION_CACHE_SECS, POST } from './route';

describe('workspace API key issuance route', () => {
  beforeEach(() => {
    mocks.requestForkIdentity.mockReset();
    mocks.resolveForkIdentityPrincipal.mockReset();
  });

  it('mints a dual-lane key with models:invoke and agent:bind by default', async () => {
    mocks.resolveForkIdentityPrincipal.mockResolvedValue({
      subject: 'github:1',
      username: 'Travis-Gilbert',
    });
    mocks.requestForkIdentity.mockResolvedValue({
      status: 201,
      body: {
        key: 'cpk_deadbeef_abcdefghijklmnopqrstuvwxyz0123456789ABC',
        record: {
          id: 'key-1',
          scopes: ['models:invoke', 'agent:bind', 'workspace.read'],
        },
      },
    });

    const response = await POST(
      new Request(
        'https://console.example.test/api/identity/workspaces/workspace-1/api-keys',
        {
          method: 'POST',
          headers: {
            origin: 'https://console.example.test',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: 'Widget' }),
        },
      ),
      { params: Promise.resolve({ workspaceId: 'workspace-1' }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      record: {
        scopes: expect.arrayContaining(['models:invoke', 'agent:bind']),
      },
      revocationCacheSeconds: API_KEY_REVOCATION_CACHE_SECS,
    });
    expect(mocks.requestForkIdentity).toHaveBeenCalledWith(
      '/v1/workspaces/workspace-1/api-keys',
      expect.objectContaining({
        body: expect.objectContaining({
          apiKey: expect.objectContaining({
            scopes: expect.arrayContaining(['models:invoke', 'agent:bind']),
          }),
        }),
      }),
    );
  });
});
