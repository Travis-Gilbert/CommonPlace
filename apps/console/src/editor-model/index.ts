// SOURCING: SPEC-JETBRAINS-FLEET-PORT-1.0 J4 over the existing editor.model /
// rustyred-thg-text-model seam. This store multiplexes CM6 views while the
// authoritative document, revision, and history remain in the Rust model.

import type { ChangeSet } from '@codemirror/state';
import type {
  BlockHost,
  JsonValue,
  ObjectActionReceipt,
  Result,
} from '@commonplace/block-view/types';

export const EDITOR_MODEL_TOOL = 'editor.model';

export interface EditorModelEdit {
  readonly start_utf16: number;
  readonly end_utf16: number;
  readonly insert: string;
}

export interface EditorModelState {
  readonly available: boolean;
  readonly id: string;
  readonly document?: string;
  readonly revision: number;
  readonly can_undo: boolean;
  readonly can_redo: boolean;
  readonly reason?: string;
}

export interface EditorFileSeed {
  readonly id: string;
  readonly document: string;
}

export interface TextEdit {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

export interface DocumentSnapshot {
  readonly fileId: string;
  readonly document: string;
  readonly generation: number;
  readonly revision: number;
  readonly available: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly pending: boolean;
  readonly reason?: string;
}

export type DocumentListener = (snapshot: DocumentSnapshot) => void;

export function seedEditorFile(
  current: EditorFileSeed | null,
  id: string,
  document: string,
): EditorFileSeed {
  return current?.id === id ? current : { id, document };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidReceiptState(id: string): EditorModelState {
  return {
    available: false,
    id,
    revision: 0,
    can_undo: false,
    can_redo: false,
    reason: 'editor_model_invalid_receipt',
  };
}

export function noteText(reason?: string | null): string | null {
  if (!reason) return null;
  return reason.replaceAll('_', ' ');
}

export function parseEditorModelReceipt(
  receipt: ObjectActionReceipt | undefined,
  fallbackId: string,
): EditorModelState | null {
  if (!receipt?.note) return null;
  try {
    const value: unknown = JSON.parse(receipt.note);
    if (
      !isRecord(value)
      || typeof value.available !== 'boolean'
      || typeof value.id !== 'string'
      || !Number.isSafeInteger(value.revision)
      || (value.revision as number) < 0
      || typeof value.can_undo !== 'boolean'
      || typeof value.can_redo !== 'boolean'
      || (value.document !== undefined && typeof value.document !== 'string')
      || (value.reason !== undefined && typeof value.reason !== 'string')
      || (value.available && typeof value.document !== 'string')
    ) {
      return invalidReceiptState(fallbackId);
    }
    return value as unknown as EditorModelState;
  } catch {
    return invalidReceiptState(fallbackId);
  }
}

export function collectEditsFromChanges(changes: ChangeSet): EditorModelEdit[] {
  const edits: EditorModelEdit[] = [];
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    edits.push({
      start_utf16: fromA,
      end_utf16: toA,
      insert: inserted.toString(),
    });
  });
  return edits;
}

export function openEditorModelArgs(id: string, text: string): Record<string, JsonValue> {
  return { action: 'open', id, text };
}

export function editEditorModelArgs(
  id: string,
  baseRevision: number,
  edits: readonly EditorModelEdit[],
): Record<string, JsonValue> {
  return {
    action: 'edit',
    id,
    base_revision: baseRevision,
    edits: edits as unknown as readonly JsonValue[],
  };
}

export function historyEditorModelArgs(
  action: 'undo' | 'redo',
  id: string,
  baseRevision: number,
): Record<string, JsonValue> {
  return { action, id, base_revision: baseRevision };
}

export function closeEditorModelArgs(id: string): Record<string, JsonValue> {
  return { action: 'close', id };
}

type FileEntry = {
  document: string;
  generation: number;
  revision: number;
  available: boolean;
  canUndo: boolean;
  canRedo: boolean;
  pendingCommands: number;
  reason?: string;
  listeners: Set<DocumentListener>;
  syncChain: Promise<void>;
};

function applyTextEdits(document: string, edits: readonly TextEdit[]): string {
  let next = document;
  const sorted = [...edits].sort((a, b) => b.from - a.from);
  for (const edit of sorted) {
    if (
      !Number.isSafeInteger(edit.from)
      || !Number.isSafeInteger(edit.to)
      || edit.from < 0
      || edit.to < edit.from
      || edit.to > next.length
    ) {
      throw new RangeError('document_store_invalid_edit');
    }
    next = next.slice(0, edit.from) + edit.insert + next.slice(edit.to);
  }
  return next;
}

/**
 * Per-host document store for model-backed editor views. Local edits notify
 * subscribers immediately, then serialize through the authoritative Rust
 * revision so multiple CM6 views cannot race the same base revision.
 */
export class DocumentStore {
  private readonly files = new Map<string, FileEntry>();

  constructor(private readonly host: BlockHost) {}

  snapshot(fileId: string): DocumentSnapshot | null {
    const entry = this.files.get(fileId);
    return entry ? this.toSnapshot(fileId, entry) : null;
  }

  async open(fileId: string, text: string): Promise<DocumentSnapshot> {
    const existing = this.files.get(fileId);
    if (existing) return this.toSnapshot(fileId, existing);

    const entry: FileEntry = {
      document: text,
      generation: 0,
      revision: 0,
      available: false,
      canUndo: false,
      canRedo: false,
      pendingCommands: 1,
      listeners: new Set(),
      syncChain: Promise.resolve(),
    };
    this.files.set(fileId, entry);
    this.emit(fileId, entry);

    const state = await this.invoke(openEditorModelArgs(fileId, text), fileId);
    const current = this.files.get(fileId);
    if (!current) {
      return this.toSnapshot(fileId, entry);
    }
    current.pendingCommands = 0;
    if (state) {
      this.applyAuthoritative(current, state, true);
    } else {
      current.available = false;
      current.reason ??= 'editor_model_transport_failed';
    }
    this.emit(fileId, current);
    return this.toSnapshot(fileId, current);
  }

  subscribe(fileId: string, listener: DocumentListener): () => void {
    const entry = this.require(fileId);
    entry.listeners.add(listener);
    listener(this.toSnapshot(fileId, entry));
    return () => {
      entry.listeners.delete(listener);
    };
  }

  dispatch(fileId: string, edits: readonly TextEdit[]): DocumentSnapshot {
    const entry = this.require(fileId);
    if (!entry.available || edits.length === 0) {
      return this.toSnapshot(fileId, entry);
    }

    const desired = applyTextEdits(entry.document, edits);
    const generation = entry.generation + 1;
    const modelEdits = edits.map((edit) => ({
      start_utf16: edit.from,
      end_utf16: edit.to,
      insert: edit.insert,
    }));
    entry.document = desired;
    entry.generation = generation;
    entry.pendingCommands += 1;
    this.emit(fileId, entry);

    entry.syncChain = entry.syncChain.then(async () => {
      const current = this.files.get(fileId);
      if (!current) return;
      const state = await this.invoke(
        editEditorModelArgs(fileId, current.revision, modelEdits),
        fileId,
      );
      const latest = this.files.get(fileId);
      if (!latest) return;
      latest.pendingCommands = Math.max(0, latest.pendingCommands - 1);
      if (!state) {
        latest.available = false;
        latest.reason ??= 'editor_model_transport_failed';
      } else if (!state.available) {
        this.applyAuthoritative(latest, state, false);
      } else if (latest.generation === generation) {
        this.applyAuthoritative(latest, state, true);
      } else if (state.document === desired) {
        this.applyAuthoritative(latest, state, false);
      } else {
        latest.available = false;
        latest.canUndo = false;
        latest.canRedo = false;
        latest.reason = state.reason ?? 'editor_model_revision_conflict';
      }
      this.emit(fileId, latest);
    });

    return this.toSnapshot(fileId, entry);
  }

  async history(fileId: string, action: 'undo' | 'redo'): Promise<DocumentSnapshot> {
    const entry = this.require(fileId);
    await entry.syncChain;
    if (!entry.available) return this.toSnapshot(fileId, entry);

    entry.pendingCommands += 1;
    this.emit(fileId, entry);
    const state = await this.invoke(
      historyEditorModelArgs(action, fileId, entry.revision),
      fileId,
    );
    const current = this.require(fileId);
    current.pendingCommands = Math.max(0, current.pendingCommands - 1);
    if (state) {
      const changed = state.document !== current.document;
      this.applyAuthoritative(current, state, true);
      if (changed) current.generation += 1;
    } else {
      current.available = false;
      current.reason ??= 'editor_model_transport_failed';
    }
    this.emit(fileId, current);
    return this.toSnapshot(fileId, current);
  }

  async close(fileId: string): Promise<void> {
    const entry = this.files.get(fileId);
    if (!entry) return;
    await entry.syncChain;
    this.files.delete(fileId);
    try {
      await this.host.emit({
        kind: 'invoke_tool',
        tool: EDITOR_MODEL_TOOL,
        args: closeEditorModelArgs(fileId),
      });
    } catch {
      // Closing is best-effort after the local entry is released.
    }
  }

  private require(fileId: string): FileEntry {
    const entry = this.files.get(fileId);
    if (!entry) throw new Error(`document_store_not_open:${fileId}`);
    return entry;
  }

  private toSnapshot(fileId: string, entry: FileEntry): DocumentSnapshot {
    return {
      fileId,
      document: entry.document,
      generation: entry.generation,
      revision: entry.revision,
      available: entry.available,
      canUndo: entry.canUndo,
      canRedo: entry.canRedo,
      pending: entry.pendingCommands > 0,
      reason: entry.reason,
    };
  }

  private emit(fileId: string, entry: FileEntry): void {
    const snapshot = this.toSnapshot(fileId, entry);
    for (const listener of entry.listeners) listener(snapshot);
  }

  private applyAuthoritative(
    entry: FileEntry,
    state: EditorModelState,
    replaceDocument: boolean,
  ): void {
    entry.available = state.available;
    entry.revision = state.revision;
    entry.canUndo = state.can_undo;
    entry.canRedo = state.can_redo;
    entry.reason = state.reason;
    if (replaceDocument && state.document !== undefined) {
      entry.document = state.document;
    }
  }

  private async invoke(
    args: Readonly<Record<string, JsonValue>>,
    fileId: string,
  ): Promise<EditorModelState | null> {
    let result: Result<ObjectActionReceipt>;
    try {
      result = await this.host.emit({
        kind: 'invoke_tool',
        tool: EDITOR_MODEL_TOOL,
        args,
      });
    } catch {
      result = { ok: false, error: 'editor_model_transport_failed' };
    }
    if (!result.ok) {
      const entry = this.files.get(fileId);
      if (entry) entry.reason = result.error ?? 'editor_model_transport_failed';
      return null;
    }
    const parsed = parseEditorModelReceipt(result.value, fileId);
    if (!parsed || parsed.id !== fileId) {
      const entry = this.files.get(fileId);
      if (entry) entry.reason = 'editor_model_invalid_receipt';
      return null;
    }
    return parsed;
  }
}

const stores = new WeakMap<BlockHost, DocumentStore>();

export function documentStoreFor(host: BlockHost): DocumentStore {
  let store = stores.get(host);
  if (!store) {
    store = new DocumentStore(host);
    stores.set(host, store);
  }
  return store;
}
