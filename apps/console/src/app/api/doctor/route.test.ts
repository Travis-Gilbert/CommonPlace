import { afterEach, describe, expect, it, vi } from 'vitest';

import { probeRoute } from './route';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('doctor route probe', () => {
  it('follows a canonical slash redirect and reads the register header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: '/IDE/' } }),
      )
      .mockResolvedValueOnce(
        new Response('', {
          status: 302,
          headers: {
            location: '/login?callbackUrl=%2FIDE',
            'x-register-impl': 'code-server.ide',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await probeRoute('https://v2.theoremharness.com', '/IDE');

    expect(result.status).toBe(302);
    expect(result.impl).toBe('code-server.ide');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL('https://v2.theoremharness.com/IDE/'),
      { redirect: 'manual' },
    );
  });

  it('does not follow an authentication redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('', {
        status: 302,
        headers: { location: '/login?callbackUrl=%2Fchat' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await probeRoute('https://v2.theoremharness.com', '/chat');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
