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
import { HttpBlockHost } from '@commonplace/block-view/host/http';
import { RECORD_FIELDS, seedCodeFiles, seedDocs, seedLayout } from './workspace-seed';
import { CARD_TEMPLATE_TYPE, seedCardTemplates } from './card-templates';
import { memoryObjects, useMemoryProjectionStore } from './memory-projection-store';

const LAYOUT_TYPES = new Set(['surface', 'region', 'view-instance']);
const STORAGE_KEY = 'commonplace.console.surface.v1';

/** Transport health as the host observes it (R2.3): HTTP 403 is the
 *  identity-refusal analog of principal_resolution=unauthenticated. */
export type TransportObserver = (status: number | null) => void;

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

export interface ConsoleBlockHostOptions {
  /** Test-only record pool: the 5000 row fixture lives in tests, never on a
   *  user-reachable route (R2.1). Absent, record queries ride the real data
   *  API through the console's same-origin proxy. */
  readonly records?: ObjectRef[];
  /** Observes every record-wire HTTP outcome for the status bar. */
  readonly onTransport?: TransportObserver;
}

export class ConsoleBlockHost implements BlockHost {
  readonly tokens: ThemeTokens = INTUI_TOKENS;

  private layout = new Map<string, MutableLayout>();
  private records: ObjectRef[] | null;
  private docs: ObjectRef[];
  private codeFiles: ObjectRef[];
  private cardTemplates: ObjectRef[];
  private layoutSubs = new Set<() => void>();
  private domainSubs = new Set<() => void>();
  private registry: Registry;
  private http: HttpBlockHost;
  private observer: TransportObserver | undefined;

  constructor(registry: Registry, options: ConsoleBlockHostOptions = {}) {
    this.registry = registry;
    this.records = options.records ?? null;
    this.observer = options.onTransport;
    // HttpBlockHost appends /objects/query and /objects/action itself, so
    // the console's same-origin base is /api (routes live at /api/objects/*).
    this.http = new HttpBlockHost({
      baseUrl: '/api',
      onStatus: (status) => this.observer?.(status),
    });
    this.docs = seedDocs();
    this.codeFiles = seedCodeFiles();
    // Card templates are seeded objects served through this seam (K1): the
    // card engine queries them like any record, and the Model surface edits
    // them later through the same update action.
    this.cardTemplates = seedCardTemplates();
    this.hydrateLayout();
  }

  /** Cheap health probe for the Reconnect affordance (R2.3): reports through
   *  the same transport observer the record wire uses. */
  async probe(): Promise<void> {
    try {
      const response = await fetch('/api/objects/views', { cache: 'no-store' });
      this.observer?.(response.status);
    } catch {
      this.observer?.(null);
    }
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
    const seed = seedLayout();
    const needsIaMigration = restored !== null && !restored.some((object) => object.id === 'console-chat');
    const objects = needsIaMigration ? seed : (restored ?? seed);
    this.layout = new Map(objects.map((ref) => [ref.id, toMutable(ref)]));
    // Seed migration: a persisted arrangement from an earlier build keeps the
    // user's surfaces untouched while newly seeded surfaces (and their
    // regions and view instances) appear beside them.
    if (restored && !needsIaMigration) {
      let added = false;
      for (const seeded of seed) {
        if (!this.layout.has(seeded.id)) {
          this.layout.set(seeded.id, toMutable(seeded));
          added = true;
        }
      }
      if (added) this.persistLayout();
    }
  }

  /** Drop the persisted arrangement and return to the seed. */
  resetLayout(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    this.layout = new Map(seedLayout().map((ref) => [ref.id, toMutable(ref)]));
    this.notifyLayout();
  }

  /** Apply a radio-group surface switch as one layout transaction. Subscribers
   *  never observe zero or two active surfaces between individual updates. */
  async activateSurface(surfaceId: string): Promise<boolean> {
    const target = this.layout.get(surfaceId);
    if (target?.type !== 'surface') return false;
    for (const candidate of this.layout.values()) {
      if (candidate.type === 'surface') candidate.properties.active = candidate.id === surfaceId;
    }
    this.persistLayout();
    this.notifyLayout();
    return true;
  }

  /** Toggle a region and optionally close same-side peers in one transaction.
   *  Compact overlays use this to keep exactly one panel visible per side. */
  async setRegionOpen(regionId: string, open: boolean, exclusivePeerIds: readonly string[] = []): Promise<boolean> {
    const region = this.layout.get(regionId);
    if (region?.type !== 'region') return false;
    if (open) {
      for (const peerId of exclusivePeerIds) {
        const peer = this.layout.get(peerId);
        if (peer?.type === 'region') peer.properties.open = false;
      }
    }
    region.properties.open = open;
    this.persistLayout();
    this.notifyLayout();
    return true;
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

  query(query: ObjectQuery): ObjectSet | Promise<ObjectSet> {
    if (query.types.some((type) => LAYOUT_TYPES.has(type))) return this.layoutSet(query);
    if (query.types.includes('memory')) return this.memorySet(query);
    // The live wire is the default (R2.1): records, hunks, and every domain
    // kind the seam serves (person, task, mention-candidate, ...) round-trip
    // through the data API proxy. Documents and code files ride the live wire
    // too so edits persist to the backend (the file-editing fix): the backend
    // is the source of truth, but the console filters/sorts/pages client-side
    // so slug and id predicates behave exactly as the seed path did.
    // Console-owned seeds stay local: card templates (K1, authored objects)
    // and 'thread' (the pane renders its own chat SSE, never the record wire).
    const testMode = this.records !== null;
    const isRecord = query.types.includes('record');
    const isDoc = query.types.includes('doc');
    const isCode = query.types.includes('code-file');
    // Console-local kinds never touch the wire: 'thread' (its pane renders its
    // own chat SSE) and card templates (K1, console-authored seeds).
    const consoleLocal =
      query.types.includes('thread') ||
      query.types.includes('files-view') ||
      query.types.includes('context-view') ||
      query.types.includes('surface-tool') ||
      query.types.includes(CARD_TEMPLATE_TYPE);
    if (!testMode && !consoleLocal) {
      // Docs and code files are client-filtered so slug/id predicates resolve
      // exactly as the seed path did; every other seam kind (record, person,
      // task, project, org, mention-candidate, hunk, ...) filters API-side.
      if (query.types.length === 1 && (isDoc || isCode)) {
        return this.queryLiveDomain(query, isDoc ? 'doc' : 'code-file');
      }
      return this.http.query(query);
    }
    const pool = isRecord
      ? (this.records ?? [])
      : isDoc
        ? this.docs
        : isCode
          ? this.codeFiles
          : query.types.includes(CARD_TEMPLATE_TYPE)
            ? this.cardTemplates
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
        // This branch only serves local pools, so re-running the query is
        // synchronous by construction.
        const listener = () => callback(this.query(query) as ObjectSet);
        this.domainSubs.add(listener);
        return () => this.domainSubs.delete(listener);
      },
    };
  }

  private memorySet(query: ObjectQuery): ObjectSet {
    let objects = memoryObjects().filter((object) => matchesPredicate(object, query.where));
    let nextCursor: string | undefined;
    if (query.page) {
      const offset = query.page.cursor ? Number.parseInt(query.page.cursor, 10) || 0 : 0;
      const end = offset + query.page.limit;
      if (end < objects.length) nextCursor = String(end);
      objects = objects.slice(offset, end);
    }
    const shape: ObjectShape = {
      types: ['memory'],
      fields: ['object_id', 'title', 'markdown', 'projection_path', 'source', 'updated', 'read_only_reason'],
      relations: [],
      axes: {},
      cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
    };
    return {
      objects,
      shape,
      next_cursor: nextCursor,
      subscribe: (callback) => useMemoryProjectionStore.subscribe(() => callback(this.memorySet(query))),
    };
  }

  /** Documents and code files over the live wire: fetch the kind from the
   *  backend, then filter, sort, and page with the console's own client logic
   *  so a `where slug eq` or `where path eq` predicate resolves identically to
   *  the former seed path (no dependency on the API's predicate support). */
  private async queryLiveDomain(query: ObjectQuery, type: string): Promise<ObjectSet> {
    const allObjects: ObjectRef[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.http.query({ types: [type], page: { limit: 500, cursor } });
      allObjects.push(...page.objects);
      const next = page.next_cursor;
      if (!next || next === cursor) break;
      cursor = next;
    } while (cursor);
    let objects = allObjects.filter((object) => matchesPredicate(object, query.where));
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
    return {
      objects,
      shape: {
        types: [...query.types],
        fields: Object.keys(objects[0]?.properties ?? {}),
        relations: [],
        axes: {},
        cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
      },
      next_cursor: nextCursor,
      subscribe: () => () => {},
    };
  }

  /** Seed the backend with the console's document fixtures once, keyed by slug
   *  and path, so the deployed (in-memory, resets on restart) API has editable,
   *  persistent content instead of client-only seeds. Content rides as extra
   *  properties (markdown / content) so the projection returns exactly what the
   *  Galley and CodeMirror views read. Idempotent: absent keys only. */
  async ensureSeedContent(): Promise<void> {
    if (this.records !== null) return;
    try {
      const existingDocs = await this.http.query({ types: ['doc'], page: { limit: 200 } });
      const slugs = new Set(existingDocs.objects.map((object) => object.properties.slug));
      for (const doc of this.docs) {
        if (slugs.has(doc.properties.slug)) continue;
        await this.http.emit({
          kind: 'create',
          type: 'doc',
          props: {
            title: doc.properties.title,
            slug: doc.properties.slug,
            markdown: doc.properties.markdown,
          },
        });
      }
      const existingCode = await this.http.query({ types: ['code-file'], page: { limit: 200 } });
      const paths = new Set(existingCode.objects.map((object) => object.properties.path));
      for (const file of this.codeFiles) {
        if (paths.has(file.properties.path)) continue;
        await this.http.emit({
          kind: 'create',
          type: 'code-file',
          props: {
            title: file.properties.path,
            path: file.properties.path,
            language: file.properties.language,
            content: file.properties.content,
          },
        });
      }
    } catch {
      // Backend unreachable: the Documents surface renders its empty state.
    }
  }

  /** The arrangement branch is always synchronous and local: the shell's
   *  layout store reads it without awaiting. */
  queryLayout(query: ObjectQuery): ObjectSet {
    return this.layoutSet(query);
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
        // In live mode only card templates patch in-session (console-authored
        // seeds); records, docs, and code files ride the wire so edits persist.
        // In test mode the local pools carry every kind.
        const updatePools =
          this.records === null
            ? [this.cardTemplates]
            : [this.records, this.docs, this.codeFiles, this.cardTemplates];
        for (const pool of updatePools) {
          const index = pool.findIndex((object) => object.id === action.id);
          if (index >= 0) {
            pool[index] = { ...pool[index], properties: { ...pool[index].properties, ...action.patch } };
            for (const callback of this.domainSubs) callback();
            return Promise.resolve(applied([action.id]));
          }
        }
        if (this.records === null) return this.http.emit(action);
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
      case 'invoke_tool':
      case 'dispatch':
        // Consequential domain actions always ride the object seam. In
        // particular hunk.accept/reject/verify/edit bind to Rust executors and
        // their receipts instead of ending at a client-side JSON scaffold.
        return this.http.emit(action);
      default:
        // open / select / link / run_agent are UI or substrate concerns.
        return Promise.resolve(accepted());
    }
  }

  viewsFor(shape: ObjectShape): readonly ViewDescriptor[] {
    return this.registry.matchingViews(shape);
  }
}
