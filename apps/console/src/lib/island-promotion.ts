// SOURCING: none. Pure helpers for B10 island reorder and promotion emits.

import type { BlockSize, JsonValue, ObjectAction, ObjectRef } from '@commonplace/block-view/types';
import {
  moveSurfaceNodeAction,
  updateViewInstanceConfigAction,
} from '@commonplace/block-view/surface-actions';

export type PromotionTarget =
  | { readonly kind: 'grid'; readonly regionId: string; readonly order: number }
  | { readonly kind: 'stripe'; readonly regionId: string; readonly order: number }
  | { readonly kind: 'chrome'; readonly regionId: string; readonly order: number }
  | { readonly kind: 'surface'; readonly regionId: string; readonly order: number; readonly size?: BlockSize };

/** Reorder within a grid: move active before over (or to end when over is null). */
export function reorderIslandActions(
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

export function resizeIslandAction(viewInstanceId: string, size: BlockSize): ObjectAction {
  return updateViewInstanceConfigAction(viewInstanceId, { size });
}

export function promoteIslandAction(
  viewInstanceId: string,
  target: PromotionTarget,
): ObjectAction[] {
  const moves = [moveSurfaceNodeAction(viewInstanceId, target.regionId, target.order)];
  if (target.kind === 'surface' && target.size) {
    moves.push(resizeIslandAction(viewInstanceId, target.size));
  }
  return moves;
}

export function readIslandSize(instance: ObjectRef, fallback: BlockSize = 'm'): BlockSize {
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

export function arrayMoveIds(ids: readonly string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length) return [...ids];
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (!item) return [...ids];
  next.splice(to, 0, item);
  return next;
}
