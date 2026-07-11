import { describe, expect, it } from 'vitest';
import {
  PRODUCT_HOST_PATTERN,
  PRODUCT_REDIRECTS,
  PRODUCT_ROUTE_PROBES,
  normalizeLocation,
  normalizeProductHost,
} from './product-route-matrix';

describe('product route matrix', () => {
  it('makes the porcelain product the permanent root destination', () => {
    const rootRedirect = PRODUCT_REDIRECTS.find(({ source }) => source === '/');

    expect(rootRedirect).toEqual({
      source: '/',
      destination: '/v2',
      permanent: true,
      has: [{ type: 'host', value: PRODUCT_HOST_PATTERN }],
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

  it('rejects cross-origin redirects', () => {
    expect(() =>
      normalizeLocation('https://travisgilbert.me/v2', new URL('https://app.theoremharness.com')),
    ).toThrow('cross-origin redirect');
  });

  it('normalizes product hostnames before compiling the host matcher', () => {
    expect(normalizeProductHost(' APP.THEOREMHARNESS.COM ')).toBe('app.theoremharness.com');
  });
});
