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

    const markup = renderToStaticMarkup(await ChatThreadPage());

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

    const markup = renderToStaticMarkup(await ChatThreadPage());

    expect(markup).toContain('Chat unavailable');
    expect(markup).not.toContain('data-chat-page');
  });

  it('refuses the legacy runtime even for a workspace-scoped principal', async () => {
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

    const markup = renderToStaticMarkup(await ChatThreadPage());

    expect(markup).toContain('Chat unavailable');
    expect(markup).toContain('/workspace/workspace-1/settings');
    expect(markup).not.toContain('data-chat-page');
  });
});
