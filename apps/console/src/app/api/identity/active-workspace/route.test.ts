import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  requestForkIdentity: vi.fn(),
  resolveForkIdentityPrincipal: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    set: mocks.cookieSet,
  })),
}));

vi.mock('@/lib/server/fork-identity', () => ({
  ForkIdentityProxyError: class ForkIdentityProxyError extends Error {},
  forkIdentityErrorResponse: () =>
    Response.json({ error: 'identity_proxy_error' }, { status: 502 }),
  forkIdentityResponse: (result: { status: number; body: unknown }) =>
    Response.json(result.body, { status: result.status }),
  readJsonObject: vi.fn(),
  requestForkIdentity: mocks.requestForkIdentity,
  resolveForkIdentityPrincipal: mocks.resolveForkIdentityPrincipal,
}));

import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/server/active-workspace';
import { DELETE } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveForkIdentityPrincipal.mockRejectedValue(
    new Error('session provider unavailable'),
  );
  mocks.requestForkIdentity.mockRejectedValue(
    new Error('identity peer unavailable'),
  );
});

describe('active workspace deletion', () => {
  it('clears the local cookie without resolving session or identity peers', async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cleared: true });
    expect(mocks.resolveForkIdentityPrincipal).not.toHaveBeenCalled();
    expect(mocks.requestForkIdentity).not.toHaveBeenCalled();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ACTIVE_WORKSPACE_COOKIE,
      '',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        maxAge: 0,
      }),
    );
  });
});
