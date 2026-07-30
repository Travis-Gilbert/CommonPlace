import type { ModelGraph } from '@commonplace/okf';

export interface RenderedNodePosition {
  readonly id: string;
  readonly position: {
    readonly x: number;
    readonly y: number;
  };
}

/**
 * Reconcile layout coordinates from React Flow without treating its
 * measurement, selection, or internal node changes as semantic graph writes.
 */
export function graphWithChangedNodePositions(
  graph: ModelGraph,
  renderedNodes: readonly RenderedNodePosition[],
): ModelGraph | null {
  const positionById = new Map(
    renderedNodes.map((node) => [node.id, node.position] as const),
  );
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    const position = positionById.get(node.key);
    if (
      !position
      || (position.x === node.position.x && position.y === node.position.y)
    ) {
      return node;
    }
    changed = true;
    return { ...node, position };
  });
  return changed ? { ...graph, nodes } : null;
}
