// SOURCING: none. Pure logic, no upstream component applies.

import type { JsonValue, ObjectRef } from '@commonplace/block-view/types';
import {
  CANVAS_CARD_TYPE,
  CANVAS_CONNECT_EDGE,
  CANVAS_CONNECTION_TYPE,
  CANVAS_GROUP_TYPE,
  CANVAS_MEMBER_EDGE,
  CANVAS_TYPE,
  CANVAS_TYPES as PACKAGE_CANVAS_TYPES,
  type GraphCanvas,
} from '@commonplace/json-canvas';

export {
  CANVAS_CONNECT_EDGE,
  CANVAS_MEMBER_EDGE,
  CANVAS_TYPE,
};
export const CANVAS_TYPES = PACKAGE_CANVAS_TYPES;

function asProps(value: Record<string, unknown>): Record<string, JsonValue> {
  return value as Record<string, JsonValue>;
}

export function isCanvasManagedType(type: string): boolean {
  return CANVAS_TYPES.includes(type) || type === 'note' || type === 'url' || type === 'file';
}

/** Project the denormalized canvas aggregate onto the shared object contract. */
export function graphToObjectRefs(canvas: GraphCanvas): ObjectRef[] {
  const members = [...canvas.placements.map((placement) => placement.objectId), ...canvas.groups.map((group) => group.id)];
  const connectTargets = new Map<string, string[]>();
  for (const connection of canvas.connections) {
    const targets = connectTargets.get(connection.fromObjectId) ?? [];
    targets.push(connection.toObjectId);
    connectTargets.set(connection.fromObjectId, targets);
  }

  return [
    {
      id: canvas.id,
      type: CANVAS_TYPE,
      properties: asProps({ id: canvas.id, title: canvas.title, tenant: canvas.tenant }),
      relations: { [CANVAS_MEMBER_EDGE]: members },
    },
    ...canvas.placements.map((placement) => {
      const object = canvas.objects.find((candidate) => candidate.id === placement.objectId);
      return {
        id: placement.objectId,
        type: CANVAS_CARD_TYPE,
        properties: asProps({
          ...placement,
          sourceType: object?.type ?? 'note',
          title: object?.title ?? placement.objectId,
          text: object?.text ?? null,
          url: object?.url ?? null,
          filePath: object?.filePath ?? null,
          subpath: object?.subpath ?? null,
        }),
        relations: connectTargets.has(placement.objectId)
          ? { [CANVAS_CONNECT_EDGE]: connectTargets.get(placement.objectId)! }
          : {},
      };
    }),
    ...canvas.groups.map((group) => ({
      id: group.id,
      type: CANVAS_GROUP_TYPE,
      properties: asProps(group as unknown as Record<string, unknown>),
      relations: {},
    })),
    ...canvas.connections.map((connection) => ({
      id: connection.id,
      type: CANVAS_CONNECTION_TYPE,
      properties: asProps(connection as unknown as Record<string, unknown>),
      relations: { [CANVAS_CONNECT_EDGE]: [connection.toObjectId] },
    })),
  ];
}
