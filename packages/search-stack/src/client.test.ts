import { describe, expect, it, vi } from 'vitest';
import { createSearchStackClient } from './client';
import { find, scatter } from './__tests__/fixtures';

describe('same-origin search client', () => {
  it('posts find to the configured base path', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({ data: find() }),
    );
    const client = createSearchStackClient({
      fetch: fetcher,
      basePath: '/console/search/',
    });
    await client.find({
      query: 'budget',
      scopes: [{ kind: 'CORPUS' }],
      lanes: ['EXACT'],
      k: 20,
      lambda: 0.8,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/console/search/find');
    expect(fetcher.mock.calls[0][1]?.method).toBe('POST');
  });

  it('posts scatter and returns the route data', async () => {
    const response = scatter();
    const client = createSearchStackClient({
      fetch: vi.fn(async () => Response.json({ data: response })),
    });
    await expect(
      client.scatter({ query: 'membrane', k: 8, lambda: 0.5 }),
    ).resolves.toEqual(response);
  });

  it('surfaces the route error message', async () => {
    const client = createSearchStackClient({
      fetch: vi.fn(async () =>
        Response.json(
          { error: 'search_failed', message: 'Index is unavailable.' },
          { status: 502 },
        )
      ),
    });
    await expect(
      client.scatter({ query: 'membrane', k: 8, lambda: 0.5 }),
    ).rejects.toThrow('Index is unavailable.');
  });

  it('refuses a successful response with no data', async () => {
    const client = createSearchStackClient({
      fetch: vi.fn(async () => Response.json({ ok: true })),
    });
    await expect(client.saveUrl('https://example.com')).rejects.toThrow(
      'returned no data',
    );
  });
});
