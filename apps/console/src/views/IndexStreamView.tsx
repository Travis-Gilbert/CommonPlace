'use client';

// SOURCING: @dnd-kit/core (drag-to-correct), @tanstack/react-virtual (ribbon
// virtualization), motion/react (the undo toast entrance, inventoried).
//
// F1 and F2: the Index proper. Shelves as calm drop targets, the recently-filed
// ribbon below them, and the digest on demand.
//
// Two absences are the design, not an omission:
//   1. No badge, no counter, no dot, anywhere in this tree. The wire contract
//      carries no count for one to be rendered from, and an e2e assertion
//      checks the rendered component tree.
//   2. No queue. The ribbon is a trailing time window that empties itself. It
//      exists to make corrections effortless, and an item that has aged out is
//      not unfinished business, it is filed.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'motion/react';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import type { FiledItem, FilingReceipt, IndexCollection } from '@/lib/filing/types';
import { withinRibbonWindow } from '@/lib/filing/types';
import { ViewState } from './ViewStates';
import { FilingReceiptPopover } from './filing/FilingReceiptPopover';
import {
  correctFiling,
  undoFiling,
  useFilingDigest,
  useFilingIndex,
} from './filing/filing-client';
import { useMotionDurations } from '@/motion/motion-tokens';
import { IconRecords } from '@/components/shell/icons';

interface UndoOffer {
  readonly item: string;
  readonly title: string;
  readonly from: string;
  readonly receipt: FilingReceipt;
}

/** How long the undo offer stands. Long enough to notice, short enough that it
 *  is not a second inbox sitting at the bottom of the screen. */
const UNDO_WINDOW_MS = 12_000;

function shelfName(collections: readonly IndexCollection[], id: string): string {
  return collections.find((collection) => collection.id === id)?.name ?? id;
}

/** A shelf: a drop target and nothing else. No count, by design. */
function Shelf({
  collection,
  activeItem,
}: {
  readonly collection: IndexCollection;
  readonly activeItem: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: collection.id });
  return (
    <div
      ref={setNodeRef}
      data-filing-shelf={collection.id}
      data-filing-shelf-over={isOver ? 'true' : undefined}
      className="flex h-ij-row min-w-32 items-center gap-2 border border-ij-seam-raised bg-ij-raised px-2 text-ij-ink data-[filing-shelf-over=true]:bg-ij-selection"
      style={{ transition: 'var(--rec-clickable-transition)' }}
      aria-dropeffect={activeItem ? 'move' : undefined}
    >
      <IconRecords size={14} className="shrink-0 text-ij-ink-info" />
      <span className="truncate">{collection.name}</span>
    </div>
  );
}

function RibbonRow({
  entry,
  collections,
  onCorrect,
}: {
  readonly entry: FiledItem;
  readonly collections: readonly IndexCollection[];
  readonly onCorrect: (item: FiledItem, to: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.item });
  return (
    <div
      data-filing-ribbon-item={entry.item}
      className="flex h-ij-row items-center gap-2 border-b border-ij-seam px-2 text-ij-ink hover:bg-ij-hover-surface"
      style={{ transition: 'var(--rec-clickable-transition)', opacity: isDragging ? 0.6 : 1 }}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Move ${entry.title}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="truncate">{entry.title}</span>
        <span className="shrink-0 text-ij-ink-info">
          {shelfName(collections, entry.destination)}
        </span>
      </button>
      <FilingReceiptPopover
        receipt={entry.receipt}
        collections={collections}
        onCorrect={(to) => onCorrect(entry, to)}
      />
    </div>
  );
}

/** F2: a "what arrived" view, pulled never pushed. Rendering it generates no
 *  notification and no count; it is a question a person asked. */
function Digest({ collections }: { readonly collections: readonly IndexCollection[] }) {
  const state = useFilingDigest();
  if (state.status === 'loading') return <ViewState state="loading" />;
  if (state.status === 'unavailable') {
    return <ViewState state="unavailable" capability={state.capability} />;
  }
  if (state.status === 'error') return <ViewState state="error" errorMessage={state.message} />;
  if (state.data.groups.length === 0) {
    return (
      <p className="p-4 text-ij-ink-info" data-filing-digest-empty>
        Nothing arrived in this window.
      </p>
    );
  }
  return (
    <div data-filing-digest className="min-h-0 flex-1 overflow-y-auto">
      {state.data.groups.map((group) => (
        <section key={group.destination.id} data-filing-digest-group={group.destination.id}>
          <h3 className="flex h-ij-row items-center border-b border-ij-seam bg-ij-chrome px-2 text-ij-ink">
            {group.destination.name}
          </h3>
          <ul>
            {group.items.map((entry) => (
              <li
                key={entry.item}
                className="flex h-ij-row items-center gap-2 border-b border-ij-seam px-2 text-ij-ink"
              >
                <span className="truncate">{entry.title}</span>
                <FilingReceiptPopover
                  receipt={entry.receipt}
                  collections={collections}
                  onCorrect={() => undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function IndexStreamView(_props: ViewRenderProps) {
  const { state, refresh } = useFilingIndex();
  const [undoOffer, setUndoOffer] = useState<UndoOffer | null>(null);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [showDigest, setShowDigest] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const durations = useMotionDurations();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // The ribbon is time-boxed: an item outside the window has aged out and is
  // simply filed. Recomputed on render rather than on a timer, because a timer
  // that ticks a list is the beginning of a queue.
  const nowMs = Date.now();
  const collections = state.status === 'ready' ? state.data.collections : [];
  const ribbon = useMemo(
    () =>
      state.status === 'ready'
        ? state.data.recentlyFiled.filter((entry) => withinRibbonWindow(entry, nowMs))
        : [],
    [state, nowMs],
  );

  const virtualizer = useVirtualizer({
    count: ribbon.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });

  const applyCorrection = useCallback(
    async (entry: FiledItem, to: string) => {
      if (to === entry.destination) return;
      try {
        const result = await correctFiling(entry.item, to);
        setFailure(null);
        setUndoOffer({
          item: entry.item,
          title: entry.title,
          from: entry.destination,
          receipt: result.receipt,
        });
        refresh();
      } catch (error) {
        setFailure(error instanceof Error ? error.message : 'filing_request_failed');
      }
    },
    [refresh],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);
      const destination = event.over?.id;
      if (typeof destination !== 'string') return;
      const entry = ribbon.find((candidate) => candidate.item === event.active.id);
      if (entry) void applyCorrection(entry, destination);
    },
    [ribbon, applyCorrection],
  );

  useEffect(() => {
    if (!undoOffer) return undefined;
    const timer = window.setTimeout(() => setUndoOffer(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [undoOffer]);

  const reverse = useCallback(async () => {
    if (!undoOffer) return;
    try {
      await undoFiling(undoOffer.item);
      setUndoOffer(null);
      setFailure(null);
      refresh();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'filing_request_failed');
    }
  }, [undoOffer, refresh]);

  if (state.status === 'loading') return <ViewState state="loading" />;
  if (state.status === 'unavailable') {
    return <ViewState state="unavailable" capability={state.capability} />;
  }
  if (state.status === 'error') {
    return <ViewState state="error" errorMessage={state.message} onRetry={refresh} />;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveItem(String(event.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveItem(null)}
    >
      <div
        data-filing-index
        data-paint-region="filing-index"
        className="flex h-full min-h-0 flex-col bg-ij-editor font-ij-ui"
      >
        <div className="flex h-ij-toolwindow-header shrink-0 items-center justify-between border-b border-ij-seam bg-ij-chrome px-2 text-ij-ink">
          <span>{showDigest ? 'What arrived' : 'Recently filed'}</span>
          <button
            type="button"
            data-filing-digest-toggle
            onClick={() => setShowDigest((value) => !value)}
            className="text-ij-ink-info hover:text-ij-ink"
          >
            {showDigest ? 'Ribbon' : 'Digest'}
          </button>
        </div>

        <div
          data-filing-shelves
          className="flex shrink-0 flex-wrap gap-1 border-b border-ij-seam bg-ij-chrome p-2"
        >
          {collections.length === 0 ? (
            <p className="text-ij-ink-info">No shelves yet. The first arrival makes one.</p>
          ) : (
            collections.map((collection) => (
              <Shelf key={collection.id} collection={collection} activeItem={activeItem} />
            ))
          )}
        </div>

        {showDigest ? (
          <Digest collections={collections} />
        ) : ribbon.length === 0 ? (
          <p className="p-4 text-ij-ink-info" data-filing-ribbon-empty>
            Nothing filed recently. Everything that arrived is already on a shelf.
          </p>
        ) : (
          <div ref={scrollRef} data-filing-ribbon className="min-h-0 flex-1 overflow-y-auto">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const entry = ribbon[virtualRow.index];
                return (
                  <div
                    key={entry.item}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <RibbonRow
                      entry={entry}
                      collections={collections}
                      onCorrect={(target, to) => void applyCorrection(target, to)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {failure ? (
          <p
            role="alert"
            data-filing-failure
            className="shrink-0 border-t border-ij-seam bg-ij-error-bg px-2 py-1 text-ij-error"
          >
            {failure}
          </p>
        ) : null}

        {undoOffer ? (
          <motion.div
            data-filing-undo-toast={undoOffer.item}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.fast / 1000 }}
            className="flex h-ij-control shrink-0 items-center justify-between gap-2 border-t border-ij-seam bg-ij-raised px-2 text-ij-ink"
          >
            <span className="truncate">
              Filed {undoOffer.title} in {shelfName(collections, undoOffer.receipt.destination)}
            </span>
            <button
              type="button"
              data-filing-undo
              onClick={() => void reverse()}
              className="shrink-0 text-ij-link hover:underline"
            >
              Undo
            </button>
          </motion.div>
        ) : null}
      </div>
    </DndContext>
  );
}
