// SOURCING: @commonplace/block-view/addressing. The theorem:// grammar is the
// shared client helper the design brief names; this file keeps only the
// expo-router mapping, which is platform routing and not part of the contract.
/**
 * Mobile's view of `theorem://` addresses (DESIGN-THEOREM-URI).
 *
 * The grammar (emit, parse, span selectors, refusals) lives in
 * `@commonplace/block-view/addressing` so the engine, the console, the desktop
 * shell, and this app all agree byte-for-byte. What stays here is the one
 * mobile-specific concern: which expo-router screen a given kind opens.
 */

import {
  encodeSpanSelector,
  parseTheoremUri,
  type TheoremAddress,
} from '@commonplace/block-view/addressing';

export {
  checkSpanBounds,
  encodeSpanSelector,
  extractTheoremAddress,
  looksLikeTheoremAddress,
  parseSpanSelector,
  parseTheoremUri,
  theoremUri,
  THEOREM_SCHEME,
  type AddressRefusal,
  type AddressRefusalCode,
  type ParsedAddress,
  type SpanSelector,
  type TheoremAddress,
} from '@commonplace/block-view/addressing';

/**
 * Map a `theorem://` address onto the expo-router path that opens it.
 *
 * Non-addresses pass through untouched so this can sit directly under
 * `redirectSystemPath` without the caller sniffing first. An address that
 * cannot be parsed falls back to the root rather than throwing, because this
 * runs on cold-start intent handling where an exception is a crash.
 *
 * The version pin and span selector are carried onto the route as query
 * parameters. Dropping them would make a deep link lie: `?v=` and `#span=` are
 * part of what the address means, so a shared clipping must still open at its
 * span.
 */
export function routeForTheoremUri(path: string): string {
  if (!path.toLowerCase().startsWith('theorem:')) return path;
  const parsed = parseTheoremUri(path);
  if (!parsed.ok) return '/';
  return routeForAddress(parsed.address);
}

function routeForAddress(address: TheoremAddress): string {
  const id = encodeURIComponent(address.id);
  const base =
    address.kind === 'proposal' || address.kind === 'agency.proposal'
      ? `/proposal/${id}`
      : address.kind === 'thread' || address.kind === 'chat.thread'
        ? `/thread/${id}`
        : `/object/${id}`;

  const query: string[] = [];
  if (address.graphVersion !== undefined) query.push(`v=${address.graphVersion}`);
  if (address.span) query.push(`span=${encodeURIComponent(encodeSpanSelector(address.span))}`);
  return query.length === 0 ? base : `${base}?${query.join('&')}`;
}
