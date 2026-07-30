'use client';

// SOURCING: cmdk for catalog search (PG6 drag-release / double-click palette).

import { useMemo, useState, type MouseEvent } from 'react';
import { Command } from 'cmdk';
import type { CatalogEntry } from '@commonplace/program-contracts';
import { catalogEntryAcceptsBoundary } from './connection';

export type NodePaletteProps = {
  readonly open: boolean;
  readonly entries: readonly CatalogEntry[];
  readonly boundaryShape?: string;
  readonly onSelect: (entry: CatalogEntry) => void;
  readonly onClose: () => void;
};

export function NodePalette({
  open,
  entries,
  boundaryShape,
  onSelect,
  onClose,
}: NodePaletteProps) {
  const [query, setQuery] = useState('');
  // When boundaryShape is set, `entries` is already server valid_next (PG6).
  // Client filter remains only as advisory search narrowing, not the law.
  const filtered = useMemo(() => {
    const base = boundaryShape
      ? entries.filter((entry) => catalogEntryAcceptsBoundary(entry, boundaryShape))
      : [...entries];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (entry) =>
        entry.id.toLowerCase().includes(q)
        || entry.group.toLowerCase().includes(q)
        || (entry.class_name?.toLowerCase().includes(q) ?? false),
    );
  }, [boundaryShape, entries, query]);

  if (!open) return null;

  const groups = new Map<string, CatalogEntry[]>();
  for (const entry of filtered) {
    const list = groups.get(entry.group) ?? [];
    list.push(entry);
    groups.set(entry.group, list);
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-ij-overlay/40 pt-24"
      role="dialog"
      aria-label="Insert program node"
      onClick={onClose}
    >
      <Command
        className="mx-4 w-full max-w-md overflow-hidden rounded-ij-arc border border-ij-seam bg-ij-raised shadow-none"
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={boundaryShape ? 'Compatible operations…' : 'All catalog operations…'}
          className="h-ij-control w-full border-b border-ij-seam bg-transparent px-3 text-ij-ink outline-none"
        />
        <Command.List className="max-h-80 overflow-auto p-1">
          <Command.Empty className="px-3 py-4 text-ij-ink-info">No matching operations.</Command.Empty>
          {[...groups.entries()].map(([group, items]) => (
            <Command.Group key={group} heading={group} className="px-1 py-1 text-xs text-ij-ink-info">
              {items.map((entry) => (
                <Command.Item
                  key={entry.id}
                  value={entry.id}
                  onSelect={() => onSelect(entry)}
                  className="cursor-pointer rounded-ij-arc px-2 py-1.5 text-sm text-ij-ink aria-selected:bg-ij-selection"
                >
                  <span className="font-ij-mono" data-mono-ok>{entry.id}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
