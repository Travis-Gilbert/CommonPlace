// SOURCING: none. Pure anchoring conversion, no upstream component applies.

/**
 * The seam where two anchoring models meet (SPEC F1).
 *
 * The find executor returns `FindHit.byteRange`: a byte offset pair into the
 * document's indexed text property. CommonPlace's in-page highlight primitive
 * (crates/commonplace-desktop-runtime/src/margin_recall.rs) anchors by
 * character-offset quote plus prefix/suffix context, because an external page's
 * DOM has no notion of the indexed text's byte layout. Neither side can adopt
 * the other's model: the index is byte-addressed by construction, and the
 * resolver runs inside a page it did not index.
 *
 * So the conversion happens here, once, in a pure function: derive the quote
 * from the matched bytes, the disambiguating context from the snippet the hit
 * already carries, and a character-offset position hint the resolver uses to
 * prefer the nearest occurrence.
 */

import type { ByteRange, FindHit } from '@commonplace/block-view-contracts/search-stack';

/**
 * A quote to resolve in a live page, wire-parity with the Rust `TextTarget`
 * (crates/commonplace-desktop-runtime/src/margin_recall.rs) and the desktop
 * contract doc (apps/desktop/src/lib/commands.ts).
 */
export interface TextTarget {
  quote: string;
  prefix?: string;
  suffix?: string;
  /** Character offset into the page text: prefer the occurrence nearest here. */
  positionHint?: number;
}

/** How much snippet context to carry on each side of the quote. */
const CONTEXT_CHARS = 32;

/**
 * Byte offset to character offset over a UTF-8 string. Returns the index of the
 * first character whose byte offset is at or past `byteOffset`, so a range that
 * splits a multi-byte character rounds outward to a whole character.
 */
export function byteOffsetToCharOffset(text: string, byteOffset: number): number {
  if (byteOffset <= 0) return 0;
  let bytes = 0;
  for (let index = 0; index < text.length; ) {
    if (bytes >= byteOffset) return index;
    const codePoint = text.codePointAt(index) as number;
    const width = codePoint > 0xffff ? 2 : 1;
    bytes += utf8Width(codePoint);
    index += width;
  }
  return text.length;
}

function utf8Width(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Byte length of a string under UTF-8, without allocating an encoder buffer. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index) as number;
    bytes += utf8Width(codePoint);
    index += codePoint > 0xffff ? 2 : 1;
  }
  return bytes;
}

/**
 * Slice the text the byte range names. `text` is the same indexed text property
 * the byte offsets address, so the slice is exact rather than approximate.
 */
export function sliceByteRange(text: string, range: ByteRange): string {
  const start = byteOffsetToCharOffset(text, range.start);
  const end = byteOffsetToCharOffset(text, range.end);
  return text.slice(start, Math.max(start, end));
}

export interface ByteRangeTargetOptions {
  /**
   * The document's indexed text, when the surface has it. This is the exact
   * path: the byte range slices straight out of the same string it addresses.
   */
  documentText?: string;
  /**
   * The query that produced the hit. Without the indexed text, this is what
   * locates the match INSIDE the snippet: an exact-lane hit's matched text is
   * the query itself, so its occurrence in the snippet is the quote and the
   * snippet around it is the prefix and suffix.
   */
  query?: string;
}

/**
 * Convert a located hit into an in-page text target.
 *
 * `prefix` and `suffix` are what raise the resolver's confidence from 0.8
 * (quote alone) to 1.0 (quote plus context), and `positionHint` is what makes a
 * page containing the same phrase many times resolve to the right occurrence.
 *
 * Three sources, in descending precision:
 *   1. the indexed text, sliced by the byte range (exact)
 *   2. the snippet, with the query locating the match inside it
 *   3. the snippet as a whole, when there is no literal match to point at
 *      (semantic and graph lanes match meaning, not characters, so the passage
 *      IS the anchor and a narrower quote would be invented rather than derived)
 *
 * Returns null when there is no quote to resolve. An empty range with no
 * snippet is an honest "nothing to highlight", not a target with an empty quote
 * that would match every text node in the page.
 */
export function byteRangeToTextTarget(
  hit: Pick<FindHit, 'byteRange' | 'snippet'>,
  options: ByteRangeTargetOptions | string = {},
): TextTarget | null {
  const { documentText, query } =
    typeof options === 'string' ? { documentText: options, query: undefined } : options;
  const { byteRange, snippet } = hit;

  if (documentText != null) {
    const quote = sliceByteRange(documentText, byteRange);
    if (!quote) return null;
    const startChar = byteOffsetToCharOffset(documentText, byteRange.start);
    return withContext(quote, documentText, startChar, startChar + quote.length, startChar);
  }

  if (!snippet) return null;
  // The byte range still carries the match's document offset, which is the hint
  // the resolver orders occurrences by. It is a byte offset rather than a
  // character offset, but the resolver treats the hint as a preference and picks
  // the nearest match to it, so byte-derived ordering is the right precision.
  const positionHint = byteRange.start;

  const located = query ? locateInSnippet(snippet, query) : null;
  if (located) {
    return withContext(
      snippet.slice(located.start, located.end),
      snippet,
      located.start,
      located.end,
      positionHint,
    );
  }

  const passage = snippet.trim();
  if (!passage) return null;
  return { quote: passage, positionHint };
}

/** A snippet split around its exact hit, for the F5 row's emphasis. */
export interface SnippetEmphasis {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

/**
 * Split a hit's snippet into the text before the match, the matched text, and
 * the text after it (SPEC F5's "snippet with exact-hit emphasis").
 *
 * This is the SAME offset machinery the in-page anchor uses, reused rather than
 * duplicated: when the indexed text is available the byte range slices the
 * literal match out of it, and `locateInSnippet` is the single place that maps a
 * needle onto snippet offsets. There is no second mapper.
 *
 * Returns null when nothing can be emphasized honestly, which is the correct
 * answer for a semantic or graph hit whose match is meaning rather than
 * characters. The row then renders the plain snippet.
 */
export function emphasizeSnippet(
  hit: Pick<FindHit, 'byteRange' | 'snippet'>,
  options: ByteRangeTargetOptions | string = {},
): SnippetEmphasis | null {
  const { documentText, query } =
    typeof options === 'string' ? { documentText: options, query: undefined } : options;
  const snippet = hit.snippet;
  if (!snippet) return null;

  // Exact bytes first, the typed query second. Both go through one locator.
  const sliced = documentText != null ? sliceByteRange(documentText, hit.byteRange).trim() : '';
  const needle = sliced || query?.trim() || '';
  if (!needle) return null;

  const located = locateInSnippet(snippet, needle);
  if (!located) return null;
  return {
    before: snippet.slice(0, located.start),
    match: snippet.slice(located.start, located.end),
    after: snippet.slice(located.end),
  };
}

/**
 * Find the query inside the snippet, case-insensitively, returning the SNIPPET's
 * own casing so the quote is literal page text rather than the typed query.
 * Falls back to the longest query term when the whole phrase is not present,
 * which is what a multi-word query matched by one of its terms looks like.
 */
function locateInSnippet(
  snippet: string,
  query: string,
): { start: number; end: number } | null {
  const candidates = [query.trim(), ...query.trim().split(/\s+/).sort((a, b) => b.length - a.length)];
  const haystack = snippet.toLowerCase();
  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = haystack.indexOf(candidate.toLowerCase());
    if (start >= 0) return { start, end: start + candidate.length };
  }
  return null;
}

function withContext(
  quote: string,
  source: string,
  start: number,
  end: number,
  positionHint: number,
): TextTarget {
  const prefix = source.slice(Math.max(0, start - CONTEXT_CHARS), start);
  const suffix = source.slice(end, end + CONTEXT_CHARS);
  const target: TextTarget = { quote, positionHint };
  if (prefix) target.prefix = prefix;
  if (suffix) target.suffix = suffix;
  return target;
}
