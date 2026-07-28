// SOURCING: none. Workspace chat mounts ChatPage after membership verification.

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveHarnessPrincipal: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: mocks.resolveHarnessPrincipal,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/components/chat/ChatPage', () => ({
  ChatPage: (props: { tenant?: string | null }) => (
    <div data-chat-page data-tenant={props.tenant ?? ''} />
  ),
}));

import WorkspaceChatRoute from './page';

describe('workspace chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
    mocks.redirect.mockClear();
  });

  it('mounts ChatPage after membership verification', async () => {
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

    const markup = renderToStaticMarkup(
      await WorkspaceChatRoute({
        params: Promise.resolve({ workspaceSlug: 'workspace-1' }),
      }),
    );

    expect(markup).toContain('data-chat-page');
    expect(markup).toContain('data-tenant="Travis-Gilbert"');
    expect(mocks.resolveHarnessPrincipal).toHaveBeenCalledOnce();
  });

  it('refuses a legacy slug even when the active workspace uses it', async () => {
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

    expect(page.props.title).toBe('Select this workspace');
  });

  it('sends unresolved principals to login', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'missing_harness_identity',
      message: 'Sign in to continue.',
    });

    await expect(
      WorkspaceChatRoute({
        params: Promise.resolve({ workspaceSlug: 'research' }),
      }),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackUrl=/workspace/research/chat',
    );
    expect(mocks.resolveHarnessPrincipal).toHaveBeenCalledOnce();
  });
});
