'use client';

// SOURCING: @commonplace/block-view (BlockHost contract, surface tree,
// action semantics). This host is the console's concrete BlockHost: the
// arrangement graph with real move/update semantics plus the seeded domain
// fixtures, persisted so splitter drags and pane rearrangement survive reload.

import type {
  BlockHost,
  JsonValue,
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  ObjectShape,
  Predicate,
  Result,
  ThemeTokens,
  Unsubscribe,
  ViewDescriptor,
} from '@commonplace/block-view/types';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import { RECORD_FIELDS, seedCodeFiles, seedDocs, seedLayout, seedRecords } from './workspace-seed';

const LAYOUT_TYPES = new Set(['surface', 'region', 'view-instance']);
const STORAGE_KEY = 'commonplace.console.surface.v1';

// The console theme tokens: every value is a register variable reference.
const INTUI_TOKENS: ThemeTokens = {
  color: {
    ground: 'var(--ij-frame)',
    surface: 'var(--ij-chrome)',
    editor: 'var(--ij-editor)',
    raised: 'var(--ij-raised)',
    ink: 'var(--ij-ink)',
    info: 'var(--ij-ink-info)',
    accent: 'var(--ij-accent)',
    gold: 'var(--ij-gold)',
  },
  space: { grid: 'var(--rec-grid)' },
  typography: { ui: 'var(--ij-font-ui)', mono: 'var(--ij-font-mono)' },
  radius: { arc: 'var(--ij-arc)', underline: 'var(--ij-arc-underline)' },
};

type Registry = { matchingViews(shape: ObjectShape): readonly ViewDescriptor[] };

interface MutableLayout {
  id: string;
  type: string;
  properties: Record<string, JsonValue>;
  children: string[];
}

function toMutable(ref: ObjectRef): MutableLayout {
  return {
    id: ref.id,
    type: ref.type,
    properties: { ...ref.properties },
    children: [...(ref.relations?.[CONTAINS_EDGE] ?? [])],
  };
}

function toRef(layout: MutableLayout): ObjectRef {
  return {
    id: layout.id,
    type: layout.type,
    properties: layout.properties,
    relations: layout.children.length > 0 ? { [CONTAINS_EDGE]: layout.children } : { [CONTAINS_EDGE]: [] },
  };
}

function matchesPredicate(object: ObjectRef, predicate: Predicate | undefined): boolean {
  if (!predicate) return true;
  switch (predicate.kind) {
    case 'eq':
      return object.properties[predicate.field] === predicate.value;
    case 'not_eq':
      return object.properties[predicate.field] !== predicate.value;
    case 'contains': {
      const value = object.properties[predicate.field];
      if (typeof value === 'string' && typeof predicate.value === 'string') {
        return value.toLowerCase().includes(predicate.value.toLowerCase());
      }
      if (Array.isArray(value)) return value.includes(predicate.value as never);
      return false;
    }
    case 'exists':
      return predicate.field in object.properties;
    case 'and':
      return predicate.all.every((inner) => matchesPredicate(object, inner));
    case 'or':
      return predicate.any.some((inner) => matchesPredicate(object, inner));
    case 'not':
      return !matchesPredicate(object, predicate.predicate);
    default:
      return true;
  }
}

function compareValues(a: JsonValue | undefined, b: JsonValue | undefined): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

export class ConsoleBlockHost implements BlockHost {
  readonly tokens: ThemeTokens = INTUI_TOKENS;

  private layout = new Map<string, MutableLayout>();
  private records: ObjectRef[];
  private docs: ObjectRef[];
  private codeFiles: ObjectRef[];
  private layoutSubs = new Set<() => void>();
  private domainSubs = new Set<() => void>();
  private registry: Registry;

  constructor(registry: Registry) {
    this.registry = registry;
    this.records = seedRecords();
    this.docs = seedDocs();
    this.codeFiles = seedCodeFiles();
    this.hydrateLayout();
  }

  private hydrateLayout(): void {
    let restored: ObjectRef[] | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) restored = JSON.parse(raw) as ObjectRef[];
      } catch {
        restored = null;
      }
    }
    const objects = restored ?? seedLayout();
    this.layout = new Map(objects.map((ref) => [ref.id, toMutable(ref)]));
  }

  /** Drop the persisted arrangement and return to the seed. */
  resetLayout(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    this.layout = new Map(seedLayout().map((ref) => [ref.id, toMutable(ref)]));
    this.notifyLayout();
  }

  private persistLayout(): void {
    if (typeof window === 'undefined') return;
    const objects = [...this.layout.values()].map(toRef);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(objects));
    } catch {
      // Storage full or unavailable: the in-memory arrangement still works.
    }
  }

  private notifyLayout(): void {
    for (const callback of this.layoutSubs) callback();
  }

  private onLayoutChange(callback: () => void): Unsubscribe {
    this.layoutSubs.add(callback);
    return () => this.layoutSubs.delete(callback);
  }

  query(query: ObjectQuery): ObjectSet {
    if (query.types.some((type) => LAYOUT_TYPES.has(type))) return this.layoutSet(query);
    const pool = query.types.includes('record')
      ? this.records
      : query.types.includes('doc')
        ? this.docs
        : query.types.includes('code-file')
          ? this.codeFiles
          : [];
    let objects = pool.filter((object) => matchesPredicate(object, query.where));
    const ranker = query.rank?.[0];
    if (ranker?.kind === 'field') {
      const direction = ranker.direction === 'desc' ? -1 : 1;
      objects = [...objects].sort(
        (a, b) => direction * compareValues(a.properties[ranker.field], b.properties[ranker.field]),
      );
    }
    let nextCursor: string | undefined;
    if (query.page) {
      const offset = query.page.cursor ? Number.parseInt(query.page.cursor, 10) || 0 : 0;
      const end = offset + query.page.limit;
      if (end < objects.length) nextCursor = String(end);
      objects = objects.slice(offset, end);
    }
    const shape: ObjectShape = {
      types: [...query.types],
      fields: query.types.includes('record') ? [...RECORD_FIELDS] : Object.keys(objects[0]?.properties ?? {}),
      relations: [],
      axes: {},
      cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
    };
    return {
      objects,
      shape,
      next_cursor: nextCursor,
      subscribe: (callback) => {
        const listener = () => callback(this.query(query));
        this.domainSubs.add(listener);
        return () => this.domainSubs.delete(listener);
      },
    };
  }

  private layoutSet(query: ObjectQuery): ObjectSet {
    const objects = [...this.layout.values()].map(toRef);
    return {
      objects,
      shape: {
        types: [...query.types],
        fields: [],
        relations: [{ edge: CONTAINS_EDGE, dir: 'out' }],
        axes: {},
        cardinality: objects.length > 0 ? 'many' : 'empty',
      },
      subscribe: (callback) => this.onLayoutChange(() => callback(this.layoutSet(query))),
    };
  }

  emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    const applied = (targetIds: readonly string[]): Result<ObjectActionReceipt> => ({
      ok: true,
      value: { action_kind: action.kind, status: 'applied', target_ids: targetIds },
    });
    const accepted = (): Result<ObjectActionReceipt> => ({
      ok: true,
      value: { action_kind: action.kind, status: 'accepted' },
    });

    switch (action.kind) {
      case 'move': {
        const node = this.layout.get(action.id);
        const parent = this.layout.get(action.new_parent);
        if (!node || !parent) {
          return Promise.resolve({ ok: false, error: `move target missing: ${action.id} -> ${action.new_parent}` });
        }
        for (const candidate of this.layout.values()) {
          candidate.children = candidate.children.filter((childId) => childId !== action.id);
        }
        const order = Math.max(0, Math.min(action.order, parent.children.length));
        parent.children.splice(order, 0, action.id);
        this.persistLayout();
        this.notifyLayout();
        return Promise.resolve(applied([action.id]));
      }
      case 'update': {
        const node = this.layout.get(action.id);
        if (node) {
          node.properties = { ...node.properties, ...action.patch };
          this.persistLayout();
          this.notifyLayout();
          return Promise.resolve(applied([action.id]));
        }
        // Domain objects (records, docs) patch in-session; the substrate
        // write path lands when a live host replaces the fixtures.
        for (const pool of [this.records, this.docs, this.codeFiles]) {
          const index = pool.findIndex((object) => object.id === action.id);
          if (index >= 0) {
            pool[index] = { ...pool[index], properties: { ...pool[index].properties, ...action.patch } };
            for (const callback of this.domainSubs) callback();
            return Promise.resolve(applied([action.id]));
          }
        }
        return Promise.resolve({ ok: false, error: `update target missing: ${action.id}` });
      }
      case 'create': {
        if (!LAYOUT_TYPES.has(action.type)) return Promise.resolve(accepted());
        const id = typeof action.props.id === 'string' ? action.props.id : `vi-${this.layout.size + 1}`;
        this.layout.set(id, { id, type: action.type, properties: { ...action.props }, children: [] });
        this.persistLayout();
        this.notifyLayout();
        return Promise.resolve(applied([id]));
      }
      case 'delete': {
        if (!this.layout.has(action.id)) return Promise.resolve(accepted());
        this.layout.delete(action.id);
        for (const candidate of this.layout.values()) {
          candidate.children = candidate.children.filter((childId) => childId !== action.id);
        }
        this.persistLayout();
        this.notifyLayout();
        return Promise.resolve(applied([action.id]));
      }
      default:
        // open / select / link / run_agent are UI or substrate concerns.
        return Promise.resolve(accepted());
    }
  }

  viewsFor(shape: ObjectShape): readonly ViewDescriptor[] {
    return this.registry.matchingViews(shape);
  }
}
