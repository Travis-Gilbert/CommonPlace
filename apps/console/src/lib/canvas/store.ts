// SOURCING: none. Pure logic, no upstream component applies.

import type { JsonValue, ObjectAction, ObjectActionReceipt, ObjectQuery, ObjectRef, ObjectSet, Predicate, Result, Unsubscribe } from '@commonplace/block-view/types';
import {
  applyJsonCanvasAsActions,
  CANVAS_CONNECT_EDGE,
  CANVAS_CONNECTION_TYPE,
  CANVAS_GROUP_TYPE,
  CANVAS_MEMBER_EDGE,
  CANVAS_TYPE,
  emptyGraphCanvas,
  fromJsonCanvas,
  parseCanvasValue,
  removeConnection,
  removePlacement,
  toJsonCanvas,
  upsertConnection,
  upsertGroup,
  upsertObject,
  upsertPlacement,
  type CanvasObjectProjection,
  type GraphCanvas,
  type JSONCanvas,
} from '@commonplace/json-canvas';
import { CANVAS_TYPES, graphToObjectRefs, isCanvasManagedType } from './object-bridge';

const STORAGE_PREFIX = 'commonplace.console.canvas.v1';
export const REFUSAL_NOTE = 'refused:missing_tenant';
export const DEFAULT_CANVAS_ID = 'canvas.default';

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: JsonValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function matchesWhere(object: ObjectRef, where: Predicate | undefined): boolean {
  if (!where) return true;
  if (where.kind === 'eq') return where.field === 'id' ? object.id === where.value : object.properties[where.field] === where.value;
  if (where.kind === 'not_eq') return where.field === 'id' ? object.id !== where.value : object.properties[where.field] !== where.value;
  if (where.kind === 'exists') return where.field in object.properties;
  if (where.kind === 'and') return where.all.every((item) => matchesWhere(object, item));
  if (where.kind === 'or') return where.any.some((item) => matchesWhere(object, item));
  if (where.kind === 'not') return !matchesWhere(object, where.predicate);
  return true;
}

export class CanvasStore {
  private readonly canvases = new Map<string, GraphCanvas>();
  private readonly detached = new Map<string, CanvasObjectProjection>();
  private readonly subs = new Set<() => void>();

  constructor(private readonly tenant: string | null) {
    if (tenant) this.ensureCanvas(DEFAULT_CANVAS_ID);
  }

  private storageKey(canvasId: string): string | null {
    return this.tenant ? `${STORAGE_PREFIX}:${this.tenant}:${canvasId}` : null;
  }

  private ensureCanvas(canvasId: string): GraphCanvas | null {
    if (!this.tenant) return null;
    const current = this.canvases.get(canvasId);
    if (current) return current;
    const key = this.storageKey(canvasId);
    if (key && typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(window.localStorage.getItem(key) ?? 'null') as GraphCanvas | null;
        if (stored?.id === canvasId && stored.tenant === this.tenant) {
          this.canvases.set(canvasId, stored);
          return stored;
        }
      } catch {
        // Invalid browser data is replaced with a blank canvas.
      }
    }
    const canvas = emptyGraphCanvas(canvasId, this.tenant);
    this.commit(canvas);
    return canvas;
  }

  private commit(canvas: GraphCanvas): void {
    this.canvases.set(canvas.id, canvas);
    const key = this.storageKey(canvas.id);
    if (key && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(canvas));
      } catch {
        // Browser storage can be unavailable without invalidating this session.
      }
    }
    for (const callback of this.subs) callback();
  }

  private receipt(actionKind: ObjectActionReceipt['action_kind'], ids: readonly string[]): Result<ObjectActionReceipt> {
    return { ok: true, value: { action_kind: actionKind, status: 'applied', target_ids: ids } };
  }

  private findCanvas(id: string): GraphCanvas | null {
    for (const canvas of this.canvases.values()) {
      if (canvas.id === id || canvas.placements.some((placement) => placement.objectId === id) || canvas.groups.some((group) => group.id === id) || canvas.connections.some((connection) => connection.id === id)) return canvas;
    }
    return null;
  }

  query(query: ObjectQuery): ObjectSet {
    if (!this.tenant) {
      return {
        objects: [],
        shape: { types: [...query.types], fields: [], relations: [], axes: {}, cardinality: 'empty' },
        notes: [REFUSAL_NOTE],
        subscribe: (callback) => this.subscribe(() => callback(this.query(query))),
      };
    }
    this.ensureCanvas(DEFAULT_CANVAS_ID);
    const objects = [...this.canvases.values()].flatMap(graphToObjectRefs)
      .filter((object) => query.types.includes(object.type))
      .filter((object) => matchesWhere(object, query.where));
    return {
      objects,
      shape: {
        types: [...query.types],
        fields: [],
        relations: [{ edge: CANVAS_MEMBER_EDGE, dir: 'out' }, { edge: CANVAS_CONNECT_EDGE, dir: 'out' }],
        axes: { spatial: true },
        cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
      },
      subscribe: (callback) => this.subscribe(() => callback(this.query(query))),
    };
  }

  private subscribe(callback: () => void): Unsubscribe {
    this.subs.add(callback);
    return () => this.subs.delete(callback);
  }

  owns(action: ObjectAction): boolean {
    if (action.kind === 'create') return isCanvasManagedType(action.type);
    if (action.kind === 'link' || action.kind === 'unlink') return action.edge === CANVAS_MEMBER_EDGE || action.edge === CANVAS_CONNECT_EDGE;
    if (action.kind === 'invoke_tool') return action.tool === 'canvas.apply_json';
    if (action.kind === 'update' || action.kind === 'delete') return this.findCanvas(action.id) !== null;
    return false;
  }

  getCanvas(canvasId: string): GraphCanvas | null {
    return this.ensureCanvas(canvasId);
  }

  exportDocument(canvasId: string): JSONCanvas | null {
    const canvas = this.getCanvas(canvasId);
    return canvas ? toJsonCanvas(canvas) : null;
  }

  importDocument(canvasId: string, document: JSONCanvas): Result<ObjectActionReceipt> {
    if (!this.tenant) return { ok: false, error: REFUSAL_NOTE };
    const canvas = fromJsonCanvas(document, { canvasId, tenant: this.tenant, title: this.getCanvas(canvasId)?.title ?? 'Imported canvas' });
    this.commit(canvas);
    return this.receipt('create', [canvasId]);
  }

  applyJsonCanvas(canvasId: string, document: JSONCanvas): Result<ObjectActionReceipt> {
    if (!this.tenant) return { ok: false, error: REFUSAL_NOTE };
    const compiled = applyJsonCanvasAsActions(document, { canvasId, tenant: this.tenant, title: this.getCanvas(canvasId)?.title ?? 'Canvas' });
    this.canvases.set(canvasId, emptyGraphCanvas(canvasId, this.tenant, compiled.canvas.title));
    for (const action of compiled.actions) {
      const result = this.emit(action as ObjectAction);
      if (!result.ok) return result;
    }
    return this.receipt('invoke_tool', [canvasId]);
  }

  emit(action: ObjectAction): Result<ObjectActionReceipt> {
    if (!this.tenant) return { ok: false, error: REFUSAL_NOTE };
    if (action.kind === 'invoke_tool') {
      if (action.tool !== 'canvas.apply_json') return { ok: false, error: `unknown canvas tool: ${action.tool}` };
      const canvasId = stringValue(action.args.canvasId) ?? DEFAULT_CANVAS_ID;
      try {
        return this.applyJsonCanvas(canvasId, parseCanvasValue(action.args.document));
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'invalid JSON Canvas document' };
      }
    }
    if (action.kind === 'create') return this.create(action.type, action.props);
    if (action.kind === 'update') return this.update(action.id, action.patch);
    if (action.kind === 'link') return this.link(action.from, action.edge, action.to);
    if (action.kind === 'unlink') return this.unlink(action.from, action.edge, action.to);
    if (action.kind === 'delete') return this.delete(action.id);
    return { ok: false, error: `canvas store cannot handle action: ${action.kind}` };
  }

  private create(type: string, props: Readonly<Record<string, JsonValue>>): Result<ObjectActionReceipt> {
    const id = stringValue(props.id) ?? `${type}:${Date.now()}`;
    if (type === CANVAS_TYPE) {
      this.commit(emptyGraphCanvas(id, this.tenant!, stringValue(props.title) ?? 'Canvas'));
      return this.receipt('create', [id]);
    }
    const canvasId = stringValue(props.canvasId) ?? DEFAULT_CANVAS_ID;
    const canvas = this.ensureCanvas(canvasId)!;
    if (type === CANVAS_GROUP_TYPE) {
      this.commit(upsertGroup(canvas, { id, canvasId, x: numberValue(props.x, 0), y: numberValue(props.y, 0), width: numberValue(props.width, 320), height: numberValue(props.height, 180), label: stringValue(props.label), color: stringValue(props.color) }));
      return this.receipt('create', [id]);
    }
    if (type === CANVAS_CONNECTION_TYPE) {
      const fromObjectId = stringValue(props.fromObjectId);
      const toObjectId = stringValue(props.toObjectId);
      if (!fromObjectId || !toObjectId) return { ok: false, error: 'canvas connection requires endpoints' };
      this.commit(upsertConnection(canvas, { id, canvasId, fromObjectId, toObjectId, label: stringValue(props.label), color: stringValue(props.color) }));
      return this.receipt('create', [id]);
    }
    if (type !== 'note' && type !== 'url' && type !== 'file') return { ok: false, error: `not a canvas type: ${type}` };
    const object: CanvasObjectProjection = { id, type, title: stringValue(props.title) ?? id, text: stringValue(props.text), url: stringValue(props.url), filePath: stringValue(props.filePath), subpath: stringValue(props.subpath), color: stringValue(props.color), provenance: stringValue(props.provenance) };
    this.detached.set(id, object);
    this.commit(upsertPlacement(upsertObject(canvas, object), { canvasId, objectId: id, x: numberValue(props.x, 40), y: numberValue(props.y, 40), width: numberValue(props.width, 240), height: numberValue(props.height, 120), z: numberValue(props.z, 0), color: stringValue(props.color), groupId: stringValue(props.groupId) }));
    return this.receipt('create', [id]);
  }

  private update(id: string, patch: Readonly<Record<string, JsonValue>>): Result<ObjectActionReceipt> {
    let canvas = this.findCanvas(id);
    if (!canvas) {
      const detached = this.detached.get(id);
      const canvasId = stringValue(patch.canvasId);
      if (!detached || !canvasId) return { ok: false, error: `canvas object missing: ${id}` };
      canvas = this.ensureCanvas(canvasId)!;
      this.commit(upsertPlacement(upsertObject(canvas, detached), { canvasId, objectId: id, x: numberValue(patch.x, 0), y: numberValue(patch.y, 0), width: numberValue(patch.width, 240), height: numberValue(patch.height, 120) }));
      return this.receipt('update', [id]);
    }
    if (canvas.id === id) {
      this.commit({ ...canvas, title: stringValue(patch.title) ?? canvas.title });
      return this.receipt('update', [id]);
    }
    const placement = canvas.placements.find((item) => item.objectId === id);
    if (placement) {
      this.commit(upsertPlacement(canvas, { ...placement, x: numberValue(patch.x, placement.x), y: numberValue(patch.y, placement.y), width: numberValue(patch.width, placement.width), height: numberValue(patch.height, placement.height), z: numberValue(patch.z, placement.z ?? 0), color: stringValue(patch.color) ?? placement.color, groupId: stringValue(patch.groupId) ?? placement.groupId }));
      return this.receipt('update', [id]);
    }
    const group = canvas.groups.find((item) => item.id === id);
    if (group) {
      this.commit(upsertGroup(canvas, { ...group, x: numberValue(patch.x, group.x), y: numberValue(patch.y, group.y), width: numberValue(patch.width, group.width), height: numberValue(patch.height, group.height), label: stringValue(patch.label) ?? group.label, color: stringValue(patch.color) ?? group.color }));
      return this.receipt('update', [id]);
    }
    return { ok: false, error: `canvas object missing: ${id}` };
  }

  private link(from: string, edge: string, to: string): Result<ObjectActionReceipt> {
    if (edge === CANVAS_MEMBER_EDGE) {
      const canvas = this.ensureCanvas(from);
      if (!canvas) return { ok: false, error: `canvas missing: ${from}` };
      if (canvas.placements.some((item) => item.objectId === to) || canvas.groups.some((item) => item.id === to)) return this.receipt('link', [from, to]);
      const object = this.detached.get(to) ?? { id: to, type: 'note', title: to };
      this.commit(upsertPlacement(upsertObject(canvas, object), { canvasId: canvas.id, objectId: to, x: 40, y: 40, width: 240, height: 120 }));
      return this.receipt('link', [from, to]);
    }
    if (edge === CANVAS_CONNECT_EDGE) {
      const canvas = this.findCanvas(from);
      if (!canvas || !this.findCanvas(to)) return { ok: false, error: 'canvas connection endpoints are not members' };
      this.commit(upsertConnection(canvas, { id: `canvas.connection:${from}:${to}`, canvasId: canvas.id, fromObjectId: from, toObjectId: to }));
      return this.receipt('link', [from, to]);
    }
    return { ok: false, error: `not a canvas edge: ${edge}` };
  }

  private unlink(from: string, edge: string, to: string): Result<ObjectActionReceipt> {
    const canvas = edge === CANVAS_MEMBER_EDGE ? this.ensureCanvas(from) : this.findCanvas(from);
    if (!canvas) return { ok: false, error: `canvas relation source missing: ${from}` };
    if (edge === CANVAS_MEMBER_EDGE) {
      this.commit(canvas.groups.some((group) => group.id === to) ? { ...canvas, groups: canvas.groups.filter((group) => group.id !== to) } : removePlacement(canvas, canvas.id, to));
      return this.receipt('unlink', [from, to]);
    }
    if (edge === CANVAS_CONNECT_EDGE) {
      const connection = canvas.connections.find((item) => item.fromObjectId === from && item.toObjectId === to);
      if (connection) this.commit(removeConnection(canvas, connection.id));
      return this.receipt('unlink', [from, to]);
    }
    return { ok: false, error: `not a canvas edge: ${edge}` };
  }

  private delete(id: string): Result<ObjectActionReceipt> {
    const canvas = this.findCanvas(id);
    if (!canvas) return this.receipt('delete', []);
    if (canvas.id === id) {
      this.canvases.delete(id);
      for (const callback of this.subs) callback();
      return this.receipt('delete', [id]);
    }
    if (canvas.placements.some((item) => item.objectId === id)) this.commit(removePlacement(canvas, canvas.id, id));
    else {
      const connection = canvas.connections.find((item) => item.id === id);
      if (connection) this.commit(removeConnection(canvas, connection.id));
    }
    return this.receipt('delete', [id]);
  }
}
