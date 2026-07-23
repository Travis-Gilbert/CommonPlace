// SOURCING: none — pure logic, no upstream component applies.
// Turns validated JSON Canvas / GraphCanvas mutations into ObjectActions (D4).

import type { GraphCanvas, JSONCanvas } from './types';
import { fromJsonCanvas } from './interchange';
import {
  CANVAS_CONNECT_EDGE,
  CANVAS_CONNECTION_TYPE,
  CANVAS_GROUP_TYPE,
  CANVAS_MEMBER_EDGE,
  CANVAS_TYPE,
} from './model';

/** Minimal ObjectAction shape matching @commonplace/block-view without importing it. */
export type CanvasObjectAction =
  | {
      readonly kind: 'create';
      readonly type: string;
      readonly props: Readonly<Record<string, string | number | boolean | null>>;
    }
  | {
      readonly kind: 'update';
      readonly id: string;
      readonly patch: Readonly<Record<string, string | number | boolean | null>>;
    }
  | {
      readonly kind: 'link';
      readonly from: string;
      readonly edge: string;
      readonly to: string;
    }
  | {
      readonly kind: 'unlink';
      readonly from: string;
      readonly edge: string;
      readonly to: string;
    }
  | { readonly kind: 'delete'; readonly id: string };

export interface ApplyJsonCanvasOptions {
  readonly canvasId: string;
  readonly tenant: string;
  readonly title?: string;
}

/**
 * Compile a validated JSON Canvas document into receipted ObjectActions.
 * Callers must validate with parseCanvasValue first; this function assumes a
 * well-formed document and never invents a partial apply.
 */
export function applyJsonCanvasAsActions(
  document: JSONCanvas,
  options: ApplyJsonCanvasOptions,
): { readonly canvas: GraphCanvas; readonly actions: readonly CanvasObjectAction[] } {
  const canvas = fromJsonCanvas(document, options);
  return { canvas, actions: graphCanvasToActions(canvas) };
}

/** Expand a GraphCanvas into the ObjectActions that materialize it. */
export function graphCanvasToActions(canvas: GraphCanvas): readonly CanvasObjectAction[] {
  const actions: CanvasObjectAction[] = [
    {
      kind: 'create',
      type: CANVAS_TYPE,
      props: {
        id: canvas.id,
        title: canvas.title,
        tenant: canvas.tenant,
      },
    },
  ];

  for (const object of canvas.objects) {
    actions.push({
      kind: 'create',
      type: object.type,
      props: {
        id: object.id,
        title: object.title ?? object.id,
        text: object.text ?? null,
        url: object.url ?? null,
        filePath: object.filePath ?? null,
        subpath: object.subpath ?? null,
        color: object.color ?? null,
        provenance: object.provenance ?? null,
      },
    });
  }

  for (const group of canvas.groups) {
    actions.push({
      kind: 'create',
      type: CANVAS_GROUP_TYPE,
      props: {
        id: group.id,
        canvasId: group.canvasId,
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
        label: group.label ?? null,
        color: group.color ?? null,
        provenance: group.provenance ?? null,
      },
    });
    actions.push({
      kind: 'link',
      from: canvas.id,
      edge: CANVAS_MEMBER_EDGE,
      to: group.id,
    });
  }

  for (const placement of canvas.placements) {
    actions.push({
      kind: 'update',
      id: placement.objectId,
      patch: {
        canvasId: placement.canvasId,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        z: placement.z ?? null,
        color: placement.color ?? null,
        groupId: placement.groupId ?? null,
        provenance: placement.provenance ?? null,
      },
    });
    actions.push({
      kind: 'link',
      from: canvas.id,
      edge: CANVAS_MEMBER_EDGE,
      to: placement.objectId,
    });
  }

  for (const connection of canvas.connections) {
    actions.push({
      kind: 'create',
      type: CANVAS_CONNECTION_TYPE,
      props: {
        id: connection.id,
        canvasId: connection.canvasId,
        fromObjectId: connection.fromObjectId,
        toObjectId: connection.toObjectId,
        fromSide: connection.fromSide ?? null,
        toSide: connection.toSide ?? null,
        label: connection.label ?? null,
        color: connection.color ?? null,
        provenance: connection.provenance ?? null,
      },
    });
    actions.push({
      kind: 'link',
      from: connection.fromObjectId,
      edge: CANVAS_CONNECT_EDGE,
      to: connection.toObjectId,
    });
  }

  return actions;
}
