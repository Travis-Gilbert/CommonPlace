// SOURCING: @commonplace/block-view/addressing (theoremUri, parseTheoremUri).
// The grammar is not re-implemented here; this module only maps an already
// parsed address onto the console shell's object route and back.

import {
  parseTheoremUri,
  theoremUri,
  type ParsedAddress,
  type TheoremAddress,
} from '@commonplace/block-view/addressing';

/**
 * The console shell route that renders an addressed object
 * (DESIGN-THEOREM-URI section 3, the acceptor side).
 */
export const OBJECT_ROUTE = '/commonplace/object';

/** The query key carrying the address. */
export const ADDRESS_PARAM = 'address';

/**
 * Route URL for an address.
 *
 * The whole `theorem://` URI travels as one percent-encoded query value rather
 * than being split into id/kind/version/span params. Re-rendering the address
 * through `theoremUri` and re-parsing it on arrival means the route carries the
 * graph version pin and the span selector without this module knowing what
 * either means, and the address in the URL bar is the address the user copied.
 */
export function objectRouteHref(address: TheoremAddress): string {
  return `${OBJECT_ROUTE}?${ADDRESS_PARAM}=${encodeURIComponent(theoremUri(address))}`;
}

/**
 * Read the address back out of the route's search params.
 *
 * Returns the same discriminated union `parseTheoremUri` returns, so a missing
 * param and a malformed one are both absences with reasons rather than throws.
 */
export function addressFromRouteParams(params: URLSearchParams): ParsedAddress {
  const raw = params.get(ADDRESS_PARAM);
  if (raw === null || raw.trim() === '') {
    return {
      ok: false,
      refusal: {
        code: 'malformed_address',
        message:
          'address resolution failed; failing step: malformed_address - ' +
          `${OBJECT_ROUTE} needs an ${ADDRESS_PARAM}= query carrying a theorem:// address`,
      },
    };
  }
  return parseTheoremUri(raw.trim());
}
