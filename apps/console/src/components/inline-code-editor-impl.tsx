'use client';

// SOURCING: twenty-ui `CodeEditor` (packages/twenty-ui/src/input/CodeEditor,
// hard fork) over @monaco-editor/react.
//
// Everything Monaco-touching lives here, and nothing imports this module
// statically. `inline-code-editor.tsx` is the only entry, and it reaches this
// file through `next/dynamic`, which is what keeps Monaco out of a route's
// compile graph rather than merely out of its runtime bundle.
//
// That distinction is the whole reason this file exists. A `dynamic()` call
// sitting beside a static `import ... from 'twenty-ui/input'` does not defer
// anything at build time: the barrel pulls CodeEditor, @monaco-editor/react,
// and monaco-editor into the graph regardless, and `next dev` then spends ~37s
// and a memory-threshold restart compiling /records.

import { useCallback, useRef } from 'react';
import type { editor } from 'monaco-editor';
import {
  BASE_CODE_EDITOR_THEME_ID,
  CodeEditor,
  getBaseCodeEditorTheme,
} from 'twenty-ui/code-editor';
import { useTheme } from 'twenty-ui/theme-constants';
import { useAppearance } from '@/lib/appearance-store';

export interface InlineCodeEditorProps {
  readonly value: string;
  readonly language?: string;
  readonly height?: number | string;
  readonly onChange?: (value: string) => void;
  readonly options?: editor.IStandaloneEditorConstructionOptions;
}

export default function InlineCodeEditorImpl({
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
  // the theme is registered at mount against this element, which sits inside
  // the register scope and therefore resolves light and dark correctly.
  const onMount = useCallback(
    (
      _editor: editor.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor'),
    ) => {
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
