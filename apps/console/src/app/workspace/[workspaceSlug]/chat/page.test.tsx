// SOURCING: none. Workspace chat collapses onto /chat for the OW4 proxy.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: vi.fn(),
}));

import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import WorkspaceChatRoute from './page';

describe('WorkspaceChatRoute', () => {
  beforeEach(() => {
    redirect.mockClear();
    vi.mocked(resolveHarnessPrincipal).mockReset();
  });

  it('redirects verified membership onto /chat', async () => {
    vi.mocked(resolveHarnessPrincipal).mockResolvedValue({
      ok: true,
      principal: {
        tenant: 'Travis-Gilbert',
        workspaceId: 'ws-1',
        scopeRef: 'scope-1',
      },
    } as never);

    await expect(
      WorkspaceChatRoute({ params: Promise.resolve({ workspaceSlug: 'ws-1' }) }),
    ).rejects.toThrow('REDIRECT:/chat');
  });
});
