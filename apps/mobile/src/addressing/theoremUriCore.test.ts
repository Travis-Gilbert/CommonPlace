import { describe, expect, it } from 'vitest';

import {
  checkSpanBounds,
  extractTheoremAddress,
  looksLikeTheoremAddress,
  parseTheoremUri,
  routeForTheoremUri,
  theoremUri,
  type SpanSelector,
} from './theoremUriCore';

const SPAN: SpanSelector = {
  start: 120,
  end: 138,
  exact: 'addresses name, sessions grant',
  prefix: 'the rule is ',
  suffix: ' — see section 4',
};

describe('theorem URI grammar', () => {
  it('emits the exact tenant, kind, id, graph version, and span address', () => {
    expect(
      theoremUri({
        tenant: 'Travis-Gilbert',
        kind: 'doc',
        id: 'memory/one',
        graphVersion: 42,
        span: { start: 3, end: 11, exact: 'paragraph' },
      }),
    ).toBe('theorem://Travis-Gilbert/doc/memory%2Fone?v=42#span=start=3,end=11,exact=paragraph');
  });

  // These two vectors are asserted byte-for-byte by the Rust emitter in
  // rustyredcore_THG/crates/rustyred-thg-mcp/src/addressing.rs. If either side
  // drifts, one of the two suites fails.
  it('matches the engine emitter byte-for-byte on colon-bearing ids', () => {
    expect(
      theoremUri({ tenant: 'Travis-Gilbert', kind: 'memory', id: 'mem:decisions:abc123' }),
    ).toBe('theorem://Travis-Gilbert/memory/mem%3Adecisions%3Aabc123');
  });

  it('matches the engine emitter byte-for-byte on slash-bearing ids', () => {
    expect(theoremUri({ tenant: 't', kind: 'memory', id: 'memory/one' })).toBe(
      'theorem://t/memory/memory%2Fone',
    );
  });

  it('round-trips a fully loaded address', () => {
    const address = {
      tenant: 'Travis-Gilbert',
      kind: 'doc',
      id: 'doc:1/a',
      graphVersion: 7,
      span: SPAN,
    };
    const parsed = parseTheoremUri(theoremUri(address));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.address).toEqual(address);
  });

  it('preserves tenant casing', () => {
    const parsed = parseTheoremUri('theorem://Travis-Gilbert/memory/abc');
    expect(parsed.ok && parsed.address.tenant).toBe('Travis-Gilbert');
  });

  it('keeps quotes containing grammar separators intact', () => {
    const span: SpanSelector = { start: 0, end: 5, exact: 'a=b,c#d?e/f&g' };
    const parsed = parseTheoremUri(theoremUri({ tenant: 't', kind: 'doc', id: 'd1', span }));
    expect(parsed.ok && parsed.address.span).toEqual(span);
  });

  it('treats a query without v= as unpinned rather than malformed', () => {
    // `depth=` is a legitimate query key the engine reads; an address carrying
    // only a read preference is unpinned, not invalid.
    const parsed = parseTheoremUri('theorem://t/doc/d1?depth=full');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.address.graphVersion).toBeUndefined();
  });

  it('tolerates unknown span fields from a newer emitter', () => {
    const parsed = parseTheoremUri('theorem://t/doc/d1#span=start=1,end=2,exact=a,future=zz');
    expect(parsed.ok && parsed.address.span?.exact).toBe('a');
  });

  it.each([
    ['wrong scheme', 'rustyred_thg://tenant/t/node/a'],
    ['raw slash in path', 'theorem://t/memory/a/b'],
    ['missing id', 'theorem://t/memory'],
    ['fragment without the span key', 'theorem://t/doc/d1#paragraph%202'],
    ['non-numeric version', 'theorem://t/doc/d1?v=head'],
    ['span end before start', 'theorem://t/doc/d1#span=start=10,end=4,exact=x'],
    ['span missing an offset', 'theorem://t/doc/d1#span=start=10,exact=x'],
  ])('refuses %s rather than throwing', (_label, uri) => {
    const parsed = parseTheoremUri(uri);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.refusal.code).toBe('malformed_address');
  });

  it('bounds-checks spans against content length', () => {
    expect(checkSpanBounds(SPAN, 200)).toBeUndefined();
    expect(checkSpanBounds(SPAN, 12)?.code).toBe('span_out_of_range');
  });
});

describe('accepting a pasted address', () => {
  it('sniffs addresses cheaply, tolerating leading whitespace', () => {
    expect(looksLikeTheoremAddress('  theorem://t/doc/d1')).toBe(true);
    expect(looksLikeTheoremAddress('https://example.com')).toBe(false);
  });

  it('finds the address inside share-sheet text', () => {
    // shareObject() in the object drawer shares "<title>\n<url>".
    const shared = 'Field survey, Q3 2024\ntheorem://Travis-Gilbert/doc/doc-1?v=9';
    expect(extractTheoremAddress(shared)).toEqual({
      tenant: 'Travis-Gilbert',
      kind: 'doc',
      id: 'doc-1',
      graphVersion: 9,
    });
  });

  it('returns nothing when the text carries no address', () => {
    expect(extractTheoremAddress('just some notes')).toBeUndefined();
  });
});

describe('expo-router mapping', () => {
  it('routes proposals to deliberate review and other objects to the object drawer', () => {
    expect(routeForTheoremUri('theorem://tenant/agency.proposal/proposal-1')).toBe(
      '/proposal/proposal-1',
    );
    expect(routeForTheoremUri('theorem://tenant/doc/memory%2Fone')).toBe('/object/memory%2Fone');
  });

  it('routes shared thread addresses to the assistant-ui thread surface', () => {
    expect(routeForTheoremUri('theorem://tenant/chat.thread/thread%2Fone')).toBe(
      '/thread/thread%2Fone',
    );
  });

  it('carries the version pin onto the route so a pinned link still opens pinned', () => {
    expect(routeForTheoremUri('theorem://tenant/doc/memory%2Fone?v=42')).toBe(
      '/object/memory%2Fone?v=42',
    );
  });

  it('carries the span onto the route so a shared clipping opens at its span', () => {
    expect(routeForTheoremUri('theorem://tenant/doc/d1#span=start=1,end=4,exact=abc')).toBe(
      '/object/d1?span=start%3D1%2Cend%3D4%2Cexact%3Dabc',
    );
  });

  it('does not rewrite ordinary application routes', () => {
    expect(routeForTheoremUri('/reader/doc-1')).toBe('/reader/doc-1');
  });

  it('falls back to the root on an unparseable address instead of throwing', () => {
    expect(routeForTheoremUri('theorem://')).toBe('/');
  });
});
