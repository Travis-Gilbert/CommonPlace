import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveHarnessPrincipal: vi.fn(),
  resolveUpstreamCredential: vi.fn(),
  principalTenantHeaders: vi.fn(() => ({
    'x-theorem-tenant': 'Travis-Gilbert',
    'x-commonplace-workspace-id': 'workspace-42',
    'x-commonplace-scope-ref': 'workspace:workspace-42',
  })),
  fetch: vi.fn(),
}));

vi.mock('@/lib/server/harness-principal', () => ({
  principalTenantHeaders: mocks.principalTenantHeaders,
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
  mocks.resolveUpstreamCredential.mockResolvedValue({
    ok: true,
    credential: { kind: 'service', key: 'test-key' },
  });
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify([{ id: 'table' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

describe('object seam workspace bulkhead', () => {
  it('forwards a workspace principal with scope headers instead of refusing the live door', async () => {
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

    expect(response.status).toBe(200);
    expect(mocks.resolveUpstreamCredential).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/objects\/views$/),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
          'x-commonplace-scope-ref': 'workspace:workspace-42',
        }),
      }),
    );
  });
});
