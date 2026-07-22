// SOURCING: none. HANDOFF-CONSOLE-ONE-BLOCK-MODEL named choice 7:
// innermost accepting container wins; else ground.

import type { CollisionDetection, DroppableContainer } from '@dnd-kit/core';
import { closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';

export type BlockDropData = {
  readonly type?: string;
  readonly acceptsChildren?: boolean;
  readonly accepts?: readonly string[];
  readonly descriptorId?: string;
  readonly viewInstanceId?: string;
  readonly kind?: string;
};

function acceptsDescriptor(
  data: BlockDropData | undefined,
  draggedDescriptorId: string | undefined,
): boolean {
  if (!data?.acceptsChildren) return false;
  const accepts = data.accepts ?? ['*'];
  if (accepts.includes('*')) return true;
  if (!draggedDescriptorId) return false;
  return accepts.includes(draggedDescriptorId);
}

function depthOf(container: DroppableContainer): number {
  const node = container.node.current;
  if (!node) return 0;
  let depth = 0;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.hasAttribute('data-block-container')) depth += 1;
    current = current.parentElement;
  }
  return depth;
}

/**
 * Collision rule: among droppables under the pointer that accept the dragged
 * descriptor, pick the innermost container. If none accept, fall through to
 * ground / promote / sortable targets via closestCenter.
 */
export function createBlockCollisionDetection(): CollisionDetection {
  return (args) => {
    const pointerHits = pointerWithin(args);
    const draggedDescriptorId = (args.active.data.current as BlockDropData | undefined)
      ?.descriptorId;

    const accepting = pointerHits
      .map((hit) => {
        const container = args.droppableContainers.find((candidate) => candidate.id === hit.id);
        if (!container) return null;
        const data = container.data.current as BlockDropData | undefined;
        if (!acceptsDescriptor(data, draggedDescriptorId)) return null;
        return { hit, depth: depthOf(container) };
      })
      .filter((entry): entry is { hit: (typeof pointerHits)[number]; depth: number } => entry !== null)
      .sort((a, b) => b.depth - a.depth);

    if (accepting[0]) return [accepting[0].hit];

    const intersections = rectIntersection(args);
    if (intersections.length > 0) return intersections;
    return closestCenter(args);
  };
}
