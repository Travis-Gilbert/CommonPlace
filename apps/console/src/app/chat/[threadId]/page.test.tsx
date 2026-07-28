// SOURCING: none. Thread chat routes mount ChatPage only with an active graph scope.

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
  ChatPage: (props: { threadId?: string; tenant?: string | null }) => (
    <div data-chat-page data-thread-id={props.threadId ?? ''} data-tenant={props.tenant ?? ''} />
  ),
}));

import ChatThreadPage from './page';

describe('thread chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
    mocks.redirect.mockClear();
  });

  it('sends unresolved principals to login', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    await expect(
      ChatThreadPage({ params: Promise.resolve({ threadId: 'thread-1' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/login?callbackUrl=/chat/thread-1');
  });

  it('refuses to mount chat without an active graph scope', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: true,
      principal: {
        tenant: 'Travis-Gilbert',
        githubLogin: 'Travis-Gilbert',
        harnessIdentity: 'github:1',
        workspaceId: null,
        workspaceSlug: null,
        scopeRef: null,
      },
    });

    const markup = renderToStaticMarkup(
      await ChatThreadPage({ params: Promise.resolve({ threadId: 'thread-1' }) }),
    );

    expect(markup).toContain('Select a workspace');
    expect(markup).not.toContain('data-chat-page');
  });

  it('mounts ChatPage for a workspace-scoped principal', async () => {
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
      await ChatThreadPage({ params: Promise.resolve({ threadId: 'thread-1' }) }),
    );

    expect(markup).toContain('data-chat-page');
    expect(markup).toContain('data-thread-id="thread-1"');
    expect(markup).toContain('data-tenant="Travis-Gilbert"');
  });
});
