// SOURCING: none — pure logic, no upstream component applies.
// Bidirectional mapping between GraphCanvas and JSON Canvas 1.0 (D2).

import { exportCanvasColor } from './colors';
import {
  emptyGraphCanvas,
  upsertConnection,
  upsertGroup,
  upsertObject,
  upsertPlacement,
} from './model';
import type {
  CanvasNode,
  CanvasObjectProjection,
  GraphCanvas,
  JSONCanvas,
} from './types';

function mintId(prefix: string, seed: string): string {
  return `${prefix}:${seed}`;
}

function projectNode(
  canvasId: string,
  object: CanvasObjectProjection,
  placement: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly color?: string;
    readonly provenance?: string;
  },
): CanvasNode {
  const color = exportCanvasColor(placement.color ?? object.color);
  const meta = {
    id: object.id,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    color,
    graphId: object.id,
    provenance: placement.provenance ?? object.provenance,
  };

  if (object.type === 'url' || object.url) {
    return { ...meta, type: 'link', url: object.url ?? '' };
  }
  if (object.filePath || object.type === 'file' || object.type === 'code-file' || object.type === 'doc') {
    return {
      ...meta,
      type: 'file',
      file: object.filePath ?? `theorem://${object.id}`,
      subpath: object.subpath,
    };
  }
  return {
    ...meta,
    type: 'text',
    text: object.text ?? object.title ?? object.id,
  };
}

/** Export a graph-native canvas to a JSON Canvas 1.0 document. */
export function toJsonCanvas(canvas: GraphCanvas): JSONCanvas {
  const nodes: CanvasNode[] = [
    ...canvas.groups.map((group) => ({
      id: group.id,
      type: 'group' as const,
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      label: group.label,
      color: exportCanvasColor(group.color),
      graphId: group.id,
      provenance: group.provenance,
    })),
    ...canvas.placements.map((placement) => {
      const object = canvas.objects.find((candidate) => candidate.id === placement.objectId);
      const projection: CanvasObjectProjection = object ?? {
        id: placement.objectId,
        type: 'note',
        title: placement.objectId,
      };
      return projectNode(canvas.id, projection, placement);
    }),
  ];

  const edges = canvas.connections.map((connection) => ({
    id: connection.id,
    fromNode: connection.fromObjectId,
    toNode: connection.toObjectId,
    fromSide: connection.fromSide,
    toSide: connection.toSide,
    label: connection.label,
    color: exportCanvasColor(connection.color),
    graphId: connection.id,
    provenance: connection.provenance,
  }));

  return { nodes, edges };
}

export interface FromJsonCanvasOptions {
  readonly canvasId: string;
  readonly tenant: string;
  readonly title?: string;
}

/**
 * Import a validated JSON Canvas document into a graph-native canvas.
 * Resolves graphId custom fields when present; otherwise mints object ids.
 */
export function fromJsonCanvas(
  document: JSONCanvas,
  options: FromJsonCanvasOptions,
): GraphCanvas {
  let canvas = emptyGraphCanvas(options.canvasId, options.tenant, options.title ?? 'Imported canvas');
  const nodeIdToObjectId = new Map<string, string>();

  for (const [index, node] of document.nodes.entries()) {
    const objectId = node.graphId ?? mintId(node.type, node.id || String(index));
    nodeIdToObjectId.set(node.id, objectId);
    if (node.type === 'group') {
      canvas = upsertGroup(canvas, {
        id: objectId,
        canvasId: options.canvasId,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        label: node.label,
        color: node.color,
        z: index,
        provenance: node.provenance,
      });
      continue;
    }

    const projection: CanvasObjectProjection = (() => {
      switch (node.type) {
        case 'text':
          return {
            id: objectId,
            type: 'note',
            title: node.text.slice(0, 80),
            text: node.text,
            color: node.color,
            provenance: node.provenance,
          };
        case 'link':
          return {
            id: objectId,
            type: 'url',
            title: node.url,
            url: node.url,
            color: node.color,
            provenance: node.provenance,
          };
        case 'file':
          return {
            id: objectId,
            type: 'file',
            title: node.file,
            filePath: node.file,
            subpath: node.subpath,
            color: node.color,
            provenance: node.provenance,
          };
      }
    })();

    canvas = upsertObject(canvas, projection);
    canvas = upsertPlacement(canvas, {
      canvasId: options.canvasId,
      objectId,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      z: index,
      color: node.color,
      provenance: node.provenance,
    });
  }

  const knownIds = new Set([
    ...canvas.objects.map((object) => object.id),
    ...canvas.groups.map((group) => group.id),
  ]);

  for (const [index, edge] of document.edges.entries()) {
    const fromObjectId = nodeIdToObjectId.get(edge.fromNode);
    const toObjectId = nodeIdToObjectId.get(edge.toNode);
    if (!fromObjectId || !toObjectId || !knownIds.has(fromObjectId) || !knownIds.has(toObjectId)) {
      continue;
    }
    const connectionId = edge.graphId ?? mintId('edge', edge.id || String(index));
    canvas = upsertConnection(canvas, {
      id: connectionId,
      canvasId: options.canvasId,
      fromObjectId,
      toObjectId,
      fromSide: edge.fromSide,
      toSide: edge.toSide,
      label: edge.label,
      color: edge.color,
      provenance: edge.provenance,
    });
  }

  return canvas;
}
