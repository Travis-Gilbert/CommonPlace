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
import { intuiEditorExtensions } from './cm-register-theme';
import { ViewState } from './ViewStates';

type Mode = 'read' | 'edit';

export function GalleyDocView({ set, host }: ViewRenderProps) {
  const doc = set.objects[0];
  const [mode, setMode] = useState<Mode>('read');
  const [text, setText] = useState<string>(() =>
    typeof doc?.properties.markdown === 'string' ? doc.properties.markdown : '',
  );
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
          ...intuiEditorExtensions,
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
  }, [mode]);

  useEffect(() => {
    if (mode !== 'read') return;
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scrollPos.current;
  }, [mode]);

  if (!doc) {
    return <ViewState state="empty" />;
  }

  const toggle = () => {
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
          aria-pressed={mode === 'edit'}
          className="h-6 rounded-ij-arc px-3 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
        >
          {mode === 'edit' ? 'Done' : 'Edit'}
        </button>
      </div>
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
