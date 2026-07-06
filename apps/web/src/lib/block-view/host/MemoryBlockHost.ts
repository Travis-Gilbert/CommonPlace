/**
 * MemoryBlockHost — the first concrete `BlockHost` in the web app.
 *
 * It IS the object model: `query` returns ObjectSets of ObjectRef, `emit`
 * applies ObjectActions and notifies subscribers. It also exposes the resolved
 * database projection (`list`/`object`/`relation`) so Set-view renderers get
 * typed cells without re-resolving option/ref ids. Swap this for an HttpBlockHost
 * pointed at the substrate and nothing above it changes.
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
import { makeCell, type Cell, type DbObject, type ObjectGraph, type RelationMeta } from "../database/model";

const EMPTY_TOKENS: ThemeTokens = { color: {}, space: {}, typography: {}, radius: {} };
let SEQ = 0;

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
  readonly tokens: ThemeTokens = EMPTY_TOKENS;
  private objects: DbObject[];
  private subs = new Set<() => void>();

  constructor(graph: ObjectGraph) {
    this.graph = graph;
    this.objects = [...graph.objects];
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

  query(q: ObjectQuery): ObjectSet {
    const items = this.objects.filter((o) => q.types.length === 0 || q.types.includes(o.typeKey));
    const set: DbObjectSet = {
      items,
      objects: items.map(toRef),
      shape: { types: q.types, fields: [], relations: [], axes: {}, cardinality: items.length ? "many" : "empty" },
      subscribe: (cb) => this.onChange(() => cb(this.query(q))),
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
        const blank: DbObject = {
          id,
          typeKey: this.graph.type.key,
          title: String(action.props.title ?? "Untitled"),
          cells: {},
          origin: "seed",
        };
        this.objects = [this.patch(blank, action.props), ...this.objects];
        this.notify();
        return Promise.resolve(receipt({ target_ids: [id] }));
      }
      default:
        // open / select / link / move / etc. are UI-level or arrangement-level;
        // accept without mutating the resolved rows.
        return Promise.resolve(receipt({ status: "accepted" }));
    }
  }

  viewsFor(_shape: ObjectShape): readonly ViewDescriptor[] {
    return [];
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
