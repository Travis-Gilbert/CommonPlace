// SOURCING: none. Workspace chat must fail closed until its scoped Harness
// bridge is connected to the runtime route.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveHarnessPrincipal: vi.fn(),
}));

vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: mocks.resolveHarnessPrincipal,
}));

import WorkspaceChatRoute from './page';

describe('workspace chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
  });

  it('does not fall back to the unscoped ACP chat after membership verification', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: true,
      principal: {
        tenant: 'Travis-Gilbert',
        githubLogin: 'Travis-Gilbert',
        harnessIdentity: 'github:1',
        workspaceId: 'workspace-1',
        workspaceSlug: 'research',
        scopeRef: 'workspace:workspace-1',
      },
    });

    const page = await WorkspaceChatRoute({
      params: Promise.resolve({ workspaceSlug: 'research' }),
    });

    expect(page.props.title).toBe('Workspace chat unavailable');
    expect(mocks.resolveHarnessPrincipal).toHaveBeenCalledOnce();
    expect(mocks.resolveHarnessPrincipal).toHaveBeenCalledWith();
    expect(page.props.children.props.children).toContain(
      'legacy unscoped ACP fallback',
    );
  });

  it('remains unavailable when active membership resolution fails', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'missing_harness_identity',
      message: 'Sign in to continue.',
    });

    const page = await WorkspaceChatRoute({
      params: Promise.resolve({ workspaceSlug: 'research' }),
    });

    expect(page.props.title).toBe('Workspace unavailable');
    expect(page.props.description).toBe(
      'The active membership could not be verified.',
    );
    expect(mocks.resolveHarnessPrincipal).toHaveBeenCalledOnce();
    expect(mocks.resolveHarnessPrincipal).toHaveBeenCalledWith();
  });
});
