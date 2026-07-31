import { describe, expect, it, vi } from 'vitest';

const { livePrincipal } = vi.hoisted(() => ({
  livePrincipal: {
    tenant: process.env.CONSOLE_HARNESS_TENANT ?? 'Travis-Gilbert',
    githubLogin: process.env.CONSOLE_E2E_GITHUB_LOGIN ?? '',
    harnessIdentity: process.env.CONSOLE_E2E_HARNESS_IDENTITY ?? '',
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/harness-principal', () => ({
  resolveHarnessPrincipal: vi.fn().mockResolvedValue({ ok: true, principal: livePrincipal }),
  principalTenantHeaders: vi.fn().mockReturnValue({
    'x-theorem-tenant': livePrincipal.tenant,
    'x-theorem-principal': livePrincipal.harnessIdentity,
  }),
}));

const liveEnabled = process.env.CONSOLE_HARNESS_LIVE_TEST === '1';

describe.skipIf(!liveEnabled)('hosted Harness MCP', () => {
  it('reuses one session across two Harness GraphQL queries', async () => {
    expect(process.env.CONSOLE_HARNESS_URL).toBeTruthy();
    expect(process.env.CONSOLE_HARNESS_TOKEN).toBeTruthy();
    expect(process.env.CONSOLE_E2E_GITHUB_LOGIN).toBeTruthy();
    expect(process.env.CONSOLE_E2E_HARNESS_IDENTITY).toBeTruthy();

    const { callHarnessGraphql } = await import('./harness-graphql');
    const first = await callHarnessGraphql(
      'query ConsoleHarnessLiveProbe { __typename }',
    );
    const second = await callHarnessGraphql(
      'query ConsoleHarnessLiveReuseProbe { __typename }',
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.data).toMatchObject({ __typename: expect.any(String) });
      expect(second.data).toMatchObject({ __typename: expect.any(String) });
    }
  }, 30_000);
});
