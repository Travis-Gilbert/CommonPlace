// SOURCING: none. Thread chat routes must resolve an active graph scope before
// mounting the interactive composer.

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveHarnessPrincipal: vi.fn(),
}));

vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: mocks.resolveHarnessPrincipal,
}));

vi.mock('@/components/chat/ChatPage', () => ({
  ChatPage: ({
    threadId,
    tenant,
  }: {
    readonly threadId?: string;
    readonly tenant?: string | null;
  }) => <div data-chat-page data-thread-id={threadId} data-tenant={tenant} />,
}));

import ChatThreadPage from './page';

describe('thread chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
  });

  it('refuses to mount chat when principal resolution fails', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 403 }),
    });

    const markup = renderToStaticMarkup(await ChatThreadPage({
      params: Promise.resolve({ threadId: 'thread-1' }),
    }));

    expect(markup).toContain('Chat unavailable');
    expect(markup).toContain('legacy unscoped ACP fallback');
    expect(markup).not.toContain('data-chat-page');
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

    const markup = renderToStaticMarkup(await ChatThreadPage({
      params: Promise.resolve({ threadId: 'thread-1' }),
    }));

    expect(markup).toContain('Chat unavailable');
    expect(markup).not.toContain('data-chat-page');
  });

  it('mounts the requested thread only for a workspace-scoped principal', async () => {
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

    const markup = renderToStaticMarkup(await ChatThreadPage({
      params: Promise.resolve({ threadId: 'thread%2F1' }),
    }));

    expect(markup).toContain('data-chat-page');
    expect(markup).toContain('data-thread-id="thread/1"');
    expect(markup).toContain('data-tenant="Travis-Gilbert"');
    expect(markup).not.toContain('Chat unavailable');
  });
});
