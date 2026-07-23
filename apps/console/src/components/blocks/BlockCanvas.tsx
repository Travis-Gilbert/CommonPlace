'use client';

// SOURCING: hand-roll on @dnd-kit/core + @dnd-kit/sortable. Completes
// HANDOFF-CONSOLE-ONE-BLOCK-MODEL OB3: free BlockGeometry with edge/corner
// resize clamped by limits. Placement zones remain for rail / dock / full.

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
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  hasHomogeneousBlockDefect,
  resolveBlockSurfaceClass,
} from '@commonplace/block-view';
import type { BlockGeometry, BlockPlacement, BlockSize, ViewDescriptor } from '@commonplace/block-view/types';
import { BlockShell, type BlockShellProps } from '@/components/blocks/BlockShell';
import {
  BLOCK_ROW_UNIT_PX,
  CANVAS_COLS,
  clampGeometry,
  gridStyleForGeometry,
} from '@/lib/block-geometry';
import { createBlockCollisionDetection } from '@/lib/block-collision';

export type BlockDropKind = 'ground' | 'rail' | 'dock' | 'full';

export interface BlockCanvasItem {
  readonly descriptor: ViewDescriptor;
  readonly viewInstanceId: string;
  readonly size: BlockSize;
  readonly geometry: BlockGeometry;
  readonly shell: Omit<BlockShellProps, 'descriptor' | 'viewInstanceId' | 'draggable'>;
}

export interface BlockPlacementZone {
  readonly id: string;
  readonly kind: Exclude<BlockDropKind, 'ground'>;
  readonly regionId: string;
  readonly label: string;
}

export interface BlockCanvasProps {
  readonly items: readonly BlockCanvasItem[];
  readonly promotionZones?: readonly BlockPlacementZone[];
  readonly onGeometryChange?: (viewInstanceId: string, geometry: BlockGeometry) => void;
  readonly onReorder?: (activeId: string, overId: string | null) => void;
  readonly onPromote?: (
    viewInstanceId: string,
    zone: BlockPlacementZone,
  ) => void;
  /** Nest under an acceptsChildren container (durable CONTAINS parenting). */
  readonly onNest?: (
    childId: string,
    containerId: string,
    columnId: string,
  ) => void;
  readonly children?: ReactNode;
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function applyEdgeDelta(
  geometry: BlockGeometry,
  edge: ResizeEdge,
  dCol: number,
  dRow: number,
): BlockGeometry {
  let { col, row, colSpan, rowSpan } = geometry;
  if (edge.includes('e')) colSpan += dCol;
  if (edge.includes('w')) {
    col += dCol;
    colSpan -= dCol;
  }
  if (edge.includes('s')) rowSpan += dRow;
  if (edge.includes('n')) {
    row += dRow;
    rowSpan -= dRow;
  }
  return { col, row, colSpan, rowSpan };
}

function ResizeHandle({
  edge,
  onResizeStart,
}: {
  readonly edge: ResizeEdge;
  readonly onResizeStart: (edge: ResizeEdge, event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const cursor =
    edge === 'n' || edge === 's'
      ? 'ns-resize'
      : edge === 'e' || edge === 'w'
        ? 'ew-resize'
        : edge === 'ne' || edge === 'sw'
          ? 'nesw-resize'
          : 'nwse-resize';
  const position: Record<string, string | number> = {
    position: 'absolute',
    zIndex: 2,
  };
  if (edge.includes('n')) {
    position.top = 0;
    position.height = 8;
  }
  if (edge.includes('s')) {
    position.bottom = 0;
    position.height = 8;
  }
  if (edge.includes('e')) {
    position.right = 0;
    position.width = 8;
  }
  if (edge.includes('w')) {
    position.left = 0;
    position.width = 8;
  }
  if (edge === 'n' || edge === 's') {
    position.left = 8;
    position.right = 8;
    position.width = 'auto';
  }
  if (edge === 'e' || edge === 'w') {
    position.top = 8;
    position.bottom = 8;
    position.height = 'auto';
  }
  if (edge.length === 2) {
    position.width = 12;
    position.height = 12;
  }

  return (
    <button
      type="button"
      data-block-resize={edge}
      aria-label={`Resize ${edge}`}
      className="border-0 bg-transparent p-0"
      style={{ ...position, cursor }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onResizeStart(edge, event);
      }}
    />
  );
}

function SortableBlockCanvasCell({
  item,
  onGeometryChange,
}: {
  readonly item: BlockCanvasItem;
  readonly onGeometryChange?: (viewInstanceId: string, geometry: BlockGeometry) => void;
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
    id: `block:${item.viewInstanceId}`,
    data: {
      type: 'block',
      viewInstanceId: item.viewInstanceId,
      kind: 'ground' as const,
      descriptorId: item.descriptor.id,
    },
  });
  const cellRef = useRef<HTMLDivElement | null>(null);
  const activeResizeCleanup = useRef<(() => void) | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<BlockGeometry | null>(null);
  const displayGeometry = previewGeometry ?? item.geometry;
  const placement = gridStyleForGeometry(displayGeometry);
  const limits = item.descriptor.block?.limits;

  useEffect(() => {
    return () => {
      activeResizeCleanup.current?.();
      activeResizeCleanup.current = null;
    };
  }, []);

  const onResizeStart = useCallback(
    (edge: ResizeEdge, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!onGeometryChange) return;
      activeResizeCleanup.current?.();
      const startX = event.clientX;
      const startY = event.clientY;
      const start = item.geometry;
      const cell = cellRef.current;
      const colW = cell ? cell.getBoundingClientRect().width / Math.max(1, start.colSpan) : 80;
      const rowH = BLOCK_ROW_UNIT_PX;
      let latest = start;

      const onMove = (moveEvent: PointerEvent) => {
        const dCol = Math.round((moveEvent.clientX - startX) / colW);
        const dRow = Math.round((moveEvent.clientY - startY) / rowH);
        if (dCol === 0 && dRow === 0) return;
        latest = clampGeometry(applyEdgeDelta(start, edge, dCol, dRow), limits);
        setPreviewGeometry(latest);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        activeResizeCleanup.current = null;
        setPreviewGeometry(null);
        if (
          latest.col !== start.col ||
          latest.row !== start.row ||
          latest.colSpan !== start.colSpan ||
          latest.rowSpan !== start.rowSpan
        ) {
          onGeometryChange(item.viewInstanceId, latest);
        }
      };
      activeResizeCleanup.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [item.geometry, item.viewInstanceId, limits, onGeometryChange],
  );

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        cellRef.current = node;
      }}
      data-block-canvas-cell={item.viewInstanceId}
      data-block-size={item.size}
      data-block-col={displayGeometry.col}
      data-block-row={displayGeometry.row}
      data-block-col-span={displayGeometry.colSpan}
      data-block-row-span={displayGeometry.rowSpan}
      className="relative min-h-0 min-w-0"
      style={{
        ...placement,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
    >
      <BlockShell
        {...item.shell}
        descriptor={item.descriptor}
        viewInstanceId={item.viewInstanceId}
        draggable={false}
        headerDragRef={setActivatorNodeRef}
        headerDragListeners={listeners}
        headerDragAttributes={attributes}
        actions={item.shell.actions}
      />
      {(
        [
          'n',
          's',
          'e',
          'w',
          'ne',
          'nw',
          'se',
          'sw',
        ] as const
      ).map((edge) => (
        <ResizeHandle key={edge} edge={edge} onResizeStart={onResizeStart} />
      ))}
    </div>
  );
}

function PromotionDropZone({ zone }: { readonly zone: BlockPlacementZone }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `promote:${zone.kind}:${zone.regionId}`,
    data: { type: 'promote', zone },
  });
  return (
    <div
      ref={setNodeRef}
      data-block-promote={zone.kind}
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
 * Ground blocks use the 12-column free-geometry canvas. Sortable cells
 * rearrange via onReorder; placement zones accept rail, dock, and full emits.
 */
export function BlockCanvas({
  items,
  promotionZones = [],
  onGeometryChange,
  onReorder,
  onPromote,
  onNest,
}: BlockCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const collisionDetection = useMemo(() => createBlockCollisionDetection(), []);
  const sortableIds = useMemo(
    () => items.map((item) => `block:${item.viewInstanceId}`),
    [items],
  );

  if (process.env.NODE_ENV !== 'production') {
    const classes = items.map(
      (item) =>
        item.shell.surfaceClass ??
        resolveBlockSurfaceClass(item.descriptor.block?.surfaceClass),
    );
    if (hasHomogeneousBlockDefect(classes)) {
      console.error(
        `[BlockCanvas] homogeneous block defect: ${items.length} blocks with fewer than two base classes (${classes.join(', ')})`,
      );
    }
  }

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id).replace(/^block:/, ''));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const activeBlockId = String(event.active.id).replace(/^block:/, '');
      const over = event.over;
      if (!over) return;
      const overData = over.data.current as
        | {
            type?: string;
            zone?: BlockPlacementZone;
            viewInstanceId?: string;
            columnId?: string;
            acceptsChildren?: boolean;
          }
        | undefined;
      if (overData?.type === 'promote' && overData.zone) {
        const activeItem = items.find((item) => item.viewInstanceId === activeBlockId);
        const placements = activeItem?.descriptor.block?.placements;
        const zoneKind = overData.zone.kind as BlockPlacement;
        if (!placements?.includes(zoneKind)) return;
        onPromote?.(activeBlockId, overData.zone);
        return;
      }
      if (overData?.type === 'container' && overData.acceptsChildren) {
        const containerId = overData.viewInstanceId;
        if (containerId && containerId !== activeBlockId) {
          onNest?.(activeBlockId, containerId, overData.columnId ?? 'todo');
        }
        return;
      }
      const overId = String(over.id).replace(/^block:/, '');
      if (overId !== activeBlockId) onReorder?.(activeBlockId, overId);
    },
    [items, onNest, onPromote, onReorder],
  );

  const activeItem = items.find((item) => item.viewInstanceId === activeId) ?? null;
  const activePlacements = activeItem?.descriptor.block?.placements;
  const visiblePromotionZones = useMemo(() => {
    if (!activeId || !activePlacements) return promotionZones;
    return promotionZones.filter((zone) =>
      activePlacements.includes(zone.kind as BlockPlacement),
    );
  }, [activeId, activePlacements, promotionZones]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {visiblePromotionZones.length > 0 ? (
        <div data-block-placement-rail className="mb-2 flex flex-wrap gap-2">
          {visiblePromotionZones.map((zone) => (
            <PromotionDropZone key={zone.id} zone={zone} />
          ))}
        </div>
      ) : null}
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <div
          data-block-canvas
          className="grid h-full min-h-0 w-full gap-ij-island-gutter"
          style={{
            gridTemplateColumns: `repeat(${CANVAS_COLS}, minmax(0, 1fr))`,
            gridAutoRows: `minmax(${BLOCK_ROW_UNIT_PX}px, auto)`,
          }}
        >
          {items.map((item) => (
            <SortableBlockCanvasCell
              key={item.viewInstanceId}
              item={item}
              onGeometryChange={onGeometryChange}
            />
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
