import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  requestForkIdentity: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
  })),
}));
vi.mock('@/lib/server/fork-identity', () => ({
  requestForkIdentity: mocks.requestForkIdentity,
  forkIdentityResponse: (result: { status: number; body: unknown }) =>
    Response.json(result.body, { status: result.status }),
  forkIdentityErrorResponse: () =>
    Response.json({ error: 'identity_proxy_error' }, { status: 502 }),
}));

import { encodeActiveWorkspaceClaims } from './active-workspace';
import { resolveHarnessPrincipal } from './harness-principal';

const SECRET = 'active-workspace-test-secret-longer-than-thirty-two-characters';
const workspace = {
  id: 'workspace-42',
  tenant: 'Travis-Gilbert',
  slug: 'research',
  scopeRef: 'workspace:workspace-42',
  name: 'Research',
  role: {
    key: 'member',
    name: 'Member',
    permissions: ['workspace.read', 'content.read', 'content.write', 'chat.write'],
  },
};
const controlIdentity = {
  principal: {
    id: '00000000-0000-0000-0000-000000000001',
    kind: 'human',
    display_name: 'Second User',
  },
  kind: 'github',
  tenant: {
    id: '00000000-0000-0000-0000-000000000002',
    slug: 'Travis-Gilbert',
  },
  scopes: ['graph:read', 'graph:write'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('COMMONPLACE_ACTIVE_WORKSPACE_SECRET', SECRET);
  vi.stubEnv('AUTH_GITHUB_ID', '');
  vi.stubEnv('AUTH_GITHUB_SECRET', '');
  vi.stubEnv('CONSOLE_HARNESS_TENANT', '');
  mocks.auth.mockResolvedValue({
    user: {
      githubLogin: 'second-user',
      harnessIdentity: 'github:second',
      name: 'Second User',
      email: 'second@example.test',
    },
    expires: '2099-01-01T00:00:00.000Z',
  });
  mocks.cookieGet.mockReturnValue({
    value: encodeActiveWorkspaceClaims({
      subject: 'github:second',
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      tenant: workspace.tenant,
      scopeRef: workspace.scopeRef,
    }, SECRET),
  });
  mocks.requestForkIdentity.mockResolvedValue({
    status: 200,
    body: {
      user: {
        id: 'user-2',
        username: 'second-user',
        displayName: 'Second User',
        email: 'second@example.test',
        status: 'ACTIVE',
      },
      workspaces: [workspace],
      onboardingComplete: true,
    },
  });
  vi.stubGlobal('fetch', vi.fn(async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const request = JSON.parse(String(init?.body)) as {
      provider_subject: string;
      tenant: string;
    };
    if (
      request.provider_subject !== 'second'
      || request.tenant !== 'Travis-Gilbert'
    ) {
      return Response.json({ error: 'cross_tenant_refused' }, { status: 403 });
    }
    return Response.json(controlIdentity);
  }));
});

describe('active Harness workspace resolution', () => {
  it('keeps the actor identity while adopting the admitted graph scope', async () => {
    await expect(resolveHarnessPrincipal()).resolves.toEqual({
      ok: true,
      principal: {
        tenant: 'Travis-Gilbert',
        githubLogin: 'second-user',
        harnessIdentity: 'github:second',
        controlIdentity,
        workspaceId: 'workspace-42',
        workspaceSlug: 'research',
        scopeRef: 'workspace:workspace-42',
      },
    });
    expect(mocks.requestForkIdentity).toHaveBeenCalledWith('/v1/workspaces/list', {
      body: {
        principal: {
          subject: 'github:second',
          username: 'second-user',
          displayName: 'Second User',
          email: 'second@example.test',
        },
      },
    });
  });

  it('refuses when the control-plane tenant differs from the signed workspace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      ...controlIdentity,
      tenant: {
        ...controlIdentity.tenant,
        slug: 'Another-Tenant',
      },
    })));

    const resolution = await resolveHarnessPrincipal();
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.response.status).toBe(403);
      await expect(resolution.response.json()).resolves.toMatchObject({
        error: 'active_workspace_membership_refused',
      });
    }
  });

  it('refuses a claim after membership is revoked', async () => {
    mocks.requestForkIdentity.mockResolvedValueOnce({
      status: 200,
      body: {
        user: {
          id: 'user-2',
          username: 'second-user',
          displayName: 'Second User',
          email: 'second@example.test',
          status: 'ACTIVE',
        },
        workspaces: [],
        onboardingComplete: false,
      },
    });

    const resolution = await resolveHarnessPrincipal();
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.response.status).toBe(403);
      await expect(resolution.response.json()).resolves.toMatchObject({
        error: 'active_workspace_membership_refused',
      });
    }
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'cp_active_workspace',
      '',
      expect.objectContaining({ maxAge: 0 }),
    );
  });

  it('retains the workspace cookie when the membership contract is unavailable', async () => {
    mocks.requestForkIdentity.mockResolvedValueOnce({
      status: 200,
      body: { malformed: true },
    });

    const resolution = await resolveHarnessPrincipal();
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.response.status).toBe(502);
      await expect(resolution.response.json()).resolves.toMatchObject({
        error: 'active_workspace_contract_mismatch',
      });
    }
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('refuses scoped resolution when claim verification is not configured', async () => {
    vi.stubEnv('COMMONPLACE_ACTIVE_WORKSPACE_SECRET', '');

    const resolution = await resolveHarnessPrincipal();
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.response.status).toBe(503);
      await expect(resolution.response.json()).resolves.toMatchObject({
        error: 'active_workspace_configuration_missing',
      });
    }
    expect(mocks.requestForkIdentity).not.toHaveBeenCalled();
  });

  it('requires a signed active-workspace claim for an authenticated user', async () => {
    mocks.cookieGet.mockReturnValueOnce(undefined);

    const resolution = await resolveHarnessPrincipal();
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.response.status).toBe(403);
      await expect(resolution.response.json()).resolves.toMatchObject({
        error: 'active_workspace_claim_required',
      });
    }
    expect(mocks.requestForkIdentity).not.toHaveBeenCalled();
  });

  it('fails closed when the active-workspace cookie store cannot be read', async () => {
    mocks.cookieGet.mockImplementationOnce(() => {
      throw new Error('cookie store unavailable');
    });

    const resolution = await resolveHarnessPrincipal();
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.response.status).toBe(503);
      await expect(resolution.response.json()).resolves.toMatchObject({
        error: 'active_workspace_claim_unavailable',
      });
    }
    expect(mocks.requestForkIdentity).not.toHaveBeenCalled();
  });
});
