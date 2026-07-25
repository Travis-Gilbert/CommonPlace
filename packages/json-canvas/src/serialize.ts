// SOURCING: none — pure logic, no upstream component applies.
// Serializer for Obsidian JSON Canvas 1.0 (obsidianmd/jsoncanvas).

/**
 * Serializes a JSONCanvas to `.canvas` file text. Key order matches the
 * JSON Canvas 1.0 attribute documentation; undefined optionals are omitted.
 */

import type { CanvasEdge, CanvasNode, JSONCanvas } from './types';

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

function serializeNode(node: CanvasNode): Record<string, unknown> {
  const generic = {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    color: node.color,
    graphId: node.graphId,
    provenance: node.provenance,
  };
  switch (node.type) {
    case 'text':
      return omitUndefined({ ...generic, text: node.text });
    case 'file':
      return omitUndefined({ ...generic, file: node.file, subpath: node.subpath });
    case 'link':
      return omitUndefined({ ...generic, url: node.url });
    case 'group':
      return omitUndefined({
        ...generic,
        label: node.label,
        background: node.background,
        backgroundStyle: node.backgroundStyle,
      });
  }
}

function serializeEdge(edge: CanvasEdge): Record<string, unknown> {
  return omitUndefined({
    id: edge.id,
    fromNode: edge.fromNode,
    fromSide: edge.fromSide,
    fromEnd: edge.fromEnd,
    toNode: edge.toNode,
    toSide: edge.toSide,
    toEnd: edge.toEnd,
    color: edge.color,
    label: edge.label,
    graphId: edge.graphId,
    provenance: edge.provenance,
  });
}

export function serializeCanvas(canvas: JSONCanvas): string {
  return JSON.stringify(
    { nodes: canvas.nodes.map(serializeNode), edges: canvas.edges.map(serializeEdge) },
    null,
    2,
  );
}
