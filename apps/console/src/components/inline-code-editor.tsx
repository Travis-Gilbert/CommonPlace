'use client';

// SOURCING: twenty-ui `CodeEditor` (packages/twenty-ui, hard fork) over
// @monaco-editor/react, behind next/dynamic.
// SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0 TU7, named choice 5.
//
// The console's inline code component, and the only door to Monaco in this app.
// Import this module; never `twenty-ui/input`'s CodeEditor directly.
//
// This file deliberately imports nothing from `twenty-ui/input`. The editor,
// its theme helpers, and Monaco all live in ./inline-code-editor-impl, reached
// only through the `dynamic()` factory below. A static import here would put
// the barrel back in every consuming route's compile graph, which is not a
// theoretical cost: it took /records from 3s to 37s in `next dev` and tripped
// the memory-threshold restart that timed out CI's Playwright warm-up.
//
// CodeMirror 6 remains the console's document-grade code surface per the
// library ledger. This is the inline component: short snippets, tool payloads,
// and the structured code an object carries.

import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';

export interface InlineCodeEditorProps {
  readonly value: string;
  readonly language?: string;
  readonly height?: number | string;
  readonly onChange?: (value: string) => void;
  readonly options?: editor.IStandaloneEditorConstructionOptions;
}

export const InlineCodeEditor = dynamic<InlineCodeEditorProps>(
  () => import('@/components/inline-code-editor-impl'),
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
