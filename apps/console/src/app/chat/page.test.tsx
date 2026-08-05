// SOURCING: none. Ordinary chat stays on /chat for an admitted principal and
// renders the Theorem chat register (SPEC-THEOREM-CHAT-REGISTER-1.0).

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

vi.mock('@/views/TheoremChatRegister', () => ({
  TheoremChatRegisterView: function TheoremChatRegisterView() {
    return null;
  },
}));

import ChatIndexPage from './page';
import { TheoremChatRegisterView } from '@/views/TheoremChatRegister';

describe('ordinary chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
    mocks.redirect.mockClear();
  });

  it('keeps an admitted workspace principal on /chat Theorem register', async () => {
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
    expect(rendered.type).toBe(TheoremChatRegisterView);
  });

  it('sends unresolved principals to login', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: 'principal_resolution=unauthenticated' },
        { status: 401 },
      ),
    });

    await expect(ChatIndexPage()).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackUrl=%2Fchat',
    );
    expect(mocks.redirect).toHaveBeenCalledWith('/login?callbackUrl=%2Fchat');
  });

  it('sends signed-in users missing an active workspace to onboarding', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: 'active_workspace_claim_required' },
        { status: 403 },
      ),
    });

    await expect(ChatIndexPage()).rejects.toThrow('NEXT_REDIRECT:/onboarding');
    expect(mocks.redirect).toHaveBeenCalledWith('/onboarding');
  });
});
