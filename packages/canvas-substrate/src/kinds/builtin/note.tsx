'use client';

// SOURCING: none for the kind itself; the markdown renderer is injected by the
// host (the console passes its Galley renderer), so this file never becomes a
// second markdown implementation. ComfyUI's Markdown Note pattern, adapted.

import type { ComponentType } from 'react';
import type { NodeKindEntry } from '../types';

export const NOTE_MARKDOWN_KIND = 'note-markdown';

export interface NoteMarkdownData {
  readonly text: string;
  readonly title?: string;
  readonly collapsed?: boolean;
  readonly onToggleCollapsed?: () => void;
}

export interface MarkdownRenderProps {
  readonly source: string;
}

/**
 * Build the note kind against the host's markdown renderer. Without one the
 * note still renders -- as preformatted text rather than nothing, because a
 * missing renderer should degrade the presentation, not hide the content.
 */
export function createNoteMarkdownKind(
  Markdown?: ComponentType<MarkdownRenderProps>,
): NodeKindEntry<NoteMarkdownData> {
  function NoteBody({ data }: { readonly data: NoteMarkdownData }) {
    if (Markdown) {
      return (
        <div className="max-w-none text-xs text-ij-ink" data-substrate-note>
          <Markdown source={data.text} />
        </div>
      );
    }
    return (
      <pre
        className="whitespace-pre-wrap break-words text-xs text-ij-ink"
        data-substrate-note
      >
        {data.text}
      </pre>
    );
  }

  return {
    id: NOTE_MARKDOWN_KIND,
    palette: 'model',
    shell: (data) => ({
      kindId: NOTE_MARKDOWN_KIND,
      title: data.title ?? 'Note',
      collapsed: data.collapsed,
      width: 260,
      onToggleCollapsed: data.onToggleCollapsed,
    }),
    Body: ({ data }) => <NoteBody data={data} />,
  };
}
