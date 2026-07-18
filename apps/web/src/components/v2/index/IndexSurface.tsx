'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  allRows,
  destinationsFromData,
  indexRowKey,
  isNeedsYou,
  rowDestinationKey,
  rowMatchesQuery,
  submitRefile,
  useIndexData,
  useWatchQueries,
  watchQueryCount,
  type IndexRow,
  type IndexRowDestination,
} from '@/lib/commonplace/index-queries';
import { IndexDetail } from './IndexDetail';
import { IndexRail } from './IndexRail';
import { IndexComposition } from './IndexComposition';

/* Index chassis (HANDOFF-INDEX-SURFACE D1): the list|detail split. The app rail
   is pane 1 (V2Shell, collapsible); this owns panes 2 and 3. Pane sizes persist
   across reload via react-resizable-panels' native autoSaveId (localStorage) --
   no separate store needed. Focus order is rail -> list -> detail by DOM order.

   This island also owns selection and the refile overrides (D5): a correction
   updates the list and detail immediately and emits a feedback signal, with the
   prior destination retained so Undo restores it. */

interface RefileOverride {
  destination: IndexRowDestination;
  receipt: string;
  collectionId?: string;
}

function eventTimestamp(): number {
  return Date.now();
}

const TAB =
  'cursor-pointer rounded-cr-sm px-cr-2 py-[3px] font-cr-ui text-cr-small text-cr-ink-3 ' +
  'transition-colors duration-chrome ease-cr hover:text-cr-ink aria-pressed:bg-cr-top ' +
  'aria-pressed:text-cr-ink focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1';

const PANEL = 'flex min-h-0 min-w-0 flex-col';
const HANDLE =
  'group/handle relative flex w-[9px] shrink-0 items-stretch justify-center outline-none';
const HANDLE_SEAM =
  'w-px bg-cr-hairline transition-colors duration-chrome ease-cr group-hover/handle:bg-cr-ink-3 ' +
  'group-focus-visible/handle:bg-cr-signal group-data-[resize-handle-state=drag]/handle:bg-cr-signal';

export function IndexSurface() {
  const data = useIndexData();
  const rows = allRows(data);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RefileOverride>>({});

  // Shared stream filters, lifted so the rail and the list agree. The rail
  // selects a destination; a watch query drops a saved search back into the
  // same search field. The list still owns the All / Needs-you toggle.
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'needs'>('all');
  const [activeDestination, setActiveDestination] = useState<string | null>(null);
  const watch = useWatchQueries();

  // The effective destination of a row, applying an optimistic refile override so
  // the rail filter, the rail counts, and every lens agree with the edit before a
  // refetch lands. destinationKeyFor mirrors rowDestinationKey but prefers the
  // override's resolved collection id (else its label), so a refiled row moves
  // between rail buckets immediately.
  const destinationFor = (row: IndexRow): IndexRowDestination | null =>
    overrides[row.id]?.destination ?? row.destination;
  const destinationKeyFor = (row: IndexRow): string | null => {
    const override = overrides[row.id];
    if (override) return override.collectionId ?? override.destination.label;
    return rowDestinationKey(row);
  };
  const destinations = destinationsFromData(data, destinationFor, destinationKeyFor);

  // The shell owns the filters; every lens in the composition renders the same
  // filtered rows. (Per-widget queries join this when widgets bind to their own
  // scope; v1 binds them all to the Index query.)
  const filteredRows = rows.filter((row) => {
    if (tab === 'needs' && !isNeedsYou(row)) return false;
    if (activeDestination !== null && destinationKeyFor(row) !== activeDestination) return false;
    return rowMatchesQuery(row, query);
  });

  const selectDestination = (key: string | null) => {
    setActiveDestination(key);
  };
  const applyWatch = (q: string) => {
    setQuery(q);
    setActiveDestination(null);
  };

  const selected = rows.find((r) => indexRowKey(r) === selectedKey) ?? null;

  const handleRefile = (label: string) => {
    if (!selected) return;
    const prev = destinationFor(selected);
    const verb = prev?.verb ?? 'filed to';
    setOverrides((current) => ({
      ...current,
      [selected.id]: { destination: { verb, label }, receipt: `Refiled to ${label}.` },
    }));
    void submitRefile(selected.id, label, selected.title, selected.destinationId).then(
      (collectionId) => {
        if (!collectionId) return;
        setOverrides((current) => {
          const currentOverride = current[selected.id];
          if (!currentOverride || currentOverride.destination.label !== label) return current;
          return {
            ...current,
            [selected.id]: { ...currentOverride, collectionId },
          };
        });
      },
    );
  };

  // Refile any row by id (the Board lens dragging a card to another column),
  // not just the selected one. Same edit + training signal as the inspector's
  // Refile, keyed by the dragged card instead of the selection.
  const handleRefileRow = (rowId: string, label: string) => {
    const target = rows.find((r) => r.id === rowId);
    if (!target) return;
    const prev = destinationFor(target);
    const verb = prev?.verb ?? 'filed to';
    setOverrides((current) => ({
      ...current,
      [rowId]: { destination: { verb, label }, receipt: `Refiled to ${label}.` },
    }));
    void submitRefile(rowId, label, target.title, target.destinationId).then((collectionId) => {
      if (!collectionId) return;
      setOverrides((current) => {
        const currentOverride = current[rowId];
        if (!currentOverride || currentOverride.destination.label !== label) return current;
        return { ...current, [rowId]: { ...currentOverride, collectionId } };
      });
    });
  };

  const handleUndo = () => {
    if (!selected) return;
    const original = selected.destination; // the pre-refile destination
    const current = destinationFor(selected);
    const currentOverride = overrides[selected.id];
    setOverrides((current) => {
      const next = { ...current };
      delete next[selected.id];
      return next;
    });
    // Restore the prior edge everywhere: refile back to the original destination
    // so peer surfaces (and the session override) revert too.
    if (original) {
      void submitRefile(
        selected.id,
        original.label,
        selected.title,
        currentOverride?.collectionId,
        current?.label,
      );
    }
  };

  // Toolbar actions and composer are observable signals today; the durable
  // handlers (open, ask, resolve, agent turn) are Codex's backend seam. Fire a
  // CustomEvent so the dispatch is real and other surfaces can bind it.
  const emit = (type: string, extra: Record<string, unknown>) => {
    if (!selected || typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent(type, { detail: { id: selected.id, at: eventTimestamp(), ...extra } }),
      );
    } catch {
      /* best-effort */
    }
  };
  const handleAction = (action: string) => emit('commonplace:action', { action });
  const handleCompose = (text: string) => emit('commonplace:compose', { text });

  const selectedReceipt = selected ? overrides[selected.id]?.receipt ?? null : null;

  return (
    <PanelGroup direction="horizontal" autoSaveId="v2-index-panes-3" className="min-h-0 flex-1">
      <Panel order={1} defaultSize={18} minSize={13} maxSize={30} className={PANEL}>
        <IndexRail
          destinations={destinations}
          totalCount={rows.length}
          activeDestination={activeDestination}
          onSelectDestination={selectDestination}
          watchQueries={watch.queries}
          countForQuery={(q) => watchQueryCount(data, q)}
          activeQuery={query}
          onApplyWatch={applyWatch}
          onSaveWatch={(label) => watch.save(label, query)}
          onRemoveWatch={watch.remove}
        />
      </Panel>
      <PanelResizeHandle className={HANDLE} aria-label="Resize the destination rail">
        <span className={HANDLE_SEAM} />
      </PanelResizeHandle>
      <Panel order={2} defaultSize={52} minSize={36} className={PANEL}>
        <div className="flex items-center gap-cr-3 border-b border-cr-hairline bg-cr-surface px-cr-3 py-cr-2">
          <div
            role="group"
            aria-label="Filter"
            className="inline-flex gap-[2px] rounded-cr bg-cr-ground p-[3px]"
          >
            <button
              type="button"
              aria-pressed={tab === 'all'}
              onClick={() => setTab('all')}
              className={TAB}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={tab === 'needs'}
              onClick={() => setTab('needs')}
              className={TAB}
            >
              Needs you
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the index"
            aria-label="Search the index"
            className="min-w-0 flex-1 rounded-cr border border-cr-hairline bg-cr-top px-cr-2 py-[6px] font-cr-ui text-cr-small text-cr-ink placeholder:text-cr-ink-3 focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-0"
          />
        </div>
        <div className="min-h-0 flex-1">
          <IndexComposition
            rows={filteredRows}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            destinationFor={destinationFor}
            onRefileRow={handleRefileRow}
          />
        </div>
      </Panel>
      <PanelResizeHandle className={HANDLE} aria-label="Resize the detail pane">
        <span className={HANDLE_SEAM} />
      </PanelResizeHandle>
      <Panel order={3} defaultSize={30} minSize={24} className={PANEL}>
        <IndexDetail
          key={selected ? indexRowKey(selected) : 'empty'}
          row={selected}
          destination={selected ? destinationFor(selected) : null}
          receipt={selectedReceipt}
          onRefile={handleRefile}
          onUndo={handleUndo}
          onAction={handleAction}
          onCompose={handleCompose}
        />
      </Panel>
    </PanelGroup>
  );
}
