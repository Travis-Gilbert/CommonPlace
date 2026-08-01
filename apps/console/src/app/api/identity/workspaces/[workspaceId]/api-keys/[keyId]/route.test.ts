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

import { DELETE } from './route';

describe('workspace API key revocation route', () => {
  beforeEach(() => {
    mocks.requestForkIdentity.mockReset();
    mocks.resolveForkIdentityPrincipal.mockReset();
  });

  it('forwards both workspace and key identifiers', async () => {
    mocks.resolveForkIdentityPrincipal.mockResolvedValue({
      subject: 'github:1',
      username: 'Travis-Gilbert',
    });
    mocks.requestForkIdentity.mockResolvedValue({
      status: 200,
      body: { revoked: true },
    });

    const response = await DELETE(
      new Request(
        'https://console.example.test/api/identity/workspaces/workspace-1/api-keys/key-1',
        {
          method: 'DELETE',
          headers: { origin: 'https://console.example.test' },
        },
      ),
      {
        params: Promise.resolve({
          workspaceId: 'workspace-1',
          keyId: 'key-1',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestForkIdentity).toHaveBeenCalledWith(
      '/v1/workspaces/workspace-1/api-keys/key-1',
      expect.objectContaining({
        method: 'DELETE',
        body: {
          principal: expect.objectContaining({ subject: 'github:1' }),
        },
      }),
    );
  });
});
