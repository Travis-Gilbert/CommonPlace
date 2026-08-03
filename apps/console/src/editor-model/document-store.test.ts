import { describe, expect, it, vi } from 'vitest';
import type {
  BlockHost,
  JsonValue,
  ObjectActionReceipt,
  Result,
} from '@commonplace/block-view/types';
import { DocumentStore } from './index';

type ModelDocument = {
  text: string;
  revision: number;
  undo: string[];
  redo: string[];
};

function receipt(document: ModelDocument, id: string, reason?: string): ObjectActionReceipt {
  return {
    action_kind: 'invoke_tool',
    status: 'applied',
    legacy_without_op_range: true,
    note: JSON.stringify({
      available: true,
      id,
      document: document.text,
      revision: document.revision,
      can_undo: document.undo.length > 0,
      can_redo: document.redo.length > 0,
      reason,
    }),
  };
}

function modelHost(): BlockHost {
  const documents = new Map<string, ModelDocument>();
  return {
    async emit(action): Promise<Result<ObjectActionReceipt>> {
      if (action.kind !== 'invoke_tool' || action.tool !== 'editor.model') {
        return { ok: false, error: 'unexpected_action' };
      }
      const args = action.args as Record<string, JsonValue>;
      const id = String(args.id ?? '');
      if (args.action === 'open') {
        const document = documents.get(id) ?? {
          text: String(args.text ?? ''),
          revision: 0,
          undo: [],
          redo: [],
        };
        documents.set(id, document);
        return { ok: true, value: receipt(document, id) };
      }

      const document = documents.get(id);
      if (!document) {
        return { ok: false, error: 'editor_model_not_open' };
      }
      if (args.action === 'edit') {
        if (args.base_revision !== document.revision) {
          return {
            ok: true,
            value: receipt(document, id, 'editor_model_revision_conflict'),
          };
        }
        const edits = args.edits as Array<{
          start_utf16: number;
          end_utf16: number;
          insert: string;
        }>;
        document.undo.push(document.text);
        document.redo = [];
        for (const edit of [...edits].sort((a, b) => b.start_utf16 - a.start_utf16)) {
          document.text = document.text.slice(0, edit.start_utf16)
            + edit.insert
            + document.text.slice(edit.end_utf16);
        }
        document.revision += 1;
        return { ok: true, value: receipt(document, id) };
      }
      if (args.action === 'undo') {
        const previous = document.undo.pop();
        if (previous !== undefined) {
          document.redo.push(document.text);
          document.text = previous;
          document.revision += 1;
        }
        return { ok: true, value: receipt(document, id) };
      }
      if (args.action === 'redo') {
        const next = document.redo.pop();
        if (next !== undefined) {
          document.undo.push(document.text);
          document.text = next;
          document.revision += 1;
        }
        return { ok: true, value: receipt(document, id) };
      }
      if (args.action === 'close') {
        documents.delete(id);
        return { ok: true, value: receipt(document, id, 'editor_model_closed') };
      }
      return { ok: false, error: 'unexpected_editor_model_action' };
    },
  } as BlockHost;
}

describe('DocumentStore', () => {
  it('serializes interleaved edits and keeps subscribers on one generation', async () => {
    const store = new DocumentStore(modelHost());
    await store.open('file:a', 'alpha');

    const seenA: string[] = [];
    const seenB: string[] = [];
    store.subscribe('file:a', (snapshot) => seenA.push(snapshot.document));
    store.subscribe('file:a', (snapshot) => seenB.push(snapshot.document));

    store.dispatch('file:a', [{ from: 5, to: 5, insert: '!' }]);
    store.dispatch('file:a', [{ from: 0, to: 0, insert: '>' }]);

    await vi.waitFor(() => expect(store.snapshot('file:a')?.pending).toBe(false));
    expect(store.snapshot('file:a')).toMatchObject({
      document: '>alpha!',
      generation: 2,
      revision: 2,
      available: true,
    });
    expect(seenA.at(-1)).toBe('>alpha!');
    expect(seenB.at(-1)).toBe('>alpha!');
  });

  it('round-trips undo and redo and reports an unavailable seam honestly', async () => {
    const store = new DocumentStore(modelHost());
    await store.open('file:a', 'one');
    store.dispatch('file:a', [{ from: 3, to: 3, insert: '!' }]);
    await vi.waitFor(() => expect(store.snapshot('file:a')?.pending).toBe(false));

    expect(await store.history('file:a', 'undo')).toMatchObject({
      document: 'one',
      canRedo: true,
      available: true,
    });
    expect(await store.history('file:a', 'redo')).toMatchObject({
      document: 'one!',
      canUndo: true,
      available: true,
    });

    const unavailable = new DocumentStore({
      async emit() {
        return { ok: false, error: 'editor_model_unavailable' };
      },
    } as BlockHost);
    expect(await unavailable.open('file:offline', 'visible snapshot')).toMatchObject({
      document: 'visible snapshot',
      available: false,
      pending: false,
      reason: 'editor_model_unavailable',
    });
  });
});
