import { afterEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({ auth: authMock }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('server Harness principal admission', () => {
  it('refuses immediately when GitHub OAuth is not configured', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', '');
    vi.stubEnv('AUTH_GITHUB_SECRET', '');
    const { resolveHarnessPrincipal } = await import('./harness-principal');

    const resolution = await resolveHarnessPrincipal();

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Expected identity refusal.');
    expect(resolution.response.status).toBe(401);
    expect(authMock).not.toHaveBeenCalled();
  });

  it('refuses an anonymous session instead of using the configured service tenant', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', 'client');
    vi.stubEnv('AUTH_GITHUB_SECRET', 'secret');
    vi.stubEnv('CONSOLE_HARNESS_TENANT', 'Travis-Gilbert');
    authMock.mockResolvedValueOnce(null);
    const { resolveHarnessPrincipal } = await import('./harness-principal');

    const resolution = await resolveHarnessPrincipal();

    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error('Expected identity refusal.');
    expect(resolution.response.status).toBe(401);
  });

  it('derives the tenant only from verified GitHub session claims', async () => {
    vi.stubEnv('AUTH_GITHUB_ID', 'client');
    vi.stubEnv('AUTH_GITHUB_SECRET', 'secret');
    authMock.mockResolvedValueOnce({
      user: {
        githubLogin: 'new-harness-user',
        harnessIdentity: 'github:42',
      },
      expires: '2099-01-01T00:00:00.000Z',
    });
    const { resolveHarnessPrincipal } = await import('./harness-principal');

    await expect(resolveHarnessPrincipal()).resolves.toEqual({
      ok: true,
      principal: {
        tenant: 'new-harness-user',
        githubLogin: 'new-harness-user',
        harnessIdentity: 'github:42',
      },
    });
  });
});
