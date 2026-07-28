// SOURCING: none. Ordinary chat redirects into scoped workspace chat once an
// active membership exists.

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

import ChatIndexPage from './page';

describe('ordinary chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
    mocks.redirect.mockClear();
  });

  it('redirects an admitted workspace principal into scoped chat', async () => {
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

    await expect(ChatIndexPage()).rejects.toThrow('NEXT_REDIRECT:/workspace/workspace-1/chat');
    expect(mocks.redirect).toHaveBeenCalledWith('/workspace/workspace-1/chat');
  });

  it('sends unresolved principals to login', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });

    await expect(ChatIndexPage()).rejects.toThrow('NEXT_REDIRECT:/login?callbackUrl=/chat');
    expect(mocks.redirect).toHaveBeenCalledWith('/login?callbackUrl=/chat');
  });
});
