import { afterEach, describe, expect, it, vi } from 'vitest';

import { gqlItemsAsOf } from '@/lib/commonplace-graphql';

describe('gqlItemsAsOf', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('rejects unsupported schema fields so timeline callers can fall back to their feed', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          errors: [{ message: 'Cannot query field "itemsAsOf" on type "Query".' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    await expect(gqlItemsAsOf({ validAtMs: 1_725_000_000_000 })).rejects.toThrow(
      'Cannot query field "itemsAsOf"',
    );
  });
});
