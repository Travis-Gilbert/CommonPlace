// SOURCING: none. Pure string grammar mirroring the Rust emitter in
// rustyredcore_THG/crates/rustyred-thg-mcp/src/addressing.rs; no upstream URI
// library applies because the contract is byte-for-byte parity with that
// module, and WHATWG `new URL()` treats `theorem:` as a non-special scheme
// (tenant lands in `host`, not `pathname`), which silently drops the tenant.
/**
 * `theorem://` canonical addresses (DESIGN-THEOREM-URI, ratified 2026-07-17).
 *
 * The one client helper the design brief asks for. Every object in the graph
 * has one address that works everywhere a person or an agent can point:
 *
 *     theorem://{tenant}/{kind}/{id}
 *     theorem://{tenant}/{kind}/{id}?v={graph_version}
 *     theorem://{tenant}/{kind}/{id}#span={selector}
 *
 * Invariants carried from the brief:
 *
 * 1. Identity lives in the id. `kind` is routing sugar and human legibility;
 *    resolution authority is the id, so `kind` is not validated here.
 * 2. Addresses name; they never grant. Nothing here reads data or resolves a
 *    principal — the engine reconciles the addressed tenant against the
 *    admitted principal and refuses `tenant_mismatch`.
 * 3. Refusals are absences with reasons, so `parseTheoremUri` returns a
 *    discriminated union rather than throwing. Paste handlers run on every
 *    paste; a malformed clipboard should not be an exception.
 *
 * Percent-encoding uses `encodeURIComponent`, which the Rust side matches
 * exactly (alphanumerics plus `-_.!~*'()` left unescaped), so an address minted
 * on a phone and an address minted in the engine compare equal as strings.
 */

/** The URI scheme, including the `://` separator. */
export const THEOREM_SCHEME = 'theorem://';

/** The fragment key that introduces a span selector, per the grammar. */
const SPAN_FRAGMENT_KEY = 'span=';

/**
 * A selector into an object's content: the fragment the Survey and
 * margin-recall need. A shareable clipping is a URI with a span.
 *
 * Field-for-field the shape the margin store persists (`Anchor.text_quote`)
 * and the salience span record mints (`SalienceAnchor` = quote + position):
 * start and end offsets plus a short anchoring quote for drift resilience.
 */
export type SpanSelector = {
  /** Start offset, inclusive. */
  readonly start: number;
  /** End offset, exclusive. */
  readonly end: number;
  /** The quoted text at `start..end` when the span was minted. */
  readonly exact: string;
  /** Up to a few characters of context immediately before `exact`. */
  readonly prefix?: string;
  /** Up to a few characters of context immediately after `exact`. */
  readonly suffix?: string;
};

/** A parsed `theorem://` address. */
export type TheoremAddress = {
  /** Tenant slug, exact casing (`Travis-Gilbert`). A name, never a grant. */
  readonly tenant: string;
  /** The object's kind. Routing sugar; the id is the resolution authority. */
  readonly kind: string;
  /** The graph id. Identity lives here. */
  readonly id: string;
  /** Optional pin to a compiled graph version. Unpinned resolves to current. */
  readonly graphVersion?: number;
  /** Optional selector into the object's content. */
  readonly span?: SpanSelector;
};

/** Stable machine-readable refusal reasons, matching the Rust `AddressRefusal`. */
export type AddressRefusalCode =
  | 'malformed_address'
  | 'unknown_id'
  | 'tenant_mismatch'
  | 'version_not_compiled'
  | 'span_out_of_range';

/** A refusal to resolve an address: an absence with a reason. */
export type AddressRefusal = {
  readonly code: AddressRefusalCode;
  readonly message: string;
};

export type ParsedAddress =
  | { readonly ok: true; readonly address: TheoremAddress }
  | { readonly ok: false; readonly refusal: AddressRefusal };

function malformed(detail: string): AddressRefusal {
  return {
    code: 'malformed_address',
    message: `address resolution failed; failing step: malformed_address - ${detail}`,
  };
}

/**
 * Render the selector as the URI fragment body (everything after `#span=`).
 *
 * Comma-separated `key=value` pairs, values percent-encoded. `encodeURIComponent`
 * escapes both `,` and `=`, so a quote containing the structural characters
 * cannot break the grammar.
 */
export function encodeSpanSelector(span: SpanSelector): string {
  const parts = [
    `start=${span.start}`,
    `end=${span.end}`,
    `exact=${encodeURIComponent(span.exact)}`,
  ];
  if (span.prefix !== undefined) parts.push(`prefix=${encodeURIComponent(span.prefix)}`);
  if (span.suffix !== undefined) parts.push(`suffix=${encodeURIComponent(span.suffix)}`);
  return parts.join(',');
}

function parseOffset(value: string, field: string): number | AddressRefusal {
  if (!/^\d+$/.test(value)) {
    return malformed(`span selector ${field} "${value}" is not an offset`);
  }
  return Number.parseInt(value, 10);
}

function isRefusal(value: unknown): value is AddressRefusal {
  return typeof value === 'object' && value !== null && 'code' in value;
}

/** Parse the fragment body (everything after `#span=`). */
export function parseSpanSelector(raw: string): SpanSelector | AddressRefusal {
  let start: number | undefined;
  let end: number | undefined;
  let exact = '';
  let prefix: string | undefined;
  let suffix: string | undefined;

  for (const pair of raw.split(',')) {
    if (pair === '') continue;
    const separator = pair.indexOf('=');
    if (separator < 0) return malformed(`span selector field "${pair}" is not key=value`);
    const key = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    switch (key) {
      case 'start': {
        const parsed = parseOffset(value, 'start');
        if (isRefusal(parsed)) return parsed;
        start = parsed;
        break;
      }
      case 'end': {
        const parsed = parseOffset(value, 'end');
        if (isRefusal(parsed)) return parsed;
        end = parsed;
        break;
      }
      case 'exact':
        exact = decodeURIComponent(value);
        break;
      case 'prefix':
        prefix = decodeURIComponent(value);
        break;
      case 'suffix':
        suffix = decodeURIComponent(value);
        break;
      // Unknown keys are ignored so a newer emitter can add fields without
      // breaking an older resolver.
      default:
        break;
    }
  }

  if (start === undefined || end === undefined) {
    return malformed('span selector requires both start and end offsets');
  }
  if (end < start) {
    return malformed(`span selector end ${end} precedes start ${start}`);
  }
  return { start, end, exact, ...(prefix !== undefined ? { prefix } : {}), ...(suffix !== undefined ? { suffix } : {}) };
}

/**
 * Check a span against the length of the content it addresses. This is the
 * `span out of range` refusal the brief names — a bounds check only; quote
 * drift is a re-anchoring concern owned by the margin store.
 */
export function checkSpanBounds(span: SpanSelector, contentLength: number): AddressRefusal | undefined {
  if (span.end > contentLength) {
    return {
      code: 'span_out_of_range',
      message:
        `address resolution failed; failing step: span_out_of_range - span ${span.start}..${span.end} ` +
        `reaches past the addressed content, which is ${contentLength} characters`,
    };
  }
  return undefined;
}

/** Render an address. */
export function theoremUri(address: TheoremAddress): string {
  const base =
    `${THEOREM_SCHEME}${encodeURIComponent(address.tenant)}` +
    `/${encodeURIComponent(address.kind)}` +
    `/${encodeURIComponent(address.id)}`;
  const query = address.graphVersion === undefined ? '' : `?v=${address.graphVersion}`;
  const fragment = address.span ? `#${SPAN_FRAGMENT_KEY}${encodeSpanSelector(address.span)}` : '';
  return `${base}${query}${fragment}`;
}

/**
 * Read the optional `v=` graph version off a query string.
 *
 * A query that carries no `v=` is unpinned, not malformed: `depth=` is a
 * legitimate query key, and forward-compatible keys may join it.
 */
function parseQuery(query: string): number | undefined | AddressRefusal {
  let version: number | undefined;
  for (const pair of query.split('&')) {
    if (pair === '') continue;
    const separator = pair.indexOf('=');
    if (separator < 0) return malformed(`query field "${pair}" is not key=value`);
    const key = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (key === 'v') {
      if (!/^\d+$/.test(value)) {
        return malformed(`graph version "${value}" is not a version number`);
      }
      version = Number.parseInt(value, 10);
    }
    // Unknown query keys are ignored for forward compatibility.
  }
  return version;
}

/**
 * Parse an address.
 *
 * Every segment is percent-decoded exactly once. Graph ids routinely contain
 * `:` and sometimes `/`, so the encoded form is what makes the three-segment
 * path unambiguous — a raw `/` in the path is a malformed address, not a
 * fourth segment.
 */
export function parseTheoremUri(uri: string): ParsedAddress {
  if (!uri.startsWith(THEOREM_SCHEME)) {
    return { ok: false, refusal: malformed(`address must start with ${THEOREM_SCHEME}`) };
  }
  let rest = uri.slice(THEOREM_SCHEME.length);

  let fragment: string | undefined;
  const hash = rest.indexOf('#');
  if (hash >= 0) {
    fragment = rest.slice(hash + 1);
    rest = rest.slice(0, hash);
  }

  let query: string | undefined;
  const question = rest.indexOf('?');
  if (question >= 0) {
    query = rest.slice(question + 1);
    rest = rest.slice(0, question);
  }

  const segments = rest.split('/');
  if (segments.length > 3) {
    return {
      ok: false,
      refusal: malformed("address has more than three path segments; encode '/' in the id as %2F"),
    };
  }
  const [tenant, kind, id] = segments;
  if (!tenant) return { ok: false, refusal: malformed('address is missing tenant') };
  if (!kind) return { ok: false, refusal: malformed('address is missing kind') };
  if (!id) return { ok: false, refusal: malformed('address is missing id') };

  let graphVersion: number | undefined;
  if (query !== undefined) {
    const parsed = parseQuery(query);
    if (isRefusal(parsed)) return { ok: false, refusal: parsed };
    graphVersion = parsed;
  }

  let span: SpanSelector | undefined;
  if (fragment !== undefined && fragment !== '') {
    if (!fragment.startsWith(SPAN_FRAGMENT_KEY)) {
      return { ok: false, refusal: malformed('address fragment must be #span={selector}') };
    }
    const parsed = parseSpanSelector(fragment.slice(SPAN_FRAGMENT_KEY.length));
    if (isRefusal(parsed)) return { ok: false, refusal: parsed };
    span = parsed;
  }

  return {
    ok: true,
    address: {
      tenant: decodeURIComponent(tenant),
      kind: decodeURIComponent(kind),
      id: decodeURIComponent(id),
      ...(graphVersion !== undefined ? { graphVersion } : {}),
      ...(span !== undefined ? { span } : {}),
    },
  };
}

/**
 * True when `value` looks like a `theorem://` address. Cheap enough for a paste
 * handler to call on every paste.
 */
export function looksLikeTheoremAddress(value: string): boolean {
  return value.trimStart().startsWith(THEOREM_SCHEME);
}

/**
 * Pull the first `theorem://` address out of arbitrary pasted text.
 *
 * Share sheets wrap an address in a title and a newline (`shareObject` in the
 * mobile object drawer does exactly that), so accepting a paste means finding
 * the address inside the noise rather than demanding a bare URI.
 */
export function extractTheoremAddress(text: string): TheoremAddress | undefined {
  for (const token of text.split(/\s+/)) {
    if (!looksLikeTheoremAddress(token)) continue;
    const parsed = parseTheoremUri(token.trim());
    if (parsed.ok) return parsed.address;
  }
  return undefined;
}
