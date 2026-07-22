// SOURCING: none. Pure helpers for block reorder and placement emits.

import type {
  BlockGeometry,
  BlockSize,
  JsonValue,
  ObjectAction,
  ObjectRef,
} from '@commonplace/block-view/types';
import {
  moveSurfaceNodeAction,
  updateViewInstanceConfigAction,
} from '@commonplace/block-view/surface-actions';
import { clampGeometry, geometryFromSize } from '@/lib/block-geometry';

export type BlockPlacementTarget =
  | { readonly placement: 'ground'; readonly regionId: string; readonly order: number }
  | { readonly placement: 'rail'; readonly regionId: string; readonly order: number }
  | { readonly placement: 'dock'; readonly regionId: string; readonly order: number }
  | {
      readonly placement: 'full';
      readonly regionId: string;
      readonly order: number;
      readonly size?: BlockSize;
      readonly geometry?: BlockGeometry;
    };

/** Reorder within a grid: move active before over (or to end when over is null). */
export function reorderBlockActions(
  parentRegionId: string,
  orderedIds: readonly string[],
  activeId: string,
  overId: string | null,
): ObjectAction[] {
  const without = orderedIds.filter((id) => id !== activeId);
  let insertAt = without.length;
  if (overId) {
    const overIndex = without.indexOf(overId);
    if (overIndex >= 0) insertAt = overIndex;
  }
  const next = [...without.slice(0, insertAt), activeId, ...without.slice(insertAt)];
  return next.map((id, index) => moveSurfaceNodeAction(id, parentRegionId, index));
}

/** Persist named size (reset affordance) and optional free geometry. */
export function resizeBlockAction(
  viewInstanceId: string,
  size: BlockSize,
  geometry?: BlockGeometry,
  existingConfig: Readonly<Record<string, JsonValue>> = {},
): ObjectAction {
  return updateViewInstanceConfigAction(viewInstanceId, {
    ...existingConfig,
    size,
    ...(geometry ? { geometry } : {}),
  });
}

export function setBlockGeometryAction(
  viewInstanceId: string,
  geometry: BlockGeometry,
  existingConfig: Readonly<Record<string, JsonValue>> = {},
): ObjectAction {
  return updateViewInstanceConfigAction(viewInstanceId, {
    ...existingConfig,
    geometry,
  });
}

export type KanbanColumnId = 'todo' | 'doing' | 'done';

export function readKanbanColumn(instance: ObjectRef): KanbanColumnId {
  const config = instance.properties.config;
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const column = (config as Record<string, JsonValue>).kanbanColumn;
    if (column === 'todo' || column === 'doing' || column === 'done') return column;
  }
  return 'todo';
}

export function readConfigRecord(instance: ObjectRef): Record<string, JsonValue> {
  const config = instance.properties.config;
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    return { ...(config as Record<string, JsonValue>) };
  }
  return {};
}

/**
 * Nest a ground block under a container view-instance (CONTAINS) and stamp
 * the column id on the child config. Durable across reload via layout persist.
 */
export function nestBlockInContainerActions(
  childId: string,
  containerId: string,
  columnId: KanbanColumnId,
  order: number,
  existingConfig: Readonly<Record<string, JsonValue>> = {},
): ObjectAction[] {
  return [
    moveSurfaceNodeAction(childId, containerId, order),
    updateViewInstanceConfigAction(childId, {
      ...existingConfig,
      kanbanColumn: columnId,
    }),
  ];
}

export function placeBlockAction(
  viewInstanceId: string,
  target: BlockPlacementTarget,
  existingConfig: Readonly<Record<string, JsonValue>> = {},
): ObjectAction[] {
  const moves = [moveSurfaceNodeAction(viewInstanceId, target.regionId, target.order)];
  if (target.placement === 'full') {
    const geometry = target.geometry ?? (target.size ? geometryFromSize(target.size) : undefined);
    if (target.size || geometry) {
      moves.push(
        resizeBlockAction(
          viewInstanceId,
          target.size ?? 'full',
          geometry,
          existingConfig,
        ),
      );
    }
  }
  return moves;
}

export function readBlockSize(instance: ObjectRef, fallback: BlockSize = 'm'): BlockSize {
  const config = instance.properties.config;
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const size = (config as Record<string, JsonValue>).size;
    if (
      size === 's' ||
      size === 'm' ||
      size === 'v' ||
      size === 'sq' ||
      size === 'w' ||
      size === 'full'
    ) {
      return size;
    }
  }
  return fallback;
}

function readNumber(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** True when config carries a complete free geometry record. */
export function hasPersistedGeometry(instance: ObjectRef): boolean {
  const config = instance.properties.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  const raw = (config as Record<string, JsonValue>).geometry;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const geo = raw as Record<string, JsonValue>;
  return (
    readNumber(geo.col) !== null &&
    readNumber(geo.row) !== null &&
    readNumber(geo.colSpan) !== null &&
    readNumber(geo.rowSpan) !== null
  );
}

/** Free geometry from config, or derived from size / defaultSize. */
export function readBlockGeometry(
  instance: ObjectRef,
  fallbackSize: BlockSize = 'm',
): BlockGeometry {
  const config = instance.properties.config;
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const raw = (config as Record<string, JsonValue>).geometry;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const geo = raw as Record<string, JsonValue>;
      const col = readNumber(geo.col);
      const row = readNumber(geo.row);
      const colSpan = readNumber(geo.colSpan);
      const rowSpan = readNumber(geo.rowSpan);
      if (col && row && colSpan && rowSpan) {
        return clampGeometry({ col, row, colSpan, rowSpan });
      }
    }
  }
  return geometryFromSize(readBlockSize(instance, fallbackSize));
}

export function arrayMoveIds(ids: readonly string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length) return [...ids];
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (!item) return [...ids];
  next.splice(to, 0, item);
  return next;
}
