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
  forkIdentityResponse: vi.fn(),
  requestForkIdentity: mocks.requestForkIdentity,
  resolveForkIdentityPrincipal: mocks.resolveForkIdentityPrincipal,
}));

import { POST } from './route';

describe('workspace API key issuance route', () => {
  beforeEach(() => {
    mocks.requestForkIdentity.mockReset();
    mocks.resolveForkIdentityPrincipal.mockReset();
  });

  it('authenticates the user but refuses to mint an unconsumable key', async () => {
    mocks.resolveForkIdentityPrincipal.mockResolvedValue({
      subject: 'github:1',
      username: 'Travis-Gilbert',
    });

    const response = await POST(
      new Request(
        'https://console.example.test/api/identity/workspaces/workspace-1/api-keys',
        {
          method: 'POST',
          headers: { origin: 'https://console.example.test' },
        },
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'api_key_consumer_unavailable',
    });
    expect(mocks.resolveForkIdentityPrincipal).toHaveBeenCalledOnce();
    expect(mocks.requestForkIdentity).not.toHaveBeenCalled();
  });
});
