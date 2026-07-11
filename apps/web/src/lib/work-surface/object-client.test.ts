import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitObjectAction, fulltextQuery, queryObjects } from './object-client';

/**
 * WS8: object-client.ts had zero test coverage even though it is the exact
 * network seam WS3's live search (omnibar) and BlockHost object views
 * depend on. This is the disclosed Playwright-replacement coverage for
 * that seam -- the same request/error-shape assertions a browser e2e test
 * would make via real network calls, made instead via a mocked global
 * fetch (the repo's established pattern, see
 * app/api/theorem/graphql/route.test.ts).
 */
describe('object-client', () => {
  describe('fulltextQuery', () => {
    it('builds a fulltext ObjectQuery across every type with the default limit', () => {
      const query = fulltextQuery('project alpha');
      expect(query).toEqual({
        types: [],
        rank: [{ kind: 'fulltext', query: 'project alpha' }],
        page: { limit: 8 },
      });
    });

    it('honors a caller-supplied limit', () => {
      const query = fulltextQuery('roadmap', 20);
      expect(query.page).toEqual({ limit: 20 });
    });
  });

  describe('network error handling', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn() as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('surfaces the server-provided error message when the objects backend rejects a query', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unknown type ref "bogus".' }), { status: 400 }),
      );

      await expect(queryObjects({ types: [] })).rejects.toThrow('Unknown type ref "bogus".');
    });

    it('falls back to a generic HTTP-status message when the error body is not JSON', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('<html>Bad Gateway</html>', { status: 502 }),
      );

      await expect(emitObjectAction({ kind: 'delete', id: 'obj-1' })).rejects.toThrow('HTTP 502');
    });

    it('resolves with the parsed body on a successful response', async () => {
      const receipt = { action_kind: 'delete' as const, status: 'applied' as const, target_ids: ['obj-1'] };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify(receipt), { status: 200 }),
      );

      await expect(emitObjectAction({ kind: 'delete', id: 'obj-1' })).resolves.toEqual(receipt);
    });
  });
});
