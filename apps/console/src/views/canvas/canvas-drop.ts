import type { ObjectAction } from '@commonplace/block-view/types';
import { CANVAS_CONNECT_EDGE } from '@commonplace/json-canvas';
import type { Node } from '@xyflow/react';

type DroppedNode = Pick<Node, 'id' | 'position'>;
type IntersectingNode = Pick<Node, 'id'>;

export function canvasDropAction(
  node: DroppedNode,
  intersecting: readonly IntersectingNode[],
): ObjectAction {
  const target = intersecting.find((candidate) => candidate.id !== node.id);
  if (target) {
    return {
      kind: 'link',
      from: node.id,
      edge: CANVAS_CONNECT_EDGE,
      to: target.id,
    };
  }

  return {
    kind: 'update',
    id: node.id,
    patch: {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    },
  };
}
