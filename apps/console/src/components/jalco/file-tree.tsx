'use client';

// SOURCING: jal-co/ui FileTree (ui.justinlevine.me/r/file-tree.json). Structure
// extraction + Int UI reskin. Icons are text glyphs (folder/file) so the
// console stays on noun-project discipline without lucide. ViewSource:
// package jal-co/ui, component FileTree, mode reskin, regime css-vars.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type FileTreeNode = {
  readonly name: string;
  readonly children?: readonly FileTreeNode[];
};

export type FileTreeProps = {
  readonly tree: readonly FileTreeNode[];
  readonly defaultExpanded?: readonly string[];
  readonly highlight?: readonly string[];
  readonly onSelect?: (path: string) => void;
  readonly className?: string;
};

function pathKey(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function TreeEntry({
  node,
  parent,
  depth,
  expanded,
  toggle,
  highlightSet,
  onSelect,
}: {
  readonly node: FileTreeNode;
  readonly parent: string;
  readonly depth: number;
  readonly expanded: ReadonlySet<string>;
  readonly toggle: (path: string) => void;
  readonly highlightSet: ReadonlySet<string>;
  readonly onSelect?: (path: string) => void;
}) {
  const path = pathKey(parent, node.name);
  const isDir = Boolean(node.children);
  const isOpen = expanded.has(path);
  const highlighted = highlightSet.has(path);

  return (
    <li>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1.5 px-2 py-1 text-left hover:bg-ij-hover-surface',
          highlighted ? 'bg-ij-selection text-ij-ink' : 'text-ij-ink',
        )}
        style={{ paddingLeft: `calc(var(--ij-tree-inset, 12px) + ${depth} * 12px)` }}
        onClick={() => {
          if (isDir) toggle(path);
          onSelect?.(path);
        }}
      >
        <span className="w-3 shrink-0 font-ij-mono text-ij-ink-info" aria-hidden="true">
          {isDir ? (isOpen ? '▾' : '▸') : '·'}
        </span>
        <span className="truncate text-ij-island-section">{node.name}</span>
      </button>
      {isDir && isOpen && node.children ? (
        <ul>
          {node.children.map((child) => (
            <TreeEntry
              key={pathKey(path, child.name)}
              node={child}
              parent={path}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              highlightSet={highlightSet}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FileTree({
  tree,
  defaultExpanded = [],
  highlight = [],
  onSelect,
  className,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));
  const highlightSet = useMemo(() => new Set(highlight), [highlight]);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div
      className={cn(
        'overflow-auto rounded-ij-arc border border-ij-seam-raised bg-ij-chrome',
        className,
      )}
    >
      <ul className="py-1">
        {tree.map((node) => (
          <TreeEntry
            key={node.name}
            node={node}
            parent=""
            depth={0}
            expanded={expanded}
            toggle={toggle}
            highlightSet={highlightSet}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}
