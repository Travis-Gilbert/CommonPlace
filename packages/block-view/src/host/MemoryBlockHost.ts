'use client';

/**
 * MemoryBlockHost — the first concrete `BlockHost` in the web app.
 *
 * It IS the object model: `query` returns ObjectSets of ObjectRef, `emit` applies
 * ObjectActions and notifies subscribers. It serves two shapes from one graph:
 *   - the arrangement (surface/region/view-instance ObjectRefs) so Codex's
 *     SurfaceRenderer can walk it, and
 *   - the domain rows (a DbObjectSet that also carries resolved `items`) so the
 *     registered `database` renderer gets typed cells without re-resolving.
 * `viewsFor` offers the single `database` descriptor. Swap this for an
 * HttpBlockHost pointed at the substrate and nothing above it changes.
 */

import type {
  BlockHost,
  JsonValue,
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  ObjectShape,
  Result,
  ThemeTokens,
  Unsubscribe,
  ViewDescriptor,
} from "../types";
import { type ChangefeedEventPayload, eventMatchesQuery } from "./changefeed";
import { makeCell, type Cell, type DbObject, type ObjectGraph, type RelationMeta } from "../database/model";

const PORCELAIN_TOKENS: ThemeTokens = {
  color: { ground: "var(--g0)", raised: "var(--raised)", ink: "var(--ink)", dim: "var(--ink-dim)", accent: "var(--accent)", hair: "var(--hair)" },
  space: { u: "var(--u)" },
  typography: { body: "var(--font-body)", display: "var(--font-display)", mono: "var(--font-mono)" },
  radius: { band: "var(--r-band)", row: "var(--r-row)" },
};

const LAYOUT_TYPES = new Set(["surface", "region", "view-instance"]);
let SEQ = 0;

/** The one descriptor a Set exposes: the full DatabaseView (its own view tabs). */
export const DATABASE_DESCRIPTOR: ViewDescriptor = {
  id: "database",
  name: "Database",
  renderer: "database",
  accepts: { cardinality: "any" },
  emits: ["update", "create", "delete", "move", "open", "select"],
  source: { package: "commonplace", component: "DatabaseSurfaceView", mode: "bespoke", regime: "css-vars", allowedBespokeReason: "Anytype-grade Set view over the resolved object graph" },
  render: (() => null) as unknown as ViewDescriptor["render"],
};

export interface DbObjectSet extends ObjectSet {
  /** the resolved objects behind `objects`, in the same order. */
  readonly items: readonly DbObject[];
}

export interface DbHost extends BlockHost {
  readonly graph: ObjectGraph;
  list(): readonly DbObject[];
  object(id: string): DbObject | undefined;
  relation(key: string): RelationMeta | undefined;
  onChange(cb: () => void): Unsubscribe;
}

/** Raw ObjectRef projection — the true object-model view of a resolved object. */
function toRef(o: DbObject): ObjectRef {
  const properties: Record<string, JsonValue> = { title: o.title };
  if (o.emoji) properties.icon = o.emoji;
  for (const [k, c] of Object.entries(o.cells)) {
    properties[k] = (c.options?.map((x) => x.id) ??
      c.refs?.map((r) => r.id) ??
      c.files?.map((f) => f.id) ??
      c.text ??
      c.number ??
      c.date ??
      c.bool ??
      c.url ??
      null) as JsonValue;
  }
  return { id: o.id, type: o.typeKey, properties };
}

export class MemoryBlockHost implements DbHost {
  graph: ObjectGraph;
  readonly tokens: ThemeTokens = PORCELAIN_TOKENS;
  private objects: DbObject[];
  private surfaceObjects: readonly ObjectRef[];
  private subs = new Set<() => void>();
  private liveSubs = new Set<{ query: ObjectQuery; notify: () => void }>();

  constructor(graph: ObjectGraph, surfaceObjects: readonly ObjectRef[] = []) {
    this.graph = graph;
    this.objects = [...graph.objects];
    this.surfaceObjects = surfaceObjects;
  }

  list(): readonly DbObject[] {
    return this.objects;
  }
  object(id: string): DbObject | undefined {
    return this.objects.find((o) => o.id === id);
  }
  relation(key: string): RelationMeta | undefined {
    return this.graph.relations[key];
  }
  onChange(cb: () => void): Unsubscribe {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }
  private notify() {
    for (const cb of this.subs) cb();
  }

  /** Test hook: fan-out a synthetic changefeed event to live subscribers. */
  emitTestEvent(payload: ChangefeedEventPayload = {}): void {
    for (const entry of this.liveSubs) {
      if (eventMatchesQuery(payload, entry.query)) entry.notify();
    }
  }

  private subscribeQuery(q: ObjectQuery, cb: (next: ObjectSet) => void): Unsubscribe {
    const notify = () => cb(this.query(q));
    if (q.live) {
      const entry = { query: q, notify };
      this.liveSubs.add(entry);
      const stopChange = this.onChange(notify);
      return () => {
        this.liveSubs.delete(entry);
        stopChange();
      };
    }
    return this.onChange(notify);
  }

  query(q: ObjectQuery): ObjectSet {
    if (q.types.some((t) => LAYOUT_TYPES.has(t))) {
      const objects = this.surfaceObjects;
      return {
        objects,
        shape: { types: [...q.types], fields: [], relations: [], axes: {}, cardinality: objects.length ? "many" : "empty" },
        subscribe: (cb) => this.subscribeQuery(q, cb),
      };
    }
    const items = this.objects.filter((o) => q.types.length === 0 || q.types.includes(o.typeKey));
    const set: DbObjectSet = {
      items,
      objects: items.map(toRef),
      shape: { types: [...q.types], fields: Object.keys(this.graph.relations), relations: [], axes: {}, cardinality: items.length ? "many" : "empty" },
      subscribe: (cb) => this.subscribeQuery(q, cb),
    };
    return set;
  }

  emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    const receipt = (extra: Partial<ObjectActionReceipt>): Result<ObjectActionReceipt> => ({
      ok: true,
      value: { action_kind: action.kind, status: "applied", ...extra },
    });
    switch (action.kind) {
      case "update": {
        this.objects = this.objects.map((o) => (o.id === action.id ? this.patch(o, action.patch) : o));
        this.notify();
        return Promise.resolve(receipt({ target_ids: [action.id] }));
      }
      case "delete": {
        this.objects = this.objects.filter((o) => o.id !== action.id);
        this.notify();
        return Promise.resolve(receipt({ target_ids: [action.id] }));
      }
      case "create": {
        const id = `new-${++SEQ}`;
        const blank: DbObject = { id, typeKey: this.graph.type.key, title: String(action.props.title ?? "Untitled"), cells: {}, origin: "seed" };
        this.objects = [this.patch(blank, action.props), ...this.objects];
        this.notify();
        return Promise.resolve(receipt({ target_ids: [id] }));
      }
      default:
        // open / select / link / move / etc. are UI- or arrangement-level.
        return Promise.resolve(receipt({ status: "accepted" }));
    }
  }

  viewsFor(_shape: ObjectShape): readonly ViewDescriptor[] {
    return [DATABASE_DESCRIPTOR];
  }

  /** Apply a property patch, re-resolving any touched relation into a Cell. */
  private patch(o: DbObject, patch: Readonly<Record<string, JsonValue>>): DbObject {
    const cells: Record<string, Cell> = { ...o.cells };
    let title = o.title;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "title") {
        title = String(value ?? o.title);
        continue;
      }
      const meta = this.graph.relations[key] ?? { key, name: key, format: "longtext" as const };
      const cell = makeCell(meta, value, this.graph.options);
      if (cell.empty) delete cells[key];
      else cells[key] = cell;
    }
    return { ...o, title, cells };
  }
}
