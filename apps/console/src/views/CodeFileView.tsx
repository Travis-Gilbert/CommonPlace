'use client';

// SOURCING: codemirror (@codemirror/view, @codemirror/lang-javascript). The
// code.file descriptor is a CodeMirror 6 view over the Rust text-model seam.
// Edits use the existing ObjectAction::InvokeTool contract and authoritative
// model state returns in the existing action receipt note.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  type ChangeSet,
} from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, keymap, lineNumbers, type ViewUpdate } from '@codemirror/view';
import type {
  BlockHost,
  JsonValue,
  ObjectActionReceipt,
  Result,
  ViewRenderProps,
} from '@commonplace/block-view/types';
import { useAppearance } from '@/lib/appearance-store';
import { intuiEditorExtensions } from './cm-register-theme';
import { ViewState } from './ViewStates';

const EDITOR_MODEL_TOOL = 'editor.model';
const SKIP_MODEL_ROUND_TRIP = Annotation.define<boolean>();

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

export function seedEditorFile(
  current: EditorFileSeed | null,
  id: string,
  document: string,
): EditorFileSeed {
  return current?.id === id ? current : { id, document };
}

function languageFor(name: string) {
  if (name === 'json') return json();
  if (name === 'markdown') return markdown();
  return javascript({
    typescript: name === 'typescript' || name === 'tsx',
    jsx: name === 'tsx',
  });
}

function editableExtensions(editable: boolean) {
  return [EditorState.readOnly.of(!editable), EditorView.editable.of(editable)];
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
  return {
    action: 'open',
    id,
    text,
  };
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
  return {
    action,
    id,
    base_revision: baseRevision,
  };
}

interface CodeFileSurfaceProps {
  readonly fileId: string;
  readonly initialContent: string;
  readonly language: string;
  readonly path: string;
  readonly host: BlockHost;
}

function CodeFileSurface({
  fileId,
  initialContent,
  language,
  path,
  host,
}: CodeFileSurfaceProps) {
  const { resolvedMode } = useAppearance();
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const blockHostRef = useRef<BlockHost>(host);
  const revisionRef = useRef(0);
  const availableRef = useRef(false);
  const pendingRef = useRef(false);
  const authoritativeDocumentRef = useRef('');
  const requestTokenRef = useRef(0);
  const languageCompartment = useMemo(() => new Compartment(), []);
  const themeCompartment = useMemo(() => new Compartment(), []);
  const editableCompartment = useMemo(() => new Compartment(), []);
  const [fileSeed] = useState<EditorFileSeed>(() => ({
    id: fileId,
    document: initialContent,
  }));
  const [modelState, setModelState] = useState<EditorModelState | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    blockHostRef.current = host;
  }, [host]);

  const enterUnavailable = useCallback((reason: string) => {
    availableRef.current = false;
    setModelState({
      available: false,
      id: fileId,
      document: authoritativeDocumentRef.current,
      revision: revisionRef.current,
      can_undo: false,
      can_redo: false,
      reason,
    });
  }, [fileId]);

  const runModelCommand = useCallback(async (
    args: Readonly<Record<string, JsonValue>>,
  ): Promise<EditorModelState | null> => {
    if (!fileId) return null;

    const token = ++requestTokenRef.current;
    pendingRef.current = true;
    setPending(true);
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: editableCompartment.reconfigure(editableExtensions(false)),
      });
    }

    let result: Result<ObjectActionReceipt>;
    try {
      result = await blockHostRef.current.emit({
        kind: 'invoke_tool',
        tool: EDITOR_MODEL_TOOL,
        args,
      });
    } catch {
      result = { ok: false, error: 'editor_model_transport_failed' };
    }

    if (token !== requestTokenRef.current) return null;
    pendingRef.current = false;
    setPending(false);

    if (!result.ok) {
      enterUnavailable(result.error ?? 'editor_model_transport_failed');
      return null;
    }

    const parsed = parseEditorModelReceipt(result.value, fileId);
    if (!parsed) {
      enterUnavailable('editor_model_missing_state');
      return null;
    }
    if (parsed.id !== fileId) {
      enterUnavailable('editor_model_invalid_receipt');
      return null;
    }

    if (!parsed.available) {
      enterUnavailable(parsed.reason ?? 'editor_model_unavailable');
      return parsed;
    }

    revisionRef.current = parsed.revision;
    availableRef.current = true;
    authoritativeDocumentRef.current = parsed.document ?? '';
    setModelState(parsed);
    return parsed;
  }, [editableCompartment, enterUnavailable, fileId]);

  const runHistory = useCallback((action: 'undo' | 'redo') => {
    if (!fileId || !availableRef.current || pendingRef.current) return;
    void runModelCommand(historyEditorModelArgs(action, fileId, revisionRef.current));
  }, [fileId, runModelCommand]);

  useEffect(() => {
    if (!editorHostRef.current || !fileId) return;

    const onDocChanged = (update: ViewUpdate) => {
      if (!update.docChanged) return;
      if (
        update.transactions.some(
          (transaction) => transaction.annotation(SKIP_MODEL_ROUND_TRIP),
        )
      ) {
        return;
      }
      if (!availableRef.current || pendingRef.current) return;
      const edits = collectEditsFromChanges(update.changes);
      if (edits.length === 0) return;
      void runModelCommand(editEditorModelArgs(fileId, revisionRef.current, edits));
    };

    const view = new EditorView({
      parent: editorHostRef.current,
      state: EditorState.create({
        doc: fileSeed.document,
        extensions: [
          lineNumbers(),
          languageCompartment.of([]),
          themeCompartment.of([]),
          editableCompartment.of(editableExtensions(false)),
          keymap.of([
            {
              key: 'Mod-z',
              preventDefault: true,
              run: () => {
                runHistory('undo');
                return true;
              },
            },
            {
              key: 'Mod-Shift-z',
              preventDefault: true,
              run: () => {
                runHistory('redo');
                return true;
              },
            },
            {
              key: 'Mod-y',
              preventDefault: true,
              run: () => {
                runHistory('redo');
                return true;
              },
            },
          ]),
          EditorView.updateListener.of(onDocChanged),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      if (viewRef.current === view) viewRef.current = null;
    };
  }, [
    editableCompartment,
    fileSeed,
    fileId,
    languageCompartment,
    runHistory,
    runModelCommand,
    themeCompartment,
  ]);

  useEffect(() => {
    if (!fileId) return;
    const seedDocument = fileSeed.document;
    requestTokenRef.current += 1;
    revisionRef.current = 0;
    availableRef.current = false;
    pendingRef.current = false;
    authoritativeDocumentRef.current = seedDocument;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void runModelCommand(openEditorModelArgs(fileId, seedDocument));
      }
    });

    return () => {
      cancelled = true;
      requestTokenRef.current += 1;
    };
  }, [fileId, fileSeed, runModelCommand]);

  const currentModelState = modelState?.id === fileId ? modelState : null;
  const canEdit = Boolean(currentModelState?.available) && !pending;

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.reconfigure(editableExtensions(canEdit)),
    });
  }, [canEdit, editableCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(languageFor(language)),
    });
  }, [language, languageCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(intuiEditorExtensions(resolvedMode)),
    });
  }, [resolvedMode, themeCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    const nextDocument = currentModelState?.document;
    if (!view || nextDocument === undefined || view.state.doc.toString() === nextDocument) return;
    const head = Math.min(view.state.selection.main.head, nextDocument.length);
    view.dispatch({
      annotations: SKIP_MODEL_ROUND_TRIP.of(true),
      changes: { from: 0, to: view.state.doc.length, insert: nextDocument },
      selection: EditorSelection.cursor(head),
    });
  }, [currentModelState?.document]);

  const notice = noteText(currentModelState?.reason);
  const status = pending
    ? 'syncing'
    : currentModelState === null
      ? 'connecting'
      : currentModelState.available
        ? 'model-backed'
        : 'model unavailable';

  return (
    <div className="flex h-full flex-col bg-ij-editor">
      <div className="flex h-ij-control shrink-0 items-center border-b border-ij-divider px-3 font-ij-mono text-ij-ink-info">
        {path}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => runHistory('undo')}
            disabled={!currentModelState?.can_undo || !canEdit}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-ij-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => runHistory('redo')}
            disabled={!currentModelState?.can_redo || !canEdit}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-ij-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Redo
          </button>
          <span
            aria-live="polite"
            className="rounded-ij-arc-underline bg-ij-raised px-2 text-ij-ink-info"
          >
            {status}
          </span>
        </div>
      </div>
      <div ref={editorHostRef} className="min-h-0 flex-1 overflow-hidden" />
      {notice ? (
        <div role="note" className="border-t border-ij-divider px-3 py-1 text-ij-ink-info">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

export function CodeFileView({ set, host }: ViewRenderProps) {
  const file = set.objects[0];
  if (!file) return <ViewState state="empty" emptyCause="not-loaded" />;

  const initialContent = typeof file.properties.content === 'string' ? file.properties.content : '';
  const language = typeof file.properties.language === 'string'
    ? file.properties.language
    : 'typescript';
  const path = typeof file.properties.path === 'string' ? file.properties.path : '';
  const fileId = typeof file.id === 'string' ? file.id.trim() : '';
  if (!fileId) {
    return <ViewState state="empty" emptyCause="not-loaded" />;
  }

  return (
    <CodeFileSurface
      key={fileId}
      fileId={fileId}
      initialContent={initialContent}
      language={language}
      path={path}
      host={host}
    />
  );
}
