// SOURCING: vscode FileSystemProvider API over the existing commonplace-api
// object seam. No third-party virtual filesystem library applies.
/**
 * V5. `theorem://` documents.
 *
 * Graph objects, specs, records, and plan documents open as editable buffers
 * and save through the object seam with receipts.
 *
 * Named choice 7 draws the line this file must not cross: repos stay on the
 * real filesystem, where the watcher already feeds the VFS journal. This
 * provider is for graph-native documents only. A checkout never appears behind
 * `theorem://`, so there is no second write path to the same bytes.
 *
 * URI shape: `theorem://object/<objectId>[.<ext>]`. The authority names the
 * seam collection and the path names the object; the extension is cosmetic and
 * exists so VS Code picks a language mode.
 */

import * as vscode from 'vscode';
import type { SeamReceipt } from '@commonplace/block-view-contracts/editor-intelligence';
import type { SubstrateClient } from '../substrate/client';

export const THEOREM_SCHEME = 'theorem';

export const OBJECT_DOCUMENT_QUERY = `query ObjectDocument($objectId: String!) {
  objectDocument(objectId: $objectId) { objectId text generation updatedAt }
}`;

export const WRITE_OBJECT_DOCUMENT_MUTATION = `mutation WriteObjectDocument($objectId: String!, $text: String!) {
  writeObjectDocument(objectId: $objectId, text: $text) { receiptId objectId generation }
}`;

interface ObjectDocumentData {
  readonly objectDocument: {
    readonly objectId: string;
    readonly text: string;
    readonly generation: number;
    readonly updatedAt?: number;
  } | null;
}

interface WriteObjectData {
  readonly writeObjectDocument: SeamReceipt | null;
}

/** `theorem://object/spec-123.md` -> `spec-123`. */
export function objectIdFromUri(uri: vscode.Uri): string {
  const path = uri.path.replace(/^\/+/, '');
  const lastDot = path.lastIndexOf('.');
  return lastDot > 0 ? path.slice(0, lastDot) : path;
}

export class TheoremFileSystemProvider implements vscode.FileSystemProvider {
  private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

  /** Receipts by object id, so a caller can prove a save landed. */
  private readonly receipts = new Map<string, SeamReceipt>();

  constructor(private readonly client: SubstrateClient) {}

  receiptFor(objectId: string): SeamReceipt | undefined {
    return this.receipts.get(objectId);
  }

  watch(): vscode.Disposable {
    // The changefeed already drives re-reads through the V1 client; a per-file
    // watch would be a second, weaker copy of that push path.
    return new vscode.Disposable(() => undefined);
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const document = await this.read(uri);
    return {
      type: vscode.FileType.File,
      ctime: document.updatedAt ?? 0,
      mtime: document.updatedAt ?? 0,
      size: Buffer.byteLength(document.text, 'utf8'),
    };
  }

  readDirectory(): [string, vscode.FileType][] {
    // Graph objects are addressed, not browsed. Quick open and the graph views
    // are the way in; a synthetic directory listing would invite a full-store
    // enumeration this seam has no page contract for.
    throw vscode.FileSystemError.NoPermissions('theorem:// is not browsable');
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('theorem:// has no directories');
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const document = await this.read(uri);
    return Buffer.from(document.text, 'utf8');
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const objectId = objectIdFromUri(uri);
    const result = await this.client.query<WriteObjectData>(WRITE_OBJECT_DOCUMENT_MUTATION, {
      objectId,
      text: Buffer.from(content).toString('utf8'),
    });

    if (!result.ok) {
      // A severed seam fails the save. VS Code keeps the buffer dirty and says
      // so, which is the honest state; silently accepting the write would leave
      // a clean-looking editor over a store that never received it.
      throw vscode.FileSystemError.Unavailable(result.degradation.detail ?? 'the object seam is unavailable');
    }
    const receipt = result.data.writeObjectDocument;
    if (!receipt) {
      throw vscode.FileSystemError.Unavailable('the object seam returned no receipt');
    }

    this.receipts.set(objectId, receipt);
    this.onDidChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  delete(): void {
    throw vscode.FileSystemError.NoPermissions('graph objects are retracted, not deleted');
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('graph objects are addressed by id');
  }

  private async read(uri: vscode.Uri): Promise<{ text: string; updatedAt?: number }> {
    const objectId = objectIdFromUri(uri);
    const result = await this.client.query<ObjectDocumentData>(
      OBJECT_DOCUMENT_QUERY,
      { objectId },
      (data) => data.objectDocument?.generation,
    );
    if (!result.ok) {
      throw vscode.FileSystemError.Unavailable(result.degradation.detail ?? 'the object seam is unavailable');
    }
    if (!result.data.objectDocument) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return {
      text: result.data.objectDocument.text,
      updatedAt: result.data.objectDocument.updatedAt,
    };
  }
}
