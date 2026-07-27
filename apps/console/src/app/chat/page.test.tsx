// SOURCING: none. Ordinary chat must fail closed until its scoped Harness
// bridge owns the runtime route.

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveHarnessPrincipal: vi.fn(),
}));

vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: mocks.resolveHarnessPrincipal,
}));

import ChatIndexPage from './page';

describe('ordinary chat route', () => {
  beforeEach(() => {
    mocks.resolveHarnessPrincipal.mockReset();
  });

  it('refuses the unscoped runtime for an admitted workspace principal', async () => {
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

    const markup = renderToStaticMarkup(await ChatIndexPage());

    expect(markup).toContain('Chat unavailable');
    expect(markup).toContain('legacy unscoped ACP fallback');
    expect(markup).toContain('/workspace/workspace-1/settings');
  });

  it('refuses the unscoped runtime when principal resolution fails', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });

    const markup = renderToStaticMarkup(await ChatIndexPage());

    expect(markup).toContain('Chat unavailable');
    expect(markup).toContain('legacy unscoped ACP fallback');
    expect(markup).toContain('href="/onboarding"');
  });
});
