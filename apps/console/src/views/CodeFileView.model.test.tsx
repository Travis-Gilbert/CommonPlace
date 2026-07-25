import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { ObjectActionReceipt } from '@commonplace/block-view/types';
import {
  collectEditsFromChanges,
  editEditorModelArgs,
  historyEditorModelArgs,
  noteText,
  openEditorModelArgs,
  parseEditorModelReceipt,
  seedEditorFile,
} from './CodeFileView';

describe('CodeFileView editor-model contract helpers', () => {
  it('builds the open, edit, undo, and redo invoke-tool payloads without a parallel protocol', () => {
    expect(openEditorModelArgs('code:fixture', 'const count = 1;')).toEqual({
      action: 'open',
      id: 'code:fixture',
      text: 'const count = 1;',
    });

    expect(editEditorModelArgs('code:fixture', 3, [
      { start_utf16: 14, end_utf16: 15, insert: '2' },
    ])).toEqual({
      action: 'edit',
      id: 'code:fixture',
      base_revision: 3,
      edits: [{ start_utf16: 14, end_utf16: 15, insert: '2' }],
    });

    expect(historyEditorModelArgs('undo', 'code:fixture', 4)).toEqual({
      action: 'undo',
      id: 'code:fixture',
      base_revision: 4,
    });
    expect(historyEditorModelArgs('redo', 'code:fixture', 5)).toEqual({
      action: 'redo',
      id: 'code:fixture',
      base_revision: 5,
    });
  });

  it('translates CodeMirror changes into the UTF-16 edit payload the Rust model expects', () => {
    const state = EditorState.create({ doc: 'a😀c' });
    const transaction = state.update({ changes: { from: 1, to: 3, insert: 'rocket' } });
    expect(collectEditsFromChanges(transaction.changes)).toEqual([
      { start_utf16: 1, end_utf16: 3, insert: 'rocket' },
    ]);
  });

  it('validates authoritative receipt state and degrades malformed notes honestly', () => {
    const receipt: ObjectActionReceipt = {
      action_kind: 'invoke_tool',
      status: 'applied',
      note: JSON.stringify({
        available: true,
        id: 'code:fixture',
        document: 'const count = 2;',
        revision: 1,
        can_undo: true,
        can_redo: false,
      }),
    };
    expect(parseEditorModelReceipt(receipt, 'code:fixture')).toEqual({
      available: true,
      id: 'code:fixture',
      document: 'const count = 2;',
      revision: 1,
      can_undo: true,
      can_redo: false,
    });
    expect(parseEditorModelReceipt({ action_kind: 'invoke_tool', status: 'deferred', note: '{' }, 'code:fixture')).toEqual({
      available: false,
      id: 'code:fixture',
      revision: 0,
      can_undo: false,
      can_redo: false,
      reason: 'editor_model_invalid_receipt',
    });
    expect(parseEditorModelReceipt({
      action_kind: 'invoke_tool',
      status: 'applied',
      note: JSON.stringify({ available: true, id: 'code:fixture' }),
    }, 'code:fixture')).toEqual({
      available: false,
      id: 'code:fixture',
      revision: 0,
      can_undo: false,
      can_redo: false,
      reason: 'editor_model_invalid_receipt',
    });
  });

  it('surfaces backend reasons as readable note text without hiding them', () => {
    expect(noteText('editor_model_revision_conflict')).toBe('editor model revision conflict');
    expect(noteText(null)).toBeNull();
  });

  it('seeds model authority once per file identity', () => {
    const initial = seedEditorFile(null, 'code:fixture', 'const count = 1;');
    expect(seedEditorFile(initial, 'code:fixture', 'stale descriptor refresh')).toBe(initial);
    expect(seedEditorFile(initial, 'code:next', 'const next = true;')).toEqual({
      id: 'code:next',
      document: 'const next = true;',
    });
  });
});
