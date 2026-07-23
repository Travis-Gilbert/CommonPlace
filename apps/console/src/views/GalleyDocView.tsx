'use client';

// SOURCING: @travis-gilbert/markdown-theory (Galley, document rendering) +
// codemirror (@codemirror/lang-markdown) for the edit mode. The markdown.doc
// descriptor (G5): read mode renders through Galley mounted bare (the host
// owns page geometry; ground and surface bridge to the chrome via
// gy-bridge.css); edit mode mounts CodeMirror 6 with the one register theme.
// Toggling preserves scroll position and content.

import { useEffect, useRef, useState } from 'react';
import { Galley } from '@travis-gilbert/markdown-theory/react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { useAppearance } from '@/lib/appearance-store';
import { objectChip, useShellStore } from '@/lib/shell-store';
import { intuiEditorExtensions } from './cm-register-theme';
import { ViewState } from './ViewStates';

type Mode = 'read' | 'edit';

export function GalleyDocView({ set, host }: ViewRenderProps) {
  const { resolvedMode } = useAppearance();
  const doc = set.objects[0];
  const readOnlyReason = typeof doc?.properties.read_only_reason === 'string'
    ? doc.properties.read_only_reason
    : null;
  const [mode, setMode] = useState<Mode>('read');
  // Doc navigation patches the reader instance in place (an arrangement
  // edit), so this component does not remount when the document changes.
  // Sync markdown whenever the resolved doc identity or body changes.
  const markdown = typeof doc?.properties.markdown === 'string' ? doc.properties.markdown : '';
  const [docId, setDocId] = useState<string | undefined>(doc?.id);
  const [text, setText] = useState<string>(() => markdown);
  if (doc && doc.id !== docId) {
    setDocId(doc.id);
    setText(markdown);
    setMode('read');
  } else if (doc && mode === 'read' && markdown !== text) {
    setText(markdown);
  }
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollPos = useRef(0);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorView | null>(null);

  // Mount CodeMirror when entering edit mode; tear down on exit. The edited
  // text lives in component state so the toggle never loses content, and the
  // outer scroll container's position is restored after each mode switch.
  useEffect(() => {
    if (mode !== 'edit' || !editorHostRef.current) return;
    const view = new EditorView({
      parent: editorHostRef.current,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          ...intuiEditorExtensions(resolvedMode),
          EditorView.lineWrapping,
        ],
      }),
    });
    editorRef.current = view;
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scrollPos.current;
    return () => {
      editorRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resolvedMode]);

  useEffect(() => {
    if (mode !== 'read') return;
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scrollPos.current;
  }, [mode]);

  // The todo-block entry (HANDOFF-CARDS-ACTIONS-MENTIONS K3): every rendered
  // task-list item gets the action affordance in the paper-plane position,
  // with Alt+Enter as the shortcut. Galley owns the markup and may replace
  // list nodes on re-render, so decoration is re-applied via MutationObserver
  // and actions are delegated from the scroll root.
  useEffect(() => {
    if (mode !== 'read') return;
    const root = scrollRef.current;
    const docId = doc?.id;
    const docTitle = typeof doc?.properties.title === 'string' ? doc.properties.title : docId;
    if (!root || !docId) return;

    const openFor = (todoText: string) => {
      useShellStore.getState().openActionSheet({
        chips: [
          objectChip(docId, 'doc', docTitle ?? docId),
          {
            id: `chip-selection-${docId}-${todoText.slice(0, 24)}`,
            kind: 'selection',
            label: todoText,
            text: todoText,
            source: 'origin',
          },
        ],
      });
    };

    const decorate = () => {
      const items = [
        ...root.querySelectorAll<HTMLElement>('li.task-list-item'),
        ...[...root.querySelectorAll<HTMLElement>('.galley li:not(.task-list-item)')].filter((li) =>
          /^\[( |x)\]\s/.test((li.textContent ?? '').trimStart()),
        ),
      ];
      for (const item of items) {
        if (item.querySelector('[data-todo-action]')) continue;
        const todoText = (item.textContent ?? '').trim();
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.todoAction = '';
        button.dataset.todoText = todoText;
        button.setAttribute('aria-label', 'Hand this todo to the agent');
        button.textContent = '→';
        button.className =
          'ml-2 h-5 rounded-ij-arc px-1 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink focus:outline-2 focus:outline-ij-accent';
        item.tabIndex = 0;
        item.dataset.todoItem = '';
        item.dataset.todoText = todoText;
        item.appendChild(button);
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLElement>('[data-todo-action]');
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      openFor(button.dataset.todoText ?? '');
    };
    const onKey = (event: KeyboardEvent) => {
      if (!(event.altKey && event.key === 'Enter')) return;
      const target = event.target as HTMLElement | null;
      const item = target?.closest<HTMLElement>('[data-todo-item]');
      if (!item || !root.contains(item)) return;
      event.preventDefault();
      event.stopPropagation();
      openFor(item.dataset.todoText ?? (item.textContent ?? '').trim());
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver;
    const scheduleDecorate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        observer.disconnect();
        try {
          decorate();
        } finally {
          observer.observe(root, { childList: true, subtree: true });
        }
      }, 0);
    };

    decorate();
    observer = new MutationObserver(() => scheduleDecorate());
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.querySelectorAll('[data-todo-action]').forEach((node) => node.remove());
      root.querySelectorAll<HTMLElement>('[data-todo-item]').forEach((item) => {
        item.removeAttribute('tabindex');
        delete item.dataset.todoItem;
        delete item.dataset.todoText;
      });
    };
  }, [mode, text, doc?.id]);

  if (!doc) {
    return <ViewState state="empty" />;
  }

  const toggle = () => {
    if (readOnlyReason) return;
    scrollPos.current = scrollRef.current?.scrollTop ?? 0;
    if (mode === 'edit' && editorRef.current) {
      const edited = editorRef.current.state.doc.toString();
      setText(edited);
      void host.emit({ kind: 'update', id: doc.id, patch: { markdown: edited } });
      setMode('read');
    } else {
      setMode('edit');
    }
  };

  return (
    <div className="flex h-full flex-col bg-ij-editor">
      <div className="flex h-ij-control shrink-0 items-center justify-end border-b border-ij-divider px-2">
        <button
          type="button"
          onClick={toggle}
          disabled={Boolean(readOnlyReason)}
          title={readOnlyReason ?? undefined}
          aria-pressed={mode === 'edit'}
          className="h-6 rounded-ij-arc px-3 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink disabled:text-ij-ink-disabled"
        >
          {readOnlyReason ? 'Read only' : mode === 'edit' ? 'Done' : 'Edit'}
        </button>
      </div>
      {readOnlyReason ? (
        <div role="note" className="border-b border-ij-seam px-3 py-1 text-ij-ink-info">
          {readOnlyReason}
        </div>
      ) : null}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {mode === 'read' ? (
          <div className="mx-auto max-w-prose px-8 py-10">
            <Galley doc={text} template="article" className="galley--bare" />
          </div>
        ) : (
          <div ref={editorHostRef} className="h-full" />
        )}
      </div>
    </div>
  );
}
