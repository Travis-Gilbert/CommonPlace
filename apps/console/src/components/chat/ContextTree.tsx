'use client';

// SOURCING: fork of Build UI filesystem-item, adapted for graph objects.
// SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH7: closed folders open to object leaves;
// leaf action is include/exclude; unreachable sources render unavailable.

import { FilesystemItem, type FilesystemNode } from '@/components/ui/filesystem-item';
import {
  CONTEXT_PROVENANCE_LABEL,
  type ContextEntry,
  type ContextFolder,
} from '@/lib/chat/context-types';

export interface ContextTreeProps {
  readonly folders: readonly ContextFolder[];
  readonly onToggleInclude: (entryId: string) => void;
}

function toNode(entry: ContextEntry, onToggleInclude: (id: string) => void): FilesystemNode {
  return {
    id: entry.id,
    name: entry.label,
    provenance: CONTEXT_PROVENANCE_LABEL[entry.provenance],
    included: entry.included,
    unavailable: entry.unavailable,
    onToggleInclude: entry.unavailable ? undefined : () => onToggleInclude(entry.id),
  };
}

function folderToNode(
  folder: ContextFolder,
  onToggleInclude: (id: string) => void,
): FilesystemNode {
  if (folder.unavailable) {
    return {
      id: folder.id,
      name: folder.label,
      nodes: [],
      unavailable: true,
      provenance: 'unreachable',
    };
  }
  return {
    id: folder.id,
    name: folder.label,
    nodes: folder.entries.map((entry) => toNode(entry, onToggleInclude)),
  };
}

export function ContextTree({ folders, onToggleInclude }: ContextTreeProps) {
  if (folders.length === 0) {
    return (
      <p className="px-2 py-1 text-ij-ink-disabled" role="status">
        No context attached to this thread.
      </p>
    );
  }

  return (
    <ul data-context-tree className="px-1" aria-label="Thread context">
      {folders.map((folder) => (
        <FilesystemItem
          key={folder.id}
          node={folderToNode(folder, onToggleInclude)}
          animated
        />
      ))}
    </ul>
  );
}
