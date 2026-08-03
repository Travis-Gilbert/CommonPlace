// SOURCING: none. Offset arithmetic over the EDITOR-DX wire; no upstream
// component maps UTF-8 byte spans onto UTF-16 hosts.
/**
 * UTF-8 byte offsets to UTF-16 code units, and the identity check that has to
 * come first.
 *
 * The editor surface measures every span — tokens, diagnostics, intentions,
 * inlay hints, fix edits — as a UTF-8 byte offset into the bytes it indexed.
 * Both consumers of that surface address text in UTF-16 code units: VS Code
 * `Position`s are UTF-16, CodeMirror 6 offsets are UTF-16. The two agree
 * exactly while the file is ASCII and diverge on the first byte that is not,
 * which is why every non-trivial file eventually lands findings on the wrong
 * characters unless something converts.
 *
 * Converting needs the *exact bytes the server measured*, not bytes that
 * resemble them. A payload carries `contentHash` to identify those bytes and,
 * when asked, `content` to supply them. Comparing the returned `content` to the
 * buffer the user is looking at is both the conversion basis and the drift
 * detector, so no hash implementation has to ship in the client to be honest
 * about divergence.
 *
 * Silence is the failure mode this file exists to prevent: a stale span renders
 * as a squiggle under the wrong word with nothing to tell the reader it moved.
 */

import type { ByteOffset, ContentHash } from './editor-intelligence';

/**
 * Byte-to-UTF-16 index for one exact document.
 *
 * `byteAtUtf16[i]` is the UTF-8 byte offset where UTF-16 index `i` begins, with
 * one trailing entry for the end of the document. The array is non-decreasing,
 * which is what makes the reverse lookup a binary search.
 */
export interface OffsetTable {
  readonly contentHash: ContentHash;
  readonly content: string;
  readonly byteLength: number;
  readonly utf16Length: number;
  readonly byteAtUtf16: Uint32Array;
}

/** A converted span, in the UTF-16 code units both hosts speak. */
export interface Utf16Span {
  readonly start: number;
  readonly end: number;
}

const CONTINUATION_MAX = 0x7f;
const TWO_BYTE_MAX = 0x7ff;
const THREE_BYTE_MAX = 0xffff;

/** UTF-8 byte length of one code point. */
function utf8Width(codePoint: number): number {
  if (codePoint <= CONTINUATION_MAX) return 1;
  if (codePoint <= TWO_BYTE_MAX) return 2;
  if (codePoint <= THREE_BYTE_MAX) return 3;
  return 4;
}

/** UTF-8 byte length of a string, without allocating the encoded bytes. */
export function utf8Length(content: string): number {
  let bytes = 0;
  for (let i = 0; i < content.length; ) {
    const codePoint = content.codePointAt(i) as number;
    const width = utf8Width(codePoint);
    bytes += width;
    i += width === 4 ? 2 : 1;
  }
  return bytes;
}

/**
 * Build the index for one document. Costs one pass and four bytes per UTF-16
 * unit, paid once per generation rather than once per span.
 */
export function buildOffsetTable(content: string, contentHash: ContentHash): OffsetTable {
  const utf16Length = content.length;
  const byteAtUtf16 = new Uint32Array(utf16Length + 1);
  let byte = 0;
  let i = 0;
  while (i < utf16Length) {
    byteAtUtf16[i] = byte;
    const codePoint = content.codePointAt(i) as number;
    const width = utf8Width(codePoint);
    if (width === 4) {
      // The low surrogate is not addressable on its own. Mapping it to the end
      // of the pair keeps the array non-decreasing for the binary search.
      byteAtUtf16[i + 1] = byte + 4;
      i += 2;
    } else {
      i += 1;
    }
    byte += width;
  }
  byteAtUtf16[utf16Length] = byte;
  return { contentHash, content, byteLength: byte, utf16Length, byteAtUtf16 };
}

/**
 * Read one entry of the index.
 *
 * `noUncheckedIndexedAccess` widens typed-array reads to `| undefined`, which a
 * `Uint32Array` never returns for an in-range index. Every call site below
 * bounds its index first, so the fallback is unreachable rather than a guess.
 */
function byteAt(table: OffsetTable, index: number): number {
  return table.byteAtUtf16[index] ?? 0;
}

/**
 * UTF-8 byte offset to UTF-16 index.
 *
 * Offsets past the end clamp to the end. An offset landing inside a multi-byte
 * character clamps to that character's start, so a span can never split a
 * character and produce a lone surrogate.
 */
export function byteToUtf16(table: OffsetTable, byte: ByteOffset): number {
  if (!Number.isFinite(byte) || byte <= 0) return 0;
  if (byte >= table.byteLength) return table.utf16Length;
  let low = 0;
  let high = table.utf16Length;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (byteAt(table, mid) <= byte) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** UTF-16 index to UTF-8 byte offset. The direction writes travel. */
export function utf16ToByte(table: OffsetTable, index: number): ByteOffset {
  if (!Number.isFinite(index) || index <= 0) return 0;
  if (index >= table.utf16Length) return table.byteLength;
  return byteAt(table, index);
}

/** Convert one wire span. Reversed spans are normalized rather than dropped. */
export function toUtf16Span(table: OffsetTable, startByte: ByteOffset, endByte: ByteOffset): Utf16Span {
  const start = byteToUtf16(table, startByte);
  const end = byteToUtf16(table, endByte);
  return start <= end ? { start, end } : { start: end, end: start };
}

/**
 * Why a payload's spans cannot be trusted against the buffer in front of the
 * reader. `null` means they can.
 */
export type ContentDrift =
  | { readonly kind: 'content_absent'; readonly contentHash: ContentHash }
  | {
    readonly kind: 'buffer_diverged';
    readonly contentHash: ContentHash;
    readonly serverLength: number;
    readonly bufferLength: number;
  };

/**
 * Decide whether a payload's byte spans may be rendered onto `bufferText`.
 *
 * Returns an `OffsetTable` when the server's indexed bytes and the buffer agree
 * exactly, and a `ContentDrift` otherwise. The comparison is a string equality
 * against the `content` the payload carried: exact, cheap, and free of any
 * hashing the client would otherwise have to implement to match the server's
 * blake3.
 *
 * A consumer that gets drift back must drop the spans. Rendering them anyway is
 * the silent-misplacement failure; dropping them and saying so is the honest
 * degradation the surface is built around.
 */
export function resolveOffsets(
  payload: { readonly contentHash: ContentHash; readonly content?: string | null },
  bufferText: string,
): { readonly table: OffsetTable; readonly drift: null } | { readonly table: null; readonly drift: ContentDrift } {
  const { content, contentHash } = payload;
  if (typeof content !== 'string') {
    return { table: null, drift: { kind: 'content_absent', contentHash } };
  }
  if (content !== bufferText) {
    return {
      table: null,
      drift: {
        kind: 'buffer_diverged',
        contentHash,
        serverLength: content.length,
        bufferLength: bufferText.length,
      },
    };
  }
  return { table: buildOffsetTable(content, contentHash), drift: null };
}
