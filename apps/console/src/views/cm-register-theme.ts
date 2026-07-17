// SOURCING: @codemirror/view + @codemirror/language (EditorView.theme +
// HighlightStyle). The ONE editor theme file (G5): all editor color is built
// from --ij-* register variables here; no .cm-* CSS exists anywhere else.

import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const intuiEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--ij-editor)',
      color: 'var(--ij-ink)',
      fontFamily: 'var(--ij-font-mono)',
      fontSize: 'var(--ij-text-ui)',
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'var(--ij-ink-bright)',
      fontFamily: 'var(--ij-font-mono)',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ij-ink-bright)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--ij-selection)',
    },
    '.cm-activeLine': { backgroundColor: 'var(--ij-hover-overlay)' },
    '.cm-gutters': {
      backgroundColor: 'var(--ij-editor)',
      color: 'var(--ij-ink-info)',
      border: 'none',
      borderRight: '1px solid var(--ij-divider)',
      fontFamily: 'var(--ij-font-mono)',
    },
    '.cm-activeLineGutter': { backgroundColor: 'var(--ij-hover-overlay)', color: 'var(--ij-ink)' },
    '.cm-panels': { backgroundColor: 'var(--ij-chrome)', color: 'var(--ij-ink)' },
    '.cm-searchMatch': { backgroundColor: 'var(--ij-selection-inactive)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--ij-selection)' },
  },
  { dark: true },
);

// Syntax roles on the Int UI ramps; every value is a register variable.
export const intuiHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'var(--ij-warn)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--ij-ok)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--ij-link)' },
  { tag: [tags.comment, tags.blockComment, tags.lineComment], color: 'var(--ij-ink-info)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--ij-progress-a)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--ij-graph)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--ij-room)' },
  { tag: [tags.heading], color: 'var(--ij-ink-bright)', fontWeight: 'var(--rec-weight-cap)' },
  { tag: [tags.link, tags.url], color: 'var(--ij-link)' },
  { tag: [tags.emphasis], fontStyle: 'italic' },
  { tag: [tags.strong], fontWeight: 'var(--rec-weight-cap)' },
]);

export const intuiEditorExtensions = [intuiEditorTheme, syntaxHighlighting(intuiHighlightStyle)];
