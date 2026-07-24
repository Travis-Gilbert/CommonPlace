// SOURCING: none. Pure logic, no upstream component applies.

import type { Edge, Node } from '@xyflow/react';
import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import type { CanvasObjectProjection, GraphCanvas } from '@commonplace/json-canvas';

export interface CanvasCardData extends Record<string, unknown> {
  readonly title: string;
  readonly text?: string;
  readonly sourceType: string;
}

function numberValue(value: JsonValue | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function canvasFlowFromObjects(objects: readonly ObjectRef[]): {
  canvasId: string;
  nodes: Node<CanvasCardData>[];
  edges: Edge[];
} {
  const canvasId = objects.find((object) => object.type === 'canvas')?.id ?? 'canvas.default';
  const nodes: Node<CanvasCardData>[] = [];
  const edges: Edge[] = [];
  for (const object of objects) {
    if (object.type === 'canvas.group') {
      nodes.push({ id: object.id, type: 'group', position: { x: numberValue(object.properties.x, 0), y: numberValue(object.properties.y, 0) }, style: { width: numberValue(object.properties.width, 320), height: numberValue(object.properties.height, 180) }, data: { title: stringValue(object.properties.label) ?? 'Group', sourceType: 'group' } });
    }
    if (object.type === 'canvas.card') {
      nodes.push({ id: object.id, type: 'canvasCard', position: { x: numberValue(object.properties.x, 0), y: numberValue(object.properties.y, 0) }, style: { width: numberValue(object.properties.width, 240), height: numberValue(object.properties.height, 120) }, data: { title: stringValue(object.properties.title) ?? object.id, text: stringValue(object.properties.text), sourceType: stringValue(object.properties.sourceType) ?? 'note' } });
    }
    if (object.type === 'canvas.connection') {
      const source = stringValue(object.properties.fromObjectId);
      const target = stringValue(object.properties.toObjectId);
      if (source && target) edges.push({ id: object.id, source, target, label: stringValue(object.properties.label) });
    }
  }
  return { canvasId, nodes, edges };
}

export function canvasFromObjects(objects: readonly ObjectRef[]): GraphCanvas | null {
  const canvasRef = objects.find((object) => object.type === 'canvas');
  if (!canvasRef) return null;
  const cards = objects.filter((object) => object.type === 'canvas.card');
  return {
    id: canvasRef.id,
    title: stringValue(canvasRef.properties.title) ?? 'Canvas',
    tenant: stringValue(canvasRef.properties.tenant) ?? '',
    placements: cards.map((object) => ({ canvasId: canvasRef.id, objectId: object.id, x: numberValue(object.properties.x, 0), y: numberValue(object.properties.y, 0), width: numberValue(object.properties.width, 240), height: numberValue(object.properties.height, 120), z: numberValue(object.properties.z, 0), color: stringValue(object.properties.color), groupId: stringValue(object.properties.groupId) })),
    groups: objects.filter((object) => object.type === 'canvas.group').map((object) => ({ id: object.id, canvasId: canvasRef.id, x: numberValue(object.properties.x, 0), y: numberValue(object.properties.y, 0), width: numberValue(object.properties.width, 320), height: numberValue(object.properties.height, 180), label: stringValue(object.properties.label), color: stringValue(object.properties.color), z: numberValue(object.properties.z, 0) })),
    connections: objects.filter((object) => object.type === 'canvas.connection').flatMap((object) => {
      const fromObjectId = stringValue(object.properties.fromObjectId);
      const toObjectId = stringValue(object.properties.toObjectId);
      return fromObjectId && toObjectId ? [{ id: object.id, canvasId: canvasRef.id, fromObjectId, toObjectId, label: stringValue(object.properties.label), color: stringValue(object.properties.color) }] : [];
    }),
    objects: cards.map((object): CanvasObjectProjection => ({ id: object.id, type: stringValue(object.properties.sourceType) ?? 'note', title: stringValue(object.properties.title), text: stringValue(object.properties.text), url: stringValue(object.properties.url), filePath: stringValue(object.properties.filePath), subpath: stringValue(object.properties.subpath), color: stringValue(object.properties.color) })),
  };
}
