// SOURCING: vscode FileSystemProvider API over the existing commonplace-api
// item seam. No third-party virtual filesystem library applies.
/**
 * V5. `theorem://` documents.
 *
 * Graph items — specs, records, plan documents — open as editable buffers and
 * save through `writeItemBody`, which returns a retrievable receipt.
 *
 * Named choice 7 draws the line this file must not cross: repos stay on the
 * real filesystem, where the watcher already feeds the VFS journal. This
 * provider is for graph-native documents only. A checkout never appears behind
 * `theorem://`, so there is no second write path to the same bytes.
 *
 * URI shape: `theorem://item/<itemId>[.<ext>]`. The authority names the seam
 * collection and the path names the item; the extension is cosmetic and exists
 * so VS Code picks a language mode.
 *
 * **Writes are optimistic-concurrency controlled.** Every save carries the hash
 * of the body it was based on, and the server refuses rather than overwrite
 * when the item moved. A refusal is a value, not an exception, and the correct
 * response to one is specific: re-read and re-offer. Throwing a generic error
 * would leave VS Code saying "could not save" over a store that is behaving
 * exactly as designed.
 */

import * as vscode from 'vscode';
import type {
  ConcurrencyRefusal,
  ItemWriteReceipt,
  ItemWriteResult,
} from '@commonplace/block-view-contracts/editor-intelligence';
import {
  ITEM_QUERY,
  PUT_NOTE_MUTATION,
  WRITE_ITEM_BODY_MUTATION,
  isConcurrencyRefusal,
} from '@commonplace/block-view-contracts/editor-intelligence';
import { itemBaseContentHash } from '@commonplace/block-view-contracts/editor-content-hash';
import type { SubstrateClient } from '../substrate/client';

export const THEOREM_SCHEME = 'theorem';

/** The fields `ITEM_QUERY` selects. */
export interface GraphItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly bodyText?: string | null;
  readonly blobHash?: string | null;
  readonly mime?: string | null;
  readonly updatedAtMs: number;
}

interface ItemData {
  readonly item: GraphItem | null;
}

interface WriteItemData {
  readonly writeItemBody: ItemWriteResult | null;
}

/** `theorem://item/spec-123.md` -> `spec-123`. */
export function itemIdFromUri(uri: vscode.Uri): string {
  const path = uri.path.replace(/^\/+/, '');
  const lastDot = path.lastIndexOf('.');
  return lastDot > 0 ? path.slice(0, lastDot) : path;
}

export class TheoremFileSystemProvider implements vscode.FileSystemProvider {
  private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

  /** Receipts by item id, so a caller can prove a save landed. */
  private readonly receipts = new Map<string, ItemWriteReceipt>();

  /**
   * The body each open document was read at, keyed by item id.
   *
   * This is the base a write declares. Hashing the *outgoing* buffer instead
   * would defeat the check entirely: it would always match itself, and every
   * save would clobber whatever landed in between.
   */
  private readonly bases = new Map<string, string>();

  constructor(private readonly client: SubstrateClient) {}

  receiptFor(itemId: string): ItemWriteReceipt | undefined {
    return this.receipts.get(itemId);
  }

  watch(): vscode.Disposable {
    // The invalidation door already drives re-reads through the V1 client; a
    // per-file watch would be a second, weaker copy of that push path.
    return new vscode.Disposable(() => undefined);
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const item = await this.read(uri);
    const text = item.bodyText ?? '';
    return {
      type: vscode.FileType.File,
      ctime: item.updatedAtMs,
      mtime: item.updatedAtMs,
      size: Buffer.byteLength(text, 'utf8'),
    };
  }

  readDirectory(): [string, vscode.FileType][] {
    // Graph items are addressed, not browsed. Quick open and the graph views
    // are the way in; a synthetic directory listing would invite a full-store
    // enumeration this seam has no page contract for.
    throw vscode.FileSystemError.NoPermissions('theorem:// is not browsable');
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('theorem:// has no directories');
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const item = await this.read(uri);
    return Buffer.from(item.bodyText ?? '', 'utf8');
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const itemId = itemIdFromUri(uri);
    const baseContentHash = this.bases.get(itemId);
    if (baseContentHash === undefined) {
      // Writing an item this session never read means there is no base to
      // declare, and a write with no base is the overwrite this seam refuses
      // by design. Read first.
      throw vscode.FileSystemError.Unavailable(
        'this document was not read in this session, so its base revision is unknown',
      );
    }

    const result = await this.client.query<WriteItemData>(WRITE_ITEM_BODY_MUTATION, {
      id: itemId,
      text: Buffer.from(content).toString('utf8'),
      baseContentHash,
    });

    if (!result.ok) {
      // A severed seam fails the save. VS Code keeps the buffer dirty and says
      // so, which is the honest state; silently accepting the write would leave
      // a clean-looking editor over a store that never received it.
      throw vscode.FileSystemError.Unavailable(
        result.degradation.detail ?? 'the item seam is unavailable',
      );
    }

    const outcome = result.data.writeItemBody;
    if (!outcome) {
      throw vscode.FileSystemError.Unavailable('the item seam returned no receipt');
    }

    if (isConcurrencyRefusal(outcome)) {
      throw refusalError(outcome);
    }

    this.receipts.set(itemId, outcome);
    // The write landed, so the next save's base is the body just stored.
    this.bases.set(itemId, outcome.contentHash);
    this.onDidChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  delete(): void {
    throw vscode.FileSystemError.NoPermissions('graph items are retracted, not deleted');
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('graph items are addressed by id');
  }

  private async read(uri: vscode.Uri): Promise<GraphItem> {
    const itemId = itemIdFromUri(uri);
    const result = await this.client.query<ItemData>(ITEM_QUERY, { id: itemId });
    if (!result.ok) {
      throw vscode.FileSystemError.Unavailable(
        result.degradation.detail ?? 'the item seam is unavailable',
      );
    }
    if (!result.data.item) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    this.bases.set(itemId, itemBaseContentHash(result.data.item));
    return result.data.item;
  }
}

interface PutNoteData {
  readonly putNote: GraphItem | null;
}

/**
 * Save a selection into the graph as a new item.
 *
 * The B2 block action creates rather than edits, so it goes through `putNote`
 * and not `writeItemBody` — there is no prior body to declare a base hash
 * against, and the write path is deliberately strict about that.
 */
export async function saveSelectionToGraph(
  client: SubstrateClient,
  title: string,
  text: string,
): Promise<GraphItem | { readonly level: 'unavailable'; readonly code: string; readonly detail?: string }> {
  const result = await client.query<PutNoteData>(PUT_NOTE_MUTATION, {
    title,
    text,
    tags: ['editor-selection'],
  });
  if (!result.ok) return result.degradation;
  if (!result.data.putNote) {
    return { level: 'unavailable', code: 'editor_seam_unavailable', detail: title };
  }
  return result.data.putNote;
}

/**
 * A refusal, in words a reader can act on.
 *
 * VS Code has no "someone else changed this" file error, so the message has to
 * carry the meaning: the save did not happen, the document on disk is newer,
 * and reopening is the way forward.
 */
export function refusalError(refusal: ConcurrencyRefusal): vscode.FileSystemError {
  return vscode.FileSystemError.FileExists(
    `${refusal.message} Nothing was overwritten; close and reopen the document to pick up the newer version.`,
  );
}
