import { describe, expect, it } from 'vitest';
import {
  PRODUCT_REDIRECTS,
  PRODUCT_ROUTE_PROBES,
  normalizeLocation,
} from './product-route-matrix';

describe('product route matrix', () => {
  it('makes the porcelain product the permanent root destination', () => {
    expect(PRODUCT_REDIRECTS[0]).toEqual({
      source: '/',
      destination: '/v2',
      permanent: true,
      has: [{ type: 'host', value: 'app\\.theoremharness\\.com' }],
    });
  });

  it('gives every redirect probe a matching configured source', () => {
    const configuredSources: ReadonlySet<string> = new Set(
      PRODUCT_REDIRECTS.map(({ source }) => source),
    );
    const redirectProbeSources = PRODUCT_ROUTE_PROBES
      .filter(({ expectedLocation }) => expectedLocation !== undefined)
      .map(({ path }) => new URL(path, 'https://candidate.example').pathname);

    expect(redirectProbeSources.every((source) => configuredSources.has(source))).toBe(true);
  });

  it('keeps route probe ids unique', () => {
    const ids = PRODUCT_ROUTE_PROBES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('normalizes relative and absolute Location headers', () => {
    const baseUrl = new URL('https://candidate.example');

    expect(normalizeLocation('/v2?query=1', baseUrl)).toBe('/v2?query=1');
    expect(normalizeLocation('https://candidate.example/v2/files?query=1', baseUrl)).toBe(
      '/v2/files?query=1',
    );
  });
});
