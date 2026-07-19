// SOURCING: vitest (the app's test runner) plus @commonplace/block-view/addressing
// as the grammar oracle. The assertions compare against the shared parser, so a
// drift between the route encoding and the canonical grammar fails here.

import { describe, expect, it } from 'vitest';
import {
  parseTheoremUri,
  theoremUri,
  type TheoremAddress,
} from '@commonplace/block-view/addressing';
import {
  ADDRESS_PARAM,
  OBJECT_ROUTE,
  addressFromRouteParams,
  objectRouteHref,
} from './theorem-address-route';

/** The query half of a route href, as the route's own search params. */
function paramsOf(href: string): URLSearchParams {
  return new URLSearchParams(href.slice(href.indexOf('?') + 1));
}

function roundTrip(address: TheoremAddress): TheoremAddress {
  const parsed = addressFromRouteParams(paramsOf(objectRouteHref(address)));
  if (!parsed.ok) throw new Error(parsed.refusal.message);
  return parsed.address;
}

describe('theorem:// address route (DESIGN-THEOREM-URI section 3)', () => {
  const plain: TheoremAddress = {
    tenant: 'Travis-Gilbert',
    kind: 'memory',
    id: 'cr:memory:abc123',
  };

  it('addresses the console shell route the desktop export ships', () => {
    expect(objectRouteHref(plain)).toBe(
      `${OBJECT_ROUTE}?${ADDRESS_PARAM}=${encodeURIComponent(theoremUri(plain))}`,
    );
    expect(OBJECT_ROUTE.startsWith('/commonplace/')).toBe(true);
  });

  it('round-trips tenant, kind and id', () => {
    expect(roundTrip(plain)).toEqual(plain);
  });

  it('round-trips a graph version pin and a span selector', () => {
    const pinned: TheoremAddress = {
      ...plain,
      graphVersion: 42,
      span: { start: 10, end: 24, exact: 'a quoted, span', prefix: 'before ' },
    };
    expect(roundTrip(pinned)).toEqual(pinned);
  });

  it('survives structural characters in the id', () => {
    const awkward: TheoremAddress = { ...plain, id: 'cr:memory/2026?v=1#x' };
    expect(roundTrip(awkward)).toEqual(awkward);
  });

  it('refuses a route with no address rather than throwing', () => {
    const parsed = addressFromRouteParams(new URLSearchParams());
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.refusal.code).toBe('malformed_address');
    expect(parsed.refusal.message).toContain(ADDRESS_PARAM);
  });

  it('passes a malformed address through to the shared parser refusal', () => {
    const raw = 'theorem://Travis-Gilbert/memory';
    const parsed = addressFromRouteParams(
      new URLSearchParams([[ADDRESS_PARAM, raw]]),
    );
    const direct = parseTheoremUri(raw);
    expect(parsed).toEqual(direct);
    expect(parsed.ok).toBe(false);
  });
});
