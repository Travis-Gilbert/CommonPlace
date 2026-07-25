// SOURCING: none — pure logic, no upstream component applies.
// Graph-native canvas object helpers for SPEC-DATA-CANVAS-GRAPH-NATIVE-1.0 D1.

import type {
  CanvasConnection,
  CanvasGroup,
  CanvasObjectProjection,
  CanvasPlacement,
  GraphCanvas,
} from './types';

export const CANVAS_TYPE = 'canvas';
export const CANVAS_CARD_TYPE = 'canvas.card';
export const CANVAS_GROUP_TYPE = 'canvas.group';
export const CANVAS_CONNECTION_TYPE = 'canvas.connection';
export const CANVAS_MEMBER_EDGE = 'CANVAS_MEMBER';
export const CANVAS_CONNECT_EDGE = 'CANVAS_CONNECT';

export const CANVAS_TYPES: readonly string[] = [
  CANVAS_TYPE,
  CANVAS_CARD_TYPE,
  CANVAS_GROUP_TYPE,
  CANVAS_CONNECTION_TYPE,
];

export function emptyGraphCanvas(id: string, tenant: string, title = 'Canvas'): GraphCanvas {
  return {
    id,
    title,
    tenant,
    placements: [],
    groups: [],
    connections: [],
    objects: [],
  };
}

export function placementKey(canvasId: string, objectId: string): string {
  return `${canvasId}::${objectId}`;
}

export function findObject(
  canvas: GraphCanvas,
  objectId: string,
): CanvasObjectProjection | undefined {
  return canvas.objects.find((object) => object.id === objectId);
}

export function upsertObject(
  canvas: GraphCanvas,
  object: CanvasObjectProjection,
): GraphCanvas {
  const without = canvas.objects.filter((existing) => existing.id !== object.id);
  return { ...canvas, objects: [...without, object] };
}

export function upsertPlacement(
  canvas: GraphCanvas,
  placement: CanvasPlacement,
): GraphCanvas {
  const without = canvas.placements.filter(
    (existing) =>
      !(existing.canvasId === placement.canvasId && existing.objectId === placement.objectId),
  );
  return { ...canvas, placements: [...without, placement] };
}

export function removePlacement(
  canvas: GraphCanvas,
  canvasId: string,
  objectId: string,
): GraphCanvas {
  return {
    ...canvas,
    placements: canvas.placements.filter(
      (placement) => !(placement.canvasId === canvasId && placement.objectId === objectId),
    ),
    connections: canvas.connections.filter(
      (connection) =>
        !(
          connection.canvasId === canvasId &&
          (connection.fromObjectId === objectId || connection.toObjectId === objectId)
        ),
    ),
  };
}

export function upsertGroup(canvas: GraphCanvas, group: CanvasGroup): GraphCanvas {
  const without = canvas.groups.filter((existing) => existing.id !== group.id);
  return { ...canvas, groups: [...without, group] };
}

export function upsertConnection(
  canvas: GraphCanvas,
  connection: CanvasConnection,
): GraphCanvas {
  const without = canvas.connections.filter((existing) => existing.id !== connection.id);
  return { ...canvas, connections: [...without, connection] };
}

export function removeConnection(canvas: GraphCanvas, connectionId: string): GraphCanvas {
  return {
    ...canvas,
    connections: canvas.connections.filter((connection) => connection.id !== connectionId),
  };
}
