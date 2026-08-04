// SOURCING: none. Ordinary chat stays on /chat for an admitted principal so the
// OW4 middleware can reverse-proxy the workspace openwork door. The old
// redirect into /workspace/*/chat is retired: page.tsx forbids it by name
// because that path misses the proxy matcher and remounts assistant-ui.

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
import { OpenworkChatRegister } from '@/views/OpenworkChatRegister';

describe('ordinary chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
    mocks.redirect.mockClear();
  });

  it('keeps an admitted workspace principal on /chat for the proxy', async () => {
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

    const rendered = await ChatIndexPage();

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(rendered.type).toBe(OpenworkChatRegister);
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
