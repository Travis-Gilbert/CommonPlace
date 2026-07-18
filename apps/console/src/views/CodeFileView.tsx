'use client';

// SOURCING: codemirror (@codemirror/view, @codemirror/lang-javascript). The
// code.file descriptor: a read-only CodeMirror 6 rendering through the one
// register theme. This tab proves the descriptor slot; full CodeBlockHost
// work stays with SPEC-CODE-SURFACE later.

import { useEffect, useRef } from 'react';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { useAppearance } from '@/lib/appearance-store';
import { intuiEditorExtensions } from './cm-register-theme';
import { ViewState } from './ViewStates';

function languageFor(name: string) {
  if (name === 'json') return json();
  if (name === 'markdown') return markdown();
  return javascript({ typescript: name === 'typescript' || name === 'tsx', jsx: name === 'tsx' });
}

export function CodeFileView({ set }: ViewRenderProps) {
  const { resolvedMode } = useAppearance();
  const file = set.objects[0];
  const hostRef = useRef<HTMLDivElement | null>(null);

  const content = typeof file?.properties.content === 'string' ? file.properties.content : '';
  const language = typeof file?.properties.language === 'string' ? file.properties.language : 'typescript';
  const path = typeof file?.properties.path === 'string' ? file.properties.path : '';

  useEffect(() => {
    if (!hostRef.current || !content) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          languageFor(language),
          ...intuiEditorExtensions(resolvedMode),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
        ],
      }),
    });
    return () => view.destroy();
  }, [content, language, resolvedMode]);

  if (!file) return <ViewState state="empty" />;

  return (
    <div className="flex h-full flex-col bg-ij-editor">
      <div className="flex h-ij-control shrink-0 items-center border-b border-ij-divider px-3 font-ij-mono text-ij-ink-info">
        {path}
        <span className="ml-auto rounded-ij-arc-underline bg-ij-raised px-2 text-ij-ink-info">read only</span>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
