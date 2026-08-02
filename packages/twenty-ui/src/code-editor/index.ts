'use client';

// SOURCING: twenty-ui `CodeEditor` (this fork). SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0
// TU7, named choice 5: "Monaco stays, lazy ... banned from initial route bundles."
//
// These exports lived in `input/index.ts` upstream. That barrel is what a
// console imports to get a Checkbox or a Button, so shipping CodeEditor beside
// them put @monaco-editor/react and monaco-editor into the module graph of
// every route that used any input at all. A dynamic import at the call site
// cannot undo that: the bundler has already traversed the barrel.
//
// A subpath export is what makes the ban structural rather than a habit.
// Import from 'twenty-ui/code-editor', and only from behind a dynamic import.

export { CodeEditor } from '@ui/input/CodeEditor/CodeEditor';
export { BASE_CODE_EDITOR_THEME_ID } from '@ui/input/CodeEditor/constants/BaseCodeEditorThemeId';
export { getBaseCodeEditorTheme } from '@ui/input/CodeEditor/utils/getBaseCodeEditorTheme';
export { resolveCssColor } from '@ui/input/CodeEditor/utils/resolveCssColor';
export type { CoreEditorHeaderProps } from '@ui/input/CodeEditorHeader/CodeEditorHeader';
export { CoreEditorHeader } from '@ui/input/CodeEditorHeader/CodeEditorHeader';
