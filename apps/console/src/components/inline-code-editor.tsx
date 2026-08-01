'use client';

// SOURCING: twenty-ui `CodeEditor` (packages/twenty-ui/src/input/CodeEditor,
// hard fork) over @monaco-editor/react.
// SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0 TU7, named choice 5.
//
// The console's inline code component, and the only door to Monaco in this app.
// Two rules it exists to enforce:
//
//   1. Monaco is never in an initial route bundle. `next/dynamic` with
//      `ssr: false` puts the editor, @monaco-editor/react, and the monaco-editor
//      core in a chunk that only loads when a code surface actually mounts.
//      Import this module, never 'twenty-ui/input' CodeEditor directly.
//   2. The Monaco theme comes from the same token generator as everything else.
//      `getBaseCodeEditorTheme` reads the theme object, whose values are
//      register references, and resolves them against this element (TU2/TU7).
//
// CodeMirror 6 remains the console's document-grade code surface per the
// library ledger. This is the inline component: short snippets, tool payloads,
// and the read-mostly code an object carries.

import dynamic from 'next/dynamic';
import { useCallback, useRef } from 'react';
import type { editor } from 'monaco-editor';
import {
  BASE_CODE_EDITOR_THEME_ID,
  getBaseCodeEditorTheme,
} from 'twenty-ui/input';
import { useTheme } from 'twenty-ui/theme-constants';
import { useAppearance } from '@/lib/appearance-store';

const CodeEditor = dynamic(
  () => import('twenty-ui/input').then((module) => module.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-24 w-full rounded-ij-arc border border-ij-seam bg-ij-editor"
        aria-busy="true"
        aria-label="Loading the code surface"
      />
    ),
  },
);

export interface InlineCodeEditorProps {
  readonly value: string;
  readonly language?: string;
  readonly height?: number | string;
  readonly onChange?: (value: string) => void;
  readonly options?: editor.IStandaloneEditorConstructionOptions;
}

export function InlineCodeEditor({
  value,
  language = 'json',
  height,
  onChange,
  options,
}: InlineCodeEditorProps) {
  const theme = useTheme();
  const { resolvedMode } = useAppearance();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Monaco takes literal colors. The theme object holds register references, so
  // the theme is registered at mount against this element, which is inside the
  // register scope and therefore resolves light and dark correctly.
  const onMount = useCallback(
    (_editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
      monaco.editor.defineTheme(
        BASE_CODE_EDITOR_THEME_ID,
        getBaseCodeEditorTheme(theme, resolvedMode, containerRef.current),
      );
      monaco.editor.setTheme(BASE_CODE_EDITOR_THEME_ID);
    },
    [resolvedMode, theme],
  );

  return (
    <div ref={containerRef} data-inline-code-editor>
      <CodeEditor
        value={value}
        language={language}
        height={height}
        onChange={onChange}
        onMount={onMount}
        options={options}
      />
    </div>
  );
}
