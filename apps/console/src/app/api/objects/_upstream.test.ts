import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveHarnessPrincipal: vi.fn(),
  resolveUpstreamCredential: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/server/harness-principal', () => ({
  principalTenantHeaders: vi.fn(() => ({})),
  resolveHarnessPrincipal: mocks.resolveHarnessPrincipal,
}));
vi.mock('@/lib/server/upstream-credential', () => ({
  credentialHeaders: vi.fn(() => ({ 'x-api-key': 'test-key' })),
  credentialRefusalResponse: vi.fn(),
  isServicePrincipal: vi.fn(() => false),
  resolveUpstreamCredential: mocks.resolveUpstreamCredential,
  serviceUpstreamKey: vi.fn(() => 'test-key'),
}));

import { forward } from './_upstream';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
});

describe('object seam workspace bulkhead', () => {
  it('refuses a workspace principal before credential resolution or fetch', async () => {
    mocks.resolveHarnessPrincipal.mockResolvedValue({
      ok: true,
      principal: {
        tenant: 'Travis-Gilbert',
        githubLogin: 'second-user',
        harnessIdentity: 'github:2',
        workspaceId: 'workspace-42',
        scopeRef: 'workspace:workspace-42',
      },
    });

    const response = await forward('/objects/views', { method: 'GET' });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'workspace_object_scope_unenforced',
    });
    expect(mocks.resolveUpstreamCredential).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
