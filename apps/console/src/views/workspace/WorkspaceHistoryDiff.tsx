'use client';

// SOURCING: @codemirror/merge. The workspace history contract supplies the
// exact bytes for two revisions; CodeMirror owns the inline diff surface.

import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { FileRevision } from '@commonplace/theorem-acp/workspace-state';
import { useAppearance } from '@/lib/appearance-store';
import { intuiEditorExtensions } from '@/views/cm-register-theme';

export function WorkspaceHistoryDiff({
  before,
  after,
}: {
  before: FileRevision;
  after: FileRevision;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { resolvedMode } = useAppearance();

  useEffect(() => {
    if (!parentRef.current || before.content === null || after.content === null) return;
    const extensions = [
      ...intuiEditorExtensions(resolvedMode),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ];
    const view = new MergeView({
      a: { doc: before.content, extensions },
      b: { doc: after.content, extensions },
      parent: parentRef.current,
      orientation: 'a-b',
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 2, minSize: 6 },
    });
    return () => view.destroy();
  }, [after, before, resolvedMode]);

  if (before.content === null || after.content === null) {
    return <p className="text-ij-warn">Diff unavailable for a binary or oversized revision.</p>;
  }

  return (
    <div
      ref={parentRef}
      className="min-h-44 overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor"
      data-workspace-history-diff
    />
  );
}
