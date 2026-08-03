// SOURCING: @noble/hashes, already present in this workspace. blake3 is not
// hand-rolled here; the library is the audited implementation and this file is
// only the framing the server's ContentHash uses.
/**
 * The client side of `ContentHash`.
 *
 * `rustyred-thg-vfs` formats content identity as `blake3:<hex>`
 * (`ContentHash::of` in `crates/rustyred-thg-vfs/src/lib.rs`), and the editor
 * surface's optimistic-concurrency arguments are that exact string.
 *
 * A consumer does not usually need this. For *files* the read payloads carry
 * `content`, so comparing the returned text to the buffer settles identity by
 * string equality — cheaper and exact. See `editor-offsets.ts`.
 *
 * Items are the exception, and the reason this file exists. `writeItemBody`
 * compares its `baseContentHash` argument against `ContentHash::of(text)` for
 * an inline body, but `ItemGql` publishes `bodyText` and `blobHash` and no hash
 * of the inline text. Without computing it the write is unreachable for exactly
 * the graph documents V5 opens. `blobHash` already is the content hash for a
 * blob-backed body, so only the inline and empty cases come through here.
 */

import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';
import type { ContentHash } from './editor-intelligence';

/** `blake3:<hex>` of the UTF-8 encoding of `text`, matching `ContentHash::of`. */
export function contentHashOf(text: string): ContentHash {
  return `blake3:${bytesToHex(blake3(new TextEncoder().encode(text)))}`;
}

/**
 * The `baseContentHash` to send when writing an item body.
 *
 * Mirrors the server's three-way match on `ItemBody`: a blob-backed body is
 * identified by the blob hash it already publishes, an inline body by the hash
 * of its text, and an absent body by the hash of the empty string — which is
 * what `ContentHash::of(b"")` produces, not an empty or omitted value.
 */
export function itemBaseContentHash(item: {
  readonly bodyText?: string | null;
  readonly blobHash?: string | null;
}): ContentHash {
  return item.blobHash ?? contentHashOf(item.bodyText ?? '');
}
