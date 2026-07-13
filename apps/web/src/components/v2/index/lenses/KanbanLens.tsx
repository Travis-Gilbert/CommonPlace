'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  FileText,
  Link2,
  Mic,
  SquareCheck,
  CircleHelp,
  TriangleAlert,
  CalendarClock,
  NotebookPen,
} from 'lucide-react';
import { indexRowKey, type IndexRow, type IndexRowKind } from '@/lib/commonplace/index-queries';
import type { LensProps } from '@/lib/v2/lenses/types';
import { groupRowsByDestination, refileTargetForColumn } from '@/lib/v2/lenses/kanban-columns';
import { TagChip } from '@/components/v2/TagChip';

/* Kanban lens: the filed rows as a board, columns = destinations, dragging a
   card to another column = a refile. Drag/drop is @dnd-kit (installed), not a
   hand-rolled engine; this file supplies the columns, the register theming, and
   the refile wiring. Themed to cr-*, cards carry the tag chips. Available only
   when the rows carry destinations (data-driven), so it never shows an empty
   single-column board. */

const KIND_GLYPH: Record<IndexRowKind, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  link: Link2,
  voice: Mic,
  task: SquareCheck,
  question: CircleHelp,
  tension: TriangleAlert,
  event: CalendarClock,
  note: NotebookPen,
};

function CardBody({ row, dragging }: { row: IndexRow; dragging?: boolean }) {
  const Glyph = KIND_GLYPH[row.kind] ?? FileText;
  return (
    <div
      className={`flex flex-col gap-cr-1 rounded-cr border border-cr-hairline bg-cr-top px-cr-2 py-cr-2 text-left ${
        dragging ? 'shadow-transient' : ''
      }`}
    >
      <span className="flex items-center gap-cr-1">
        <Glyph className="size-[13px] shrink-0 text-cr-ink-3" />
        <span className="min-w-0 flex-1 truncate font-cr-ui text-cr-small text-cr-ink">
          {row.title}
        </span>
      </span>
      {row.tags.length > 0 && (
        <span className="flex flex-wrap gap-cr-1">
          {row.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </span>
      )}
    </div>
  );
}

function Card({
  row,
  columnKey,
  selected,
  onSelect,
}: {
  row: IndexRow;
  columnKey: string;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: row.id,
    data: { fromColumnKey: columnKey },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(indexRowKey(row))}
      className={`w-full cursor-grab rounded-cr outline-none transition-shadow duration-chrome active:cursor-grabbing focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-2 ${
        isDragging ? 'opacity-40' : ''
      } ${selected ? '[&>div]:border-cr-ink-3 [&>div]:bg-cr-tint' : ''}`}
    >
      <CardBody row={row} />
    </button>
  );
}

function Column({
  columnKey,
  label,
  rows,
  selectedKey,
  onSelect,
}: {
  columnKey: string;
  label: string;
  rows: readonly IndexRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`flex h-full w-[15rem] shrink-0 flex-col rounded-cr border bg-cr-surface transition-colors duration-chrome ${
        isOver ? 'border-cr-signal' : 'border-cr-hairline'
      }`}
    >
      <header className="flex items-center gap-cr-2 border-b border-cr-hairline px-cr-2 py-cr-1">
        <span className="min-w-0 flex-1 truncate font-cr-mono text-cr-caption uppercase tracking-[0.06em] text-cr-ink-2">
          {label}
        </span>
        <span className="shrink-0 rounded-cr-sm bg-cr-ground px-cr-1 font-cr-mono text-cr-caption tabular-nums text-cr-ink-3">
          {rows.length}
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-cr-1 overflow-y-auto p-cr-1">
        {rows.map((row) => (
          <Card
            key={row.id}
            row={row}
            columnKey={columnKey}
            selected={indexRowKey(row) === selectedKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export function KanbanLens({ rows, selectedKey, onSelect, destinationFor, onRefileRow }: LensProps) {
  // The same item can land in more than one band; a board shows each card once,
  // and @dnd-kit needs unique draggable ids, so dedupe by id first.
  const deduped = useMemo(() => {
    const seen = new Set<string>();
    const out: IndexRow[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out;
  }, [rows]);

  const columns = useMemo(
    () => groupRowsByDestination(deduped, destinationFor),
    [deduped, destinationFor],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const activeRow = activeId ? deduped.find((r) => r.id === activeId) ?? null : null;

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const overId = event.over?.id;
    if (overId == null || !onRefileRow) return;
    const fromColumnKey = String(event.active.data.current?.fromColumnKey ?? '');
    const target = refileTargetForColumn(String(overId), fromColumnKey);
    if (target) onRefileRow(String(event.active.id), target);
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-cr-ground px-cr-3 text-center text-cr-small text-cr-ink-3">
        Nothing matches. Clear the filter, or widen the search.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-x-auto bg-cr-ground">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex h-full min-h-0 items-stretch gap-cr-2 p-cr-2">
          {columns.map((col) => (
            <Column
              key={col.key}
              columnKey={col.key}
              label={col.label}
              rows={col.rows}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
        <DragOverlay>
          {activeRow ? (
            <div className="w-[15rem]">
              <CardBody row={activeRow} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
