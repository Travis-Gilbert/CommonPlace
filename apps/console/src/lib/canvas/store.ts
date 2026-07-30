// SOURCING: none. Pure logic, no upstream component applies.

import type {
  BlockHost,
  JsonValue,
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  Predicate,
  Result,
  Unsubscribe,
} from '@commonplace/block-view/types';
import {
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

const CANVAS_DOCUMENT_PROPERTY = 'graph';
const CANVAS_PERSISTENCE_KIND = 'canvas-work-v1';
const AUTHENTICATED_SCOPE = 'authenticated-object-seam';
export const PERSISTENCE_UNAVAILABLE_NOTE = 'refused:canvas_persistence_unavailable';
export const DEFAULT_CANVAS_ID = 'canvas.default';
/** Rail-owned Obsidian JSON Canvas Z-layer (not the claim-graph CanvasView surface). */
export const INSPECTOR_CANVAS_ID = 'canvas.inspector.rail';
const PERSISTED_CANVAS_IDS = [DEFAULT_CANVAS_ID, INSPECTOR_CANVAS_ID] as const;

/** Layout-only model ERD canvas id, namespaced per topic scope (MF2). */
export function modelCanvasId(topicId: string): string {
  const encoded = encodeURIComponent(topicId.trim());
  return `canvas.model.${encoded || 'unset'}`;
}

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
  private readonly persistedIds = new Set<string>();
  private hydration: Promise<void> | null = null;
  private hydrationReady = false;
  private mutation: Promise<unknown> = Promise.resolve();
  private persistenceError: string | null = null;

  constructor(private readonly host: Pick<BlockHost, 'query' | 'emit'>) {
    this.canvases.set(
      DEFAULT_CANVAS_ID,
      emptyGraphCanvas(DEFAULT_CANVAS_ID, AUTHENTICATED_SCOPE, 'Canvas'),
    );
    this.canvases.set(
      INSPECTOR_CANVAS_ID,
      emptyGraphCanvas(INSPECTOR_CANVAS_ID, AUTHENTICATED_SCOPE, 'Inspector canvas'),
    );
  }

  private ensureCanvas(canvasId: string): GraphCanvas | null {
    const current = this.canvases.get(canvasId);
    if (current) return current;
    const canvas = emptyGraphCanvas(canvasId, AUTHENTICATED_SCOPE);
    this.commit(canvas);
    return canvas;
  }

  private commit(canvas: GraphCanvas): void {
    this.canvases.set(canvas.id, canvas);
    for (const callback of this.subs) callback();
  }

  private graphFromObject(object: ObjectRef): GraphCanvas | null {
    const value = object.properties[CANVAS_DOCUMENT_PROPERTY];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as unknown as Partial<GraphCanvas>;
    if (
      candidate.id !== object.id
      || typeof candidate.title !== 'string'
      || !Array.isArray(candidate.placements)
      || !Array.isArray(candidate.groups)
      || !Array.isArray(candidate.connections)
      || !Array.isArray(candidate.objects)
    ) {
      return null;
    }
    return {
      ...candidate,
      tenant: typeof candidate.tenant === 'string'
        ? candidate.tenant
        : AUTHENTICATED_SCOPE,
    } as GraphCanvas;
  }

  private ensureHydrated(): Promise<void> {
    if (this.hydration) return this.hydration;
    this.hydration = this.hydrate();
    return this.hydration;
  }

  private async hydrateOne(canvasId: string, title: string): Promise<boolean> {
    const set = await this.host.query({
      types: [CANVAS_TYPE],
      where: { kind: 'eq', field: 'id', value: canvasId },
      page: { limit: 1 },
    });
    const persisted = set.objects
      .map((object) => this.graphFromObject(object))
      .find((canvas): canvas is GraphCanvas => canvas !== null);
    if (persisted) {
      this.persistedIds.add(persisted.id);
      this.commit(persisted);
      return true;
    }
    const blank = this.canvases.get(canvasId)
      ?? emptyGraphCanvas(canvasId, AUTHENTICATED_SCOPE, title);
    const result = await this.persist(blank);
    if (!result.ok || result.value?.status !== 'applied') {
      this.persistenceError = result.error ?? PERSISTENCE_UNAVAILABLE_NOTE;
      return false;
    }
    this.commit(blank);
    return true;
  }

  private async hydrate(): Promise<void> {
    try {
      const results = await Promise.all([
        this.hydrateOne(DEFAULT_CANVAS_ID, 'Canvas'),
        this.hydrateOne(INSPECTOR_CANVAS_ID, 'Inspector canvas'),
      ]);
      if (!results.every(Boolean)) {
        throw new Error(this.persistenceError ?? PERSISTENCE_UNAVAILABLE_NOTE);
      }
      this.persistenceError = null;
      this.hydrationReady = true;
      this.notify();
    } catch (error) {
      this.persistenceError = error instanceof Error
        ? error.message
        : PERSISTENCE_UNAVAILABLE_NOTE;
      this.hydration = null;
      this.notify();
      throw error instanceof Error
        ? error
        : new Error(PERSISTENCE_UNAVAILABLE_NOTE);
    }
  }

  private async requireHydrated(): Promise<boolean> {
    try {
      await this.ensureHydrated();
    } catch {
      return false;
    }
    return this.hydrationReady;
  }

  private notify(): void {
    for (const callback of this.subs) callback();
  }

  private async persist(canvas: GraphCanvas): Promise<Result<ObjectActionReceipt>> {
    const graph = canvas as unknown as JsonValue;
    const action: ObjectAction = this.persistedIds.has(canvas.id)
      ? {
          kind: 'update',
          id: canvas.id,
          patch: {
            title: canvas.title,
            tenant: canvas.tenant,
            persistence_kind: CANVAS_PERSISTENCE_KIND,
            [CANVAS_DOCUMENT_PROPERTY]: graph,
          },
        }
      : {
          kind: 'create',
          type: CANVAS_TYPE,
          props: {
            id: canvas.id,
            title: canvas.title,
            tenant: canvas.tenant,
            persistence_kind: CANVAS_PERSISTENCE_KIND,
            [CANVAS_DOCUMENT_PROPERTY]: graph,
          },
    };
    const result = await this.host.emit(action);
    if (result.ok && result.value?.status === 'applied') {
      this.persistedIds.add(canvas.id);
      this.persistenceError = null;
    } else {
      this.persistenceError = result.error ?? PERSISTENCE_UNAVAILABLE_NOTE;
    }
    return result;
  }

  /** Resolves after the authenticated object seam has restored or seeded the
   * default and inspector canvases. CanvasView stays on ObjectRefs and learns
   * the result through its normal ObjectSet subscription. */
  ready(): Promise<void> {
    return this.ensureHydrated();
  }

  /**
   * Hydrate (or seed) a dynamic canvas id such as `canvas.model.{topicId}`.
   * Must be called before applyJsonCanvas for ids outside PERSISTED_CANVAS_IDS.
   */
  async readyNamedCanvas(canvasId: string, title = 'Model layout'): Promise<void> {
    await this.ensureHydrated();
    if (this.canvases.has(canvasId) && this.persistedIds.has(canvasId)) return;
    const hydrated = await this.hydrateOne(canvasId, title);
    if (!hydrated) {
      throw new Error(this.persistenceError ?? PERSISTENCE_UNAVAILABLE_NOTE);
    }
  }

  /** True once hydrate finished for every id in PERSISTED_CANVAS_IDS. */
  isReady(): boolean {
    return this.hydrationReady;
  }

  persistedCanvasIds(): readonly string[] {
    return PERSISTED_CANVAS_IDS;
  }

  private receipt(actionKind: ObjectActionReceipt['action_kind'], ids: readonly string[]): Result<ObjectActionReceipt> {
    return {
      ok: true,
      value: {
        action_kind: actionKind,
        status: 'applied',
        target_ids: ids,
        legacy_without_op_range: true,
      },
    };
  }

  private findCanvas(id: string): GraphCanvas | null {
    for (const canvas of this.canvases.values()) {
      if (canvas.id === id || canvas.placements.some((placement) => placement.objectId === id) || canvas.groups.some((group) => group.id === id) || canvas.connections.some((connection) => connection.id === id)) return canvas;
    }
    return null;
  }

  query(query: ObjectQuery): ObjectSet {
    void this.ensureHydrated();
    for (const canvasId of PERSISTED_CANVAS_IDS) this.ensureCanvas(canvasId);
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
      notes: this.persistenceError ? [PERSISTENCE_UNAVAILABLE_NOTE] : undefined,
      subscribe: (callback) => this.subscribe(() => callback(this.query(query))),
    };
  }

  private subscribe(callback: () => void): Unsubscribe {
    this.subs.add(callback);
    return () => this.subs.delete(callback);
  }

  owns(action: ObjectAction): boolean {
    if (action.kind === 'create') {
      return isCanvasManagedType(action.type)
        && (
          CANVAS_TYPES.includes(action.type)
          || typeof action.props.canvasId === 'string'
        );
    }
    if (action.kind === 'link' || action.kind === 'unlink') return action.edge === CANVAS_MEMBER_EDGE || action.edge === CANVAS_CONNECT_EDGE;
    if (action.kind === 'invoke_tool') return action.tool === 'canvas.apply_json';
    if (action.kind === 'update' || action.kind === 'delete') return this.findCanvas(action.id) !== null;
    return false;
  }

  getCanvas(canvasId: string): GraphCanvas | null {
    void this.ensureHydrated();
    return this.ensureCanvas(canvasId);
  }

  exportDocument(canvasId: string): JSONCanvas | null {
    const canvas = this.getCanvas(canvasId);
    return canvas ? toJsonCanvas(canvas) : null;
  }

  async importDocument(
    canvasId: string,
    document: JSONCanvas,
  ): Promise<Result<ObjectActionReceipt>> {
    return this.enqueueMutation(() => this.importDocumentOne(canvasId, document));
  }

  private async importDocumentOne(
    canvasId: string,
    document: JSONCanvas,
  ): Promise<Result<ObjectActionReceipt>> {
    if (!await this.requireHydrated()) {
      return { ok: false, error: PERSISTENCE_UNAVAILABLE_NOTE };
    }
    const current = this.canvases.get(canvasId);
    const canvas = fromJsonCanvas(document, {
      canvasId,
      tenant: current?.tenant ?? AUTHENTICATED_SCOPE,
      title: current?.title ?? 'Imported canvas',
    });
    const persisted = await this.persist(canvas);
    if (!persisted.ok || persisted.value?.status !== 'applied') {
      return persisted.ok
        ? { ok: false, error: PERSISTENCE_UNAVAILABLE_NOTE }
        : persisted;
    }
    this.commit(canvas);
    return this.durableReceipt('create', [canvasId], persisted);
  }

  applyJsonCanvas(
    canvasId: string,
    document: JSONCanvas,
  ): Promise<Result<ObjectActionReceipt>> {
    return this.enqueueMutation(() => this.applyJsonCanvasOne(canvasId, document));
  }

  private applyJsonCanvasOne(
    canvasId: string,
    document: JSONCanvas,
  ): Promise<Result<ObjectActionReceipt>> {
    return this.importDocumentOne(canvasId, document).then((result) => (
      result.ok
        ? {
            ...result,
            value: result.value
              ? { ...result.value, action_kind: 'invoke_tool' }
              : result.value,
          }
        : result
    ));
  }

  private enqueueMutation(
    operation: () => Promise<Result<ObjectActionReceipt>>,
  ): Promise<Result<ObjectActionReceipt>> {
    const run = this.mutation.then(operation);
    this.mutation = run.then(() => undefined, () => undefined);
    return run;
  }

  emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    return this.enqueueMutation(() => this.emitOne(action));
  }

  private async emitOne(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    if (!await this.requireHydrated()) {
      return { ok: false, error: PERSISTENCE_UNAVAILABLE_NOTE };
    }
    if (action.kind === 'invoke_tool') {
      if (action.tool !== 'canvas.apply_json') return { ok: false, error: `unknown canvas tool: ${action.tool}` };
      const canvasId = stringValue(action.args.canvasId) ?? DEFAULT_CANVAS_ID;
      try {
        return await this.applyJsonCanvasOne(canvasId, parseCanvasValue(action.args.document));
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'invalid JSON Canvas document' };
      }
    }
    const previousCanvases = new Map(this.canvases);
    const previousDetached = new Map(this.detached);
    const owningCanvasId = action.kind === 'delete'
      ? this.findCanvas(action.id)?.id
      : undefined;
    const local: Result<ObjectActionReceipt> = action.kind === 'create'
      ? this.create(action.type, action.props)
      : action.kind === 'update'
        ? this.update(action.id, action.patch)
        : action.kind === 'link'
          ? this.link(action.from, action.edge, action.to)
          : action.kind === 'unlink'
            ? this.unlink(action.from, action.edge, action.to)
            : action.kind === 'delete'
              ? this.delete(action.id)
              : { ok: false, error: `canvas store cannot handle action: ${action.kind}` };
    if (!local.ok) return local;

    let durable: Result<ObjectActionReceipt>;
    if (action.kind === 'delete' && previousCanvases.has(action.id)) {
      durable = await this.host.emit({ kind: 'delete', id: action.id });
      if (durable.ok) this.persistedIds.delete(action.id);
    } else {
      const canvas = this.findCanvas(
        action.kind === 'create'
          ? stringValue(action.props.canvasId) ?? stringValue(action.props.id) ?? DEFAULT_CANVAS_ID
          : action.kind === 'delete' && owningCanvasId
            ? owningCanvasId
          : action.kind === 'link' || action.kind === 'unlink'
            ? action.from
            : 'id' in action
              ? action.id
              : DEFAULT_CANVAS_ID,
      ) ?? this.canvases.get(DEFAULT_CANVAS_ID);
      durable = canvas
        ? await this.persist(canvas)
        : { ok: false, error: 'canvas persistence target missing' };
    }
    if (!durable.ok || durable.value?.status !== 'applied') {
      this.canvases.clear();
      for (const [id, canvas] of previousCanvases) this.canvases.set(id, canvas);
      this.detached.clear();
      for (const [id, object] of previousDetached) this.detached.set(id, object);
      this.notify();
      return durable.ok
        ? { ok: false, error: PERSISTENCE_UNAVAILABLE_NOTE }
        : durable;
    }
    return this.durableReceipt(action.kind, local.value?.target_ids ?? [], durable);
  }

  private durableReceipt(
    actionKind: ObjectActionReceipt['action_kind'],
    ids: readonly string[],
    durable: Result<ObjectActionReceipt>,
  ): Result<ObjectActionReceipt> {
    if (!durable.ok || durable.value?.status !== 'applied') {
      return durable.ok
        ? { ok: false, error: PERSISTENCE_UNAVAILABLE_NOTE }
        : durable;
    }
    return {
      ok: true,
      value: {
        ...(durable.value ?? {
          action_kind: actionKind,
          status: 'applied' as const,
        }),
        action_kind: actionKind,
        status: 'applied',
        target_ids: ids,
      },
    };
  }

  private create(type: string, props: Readonly<Record<string, JsonValue>>): Result<ObjectActionReceipt> {
    const id = stringValue(props.id) ?? `${type}:${Date.now()}`;
    if (type === CANVAS_TYPE) {
      this.commit(
        emptyGraphCanvas(
          id,
          AUTHENTICATED_SCOPE,
          stringValue(props.title) ?? 'Canvas',
        ),
      );
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
