'use client';

// SOURCING: hand-roll on @dnd-kit/core + @dnd-kit/sortable. Completes
// HANDOFF-CONSOLE-ISLAND-SHELL IS5 / block-system B10: 12-column island grid
// with sortable rearrange. Promotion droppables are siblings supplied by
// IslandArrangementHost (stripe / chrome / surface).

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  hasHomogeneousIslandDefect,
  resolveIslandSurfaceClass,
} from '@commonplace/block-view/island-class';
import type { BlockSize, ViewDescriptor } from '@commonplace/block-view/types';
import { IslandShell, type IslandShellProps } from '@/components/blocks/IslandShell';
import { gridStyleForSize, snapToDeclaredSize } from '@/lib/island-grid';

export type IslandDropKind = 'grid' | 'stripe' | 'chrome' | 'surface';

export interface IslandGridItem {
  readonly descriptor: ViewDescriptor;
  readonly viewInstanceId: string;
  readonly size: BlockSize;
  readonly shell: Omit<IslandShellProps, 'descriptor' | 'viewInstanceId' | 'draggable'>;
}

export interface IslandPromotionZone {
  readonly id: string;
  readonly kind: Exclude<IslandDropKind, 'grid'>;
  readonly regionId: string;
  readonly label: string;
}

export interface IslandGridProps {
  readonly items: readonly IslandGridItem[];
  readonly promotionZones?: readonly IslandPromotionZone[];
  readonly onSizeChange?: (viewInstanceId: string, size: BlockSize) => void;
  readonly onReorder?: (activeId: string, overId: string | null) => void;
  readonly onPromote?: (
    viewInstanceId: string,
    zone: IslandPromotionZone,
  ) => void;
  readonly children?: ReactNode;
}

function SortableIslandCell({
  item,
  onSizeChange,
}: {
  readonly item: IslandGridItem;
  readonly onSizeChange?: (viewInstanceId: string, size: BlockSize) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `island:${item.viewInstanceId}`,
    data: {
      type: 'island',
      viewInstanceId: item.viewInstanceId,
      kind: 'grid' as const,
    },
  });
  const placement = gridStyleForSize(item.size);

  return (
    <div
      ref={setNodeRef}
      data-island-grid-cell={item.viewInstanceId}
      data-island-size={item.size}
      className="min-h-0 min-w-0"
      style={{
        ...placement,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      onMouseUp={(event) => {
        if (!onSizeChange) return;
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const spanCols = placement.gridColumn.includes('span')
          ? Number(placement.gridColumn.replace('span ', ''))
          : 1;
        const colW = rect.width / Math.max(1, spanCols);
        const next = snapToDeclaredSize(
          rect.width,
          rect.height,
          item.descriptor.block?.sizes ?? [item.size],
          colW || rect.width / 4,
        );
        if (next !== item.size) onSizeChange(item.viewInstanceId, next);
      }}
    >
      <IslandShell
        {...item.shell}
        descriptor={item.descriptor}
        viewInstanceId={item.viewInstanceId}
        draggable={false}
        actions={
          <>
            <button
              ref={setActivatorNodeRef}
              type="button"
              data-island-drag-handle
              aria-label="Drag island"
              title="Drag island"
              className="inline-flex size-6 items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
              {...attributes}
              {...listeners}
            >
              ⠿
            </button>
            {item.shell.actions}
          </>
        }
      />
    </div>
  );
}

function PromotionDropZone({ zone }: { readonly zone: IslandPromotionZone }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `promote:${zone.kind}:${zone.regionId}`,
    data: { type: 'promote', zone },
  });
  return (
    <div
      ref={setNodeRef}
      data-island-promote={zone.kind}
      data-promote-region={zone.regionId}
      className={`flex min-h-10 items-center justify-center rounded-ij-arc border border-dashed px-2 text-ij-island-meta ${
        isOver
          ? 'border-ij-accent bg-ij-selection text-ij-ink'
          : 'border-ij-seam-raised text-ij-ink-info'
      }`}
    >
      {zone.label}
    </div>
  );
}

/**
 * Island mounts on the 12-column grid. Sortable cells rearrange via onReorder;
 * promotion zones accept island drops for stripe / chrome / surface emits.
 */
export function IslandGrid({
  items,
  promotionZones = [],
  onSizeChange,
  onReorder,
  onPromote,
}: IslandGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const sortableIds = useMemo(
    () => items.map((item) => `island:${item.viewInstanceId}`),
    [items],
  );

  if (process.env.NODE_ENV !== 'production') {
    const classes = items.map(
      (item) =>
        item.shell.surfaceClass ??
        resolveIslandSurfaceClass(item.descriptor.block?.surfaceClass),
    );
    if (hasHomogeneousIslandDefect(classes)) {
      console.error(
        `[IslandGrid] homogeneous island defect: ${items.length} islands with fewer than two base classes (${classes.join(', ')})`,
      );
    }
  }

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id).replace(/^island:/, ''));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const activeIslandId = String(event.active.id).replace(/^island:/, '');
      const over = event.over;
      if (!over) return;
      const overData = over.data.current as
        | { type?: string; zone?: IslandPromotionZone; viewInstanceId?: string }
        | undefined;
      if (overData?.type === 'promote' && overData.zone) {
        onPromote?.(activeIslandId, overData.zone);
        return;
      }
      const overId = String(over.id).replace(/^island:/, '');
      if (overId !== activeIslandId) onReorder?.(activeIslandId, overId);
    },
    [onPromote, onReorder],
  );

  const activeItem = items.find((item) => item.viewInstanceId === activeId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {promotionZones.length > 0 ? (
        <div data-island-promote-rail className="mb-2 flex flex-wrap gap-2">
          {promotionZones.map((zone) => (
            <PromotionDropZone key={zone.id} zone={zone} />
          ))}
        </div>
      ) : null}
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <div
          data-island-grid
          className="grid h-full min-h-0 w-full gap-ij-island-gutter"
          style={{
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gridAutoRows: 'minmax(72px, auto)',
          }}
        >
          {items.map((item) => (
            <SortableIslandCell key={item.viewInstanceId} item={item} onSizeChange={onSizeChange} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div className="rounded-ij-arc border border-ij-accent bg-ij-chrome px-3 py-2 text-ij-ink opacity-90">
            {activeItem.shell.title ?? activeItem.descriptor.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
