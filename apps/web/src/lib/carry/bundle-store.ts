/**
 * Session evidence bundle store (HANDOFF-CARRY D1).
 *
 * A browsing session passively accumulates a cited evidence bundle: highlights
 * expanded, passages Kept, margin threads, pages Kept, entity intersects. The
 * bundle is local-first (IndexedDB), keyed by the co-browse session id, and
 * survives an app restart with the session (C1.4).
 *
 * Nothing enters as bare text: every item carries full provenance (source URL,
 * capture time, an optional connection explanation, and receipt ids), so a
 * carried quote stays clickable back to its exact source passage downstream.
 *
 * Persistence is IndexedDB in the browser and an in-memory map elsewhere (SSR,
 * tests), behind one async interface. The in-memory fallback is not a mock: it
 * is the same real bundle, just not durable, which is the correct behavior when
 * there is no IndexedDB to persist to.
 */

/** The five browse event kinds the bundle accumulates (spec D1). */
export type BundleEventKind =
  | 'highlight' // a highlight expanded into the bundle
  | 'keep' // a passage Kept
  | 'margin_thread' // a margin thread (annotation conversation)
  | 'page_kept' // a whole page Kept
  | 'entity_intersect'; // an entity intersection surfaced

/** Where an item came from, precise enough to reopen the source at the passage. */
export interface SourceAnchor {
  url: string;
  title?: string;
  /** The exact quoted passage, when the item is a quote. */
  quote?: string;
  /**
   * A text fragment or serialized range that reopens the source at the exact
   * passage (e.g. a `:~:text=` fragment or a coannotate range descriptor).
   */
  fragment?: string;
}

/** One accumulated piece of evidence with its full provenance. */
export interface BundleItem {
  id: string;
  sessionId: string;
  kind: BundleEventKind;
  /** Capture time (epoch ms). */
  at: number;
  anchor: SourceAnchor;
  /** Why this was surfaced or connected: the connection explanation (spec D1). */
  connectionExplanation?: string;
  /** Receipt ids tying this item to its Keep / ingestion receipt. */
  receiptIds?: string[];
  /** Margin thread messages, for the `margin_thread` kind. */
  thread?: { author: string; text: string; at: number }[];
  /** Entities, for the `entity_intersect` kind. */
  entities?: string[];
  /** Free metadata; rides through into the evidence_bundle record metadata. */
  meta?: Record<string, unknown>;
}

/** A session's whole bundle, persisted as one record. */
export interface SessionBundle {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  items: BundleItem[];
  /** Ancestor bundle for Carry to Research lineage (C4.2), when this session
   *  was seeded from a prior one. */
  parentSessionId?: string;
  /** Descendant sessions seeded from this one, for both-directions navigation
   *  of the research lineage (C4.2). */
  childSessionIds?: string[];
}

/** The append payload: everything about an item except the store-assigned id
 *  and session id; capture time is optional (defaults to now). */
export type BundleEventInput = Omit<BundleItem, 'id' | 'sessionId' | 'at'> & { at?: number };

const DB_NAME = 'commonplace-carry';
const STORE_NAME = 'bundles';
const DB_VERSION = 1;

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  // Deterministic-enough fallback for non-crypto environments.
  return `${prefix}-${Date.now().toString(36)}-${Math.round(Math.random() * 1e9).toString(36)}`;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

// In-memory fallback (SSR / tests): the same real bundle, not durable.
const memory = new Map<string, SessionBundle>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBundle(sessionId: string): Promise<SessionBundle | undefined> {
  if (!hasIndexedDb()) {
    const found = memory.get(sessionId);
    return found ? structuredCloneSafe(found) : undefined;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(sessionId);
    req.onsuccess = () => resolve((req.result as SessionBundle | undefined) ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

async function writeBundle(bundle: SessionBundle): Promise<void> {
  if (!hasIndexedDb()) {
    memory.set(bundle.sessionId, structuredCloneSafe(bundle));
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bundle);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

// Change subscription so the session chrome count (C1.3) updates live as events
// append, without polling. Framework-agnostic: React binds via a hook.
type BundleListener = () => void;
const listeners = new Map<string, Set<BundleListener>>();

export function subscribeBundle(sessionId: string, listener: BundleListener): () => void {
  const set = listeners.get(sessionId) ?? new Set<BundleListener>();
  set.add(listener);
  listeners.set(sessionId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(sessionId);
  };
}

function notify(sessionId: string): void {
  const set = listeners.get(sessionId);
  if (!set) return;
  for (const listener of set) listener();
}

// Per-session append serialization so concurrent events never lose a write in
// the read-modify-write cycle.
const appendChains = new Map<string, Promise<unknown>>();

function serialize<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  const prior = appendChains.get(sessionId) ?? Promise.resolve();
  const next = prior.then(task, task);
  appendChains.set(
    sessionId,
    next.catch(() => undefined),
  );
  return next;
}

function nowMs(): number {
  return typeof performance !== 'undefined' && 'timeOrigin' in performance
    ? Date.now()
    : Date.now();
}

/**
 * Append one browse event to a session's bundle, creating the bundle on first
 * write. Returns the stored item (with its assigned id). Reads before that
 * item are unaffected; the bundle only grows.
 */
export async function appendEvent(
  sessionId: string,
  event: BundleEventInput,
): Promise<BundleItem> {
  return serialize(sessionId, async () => {
    const existing = await readBundle(sessionId);
    const at = event.at ?? nowMs();
    const item: BundleItem = {
      ...event,
      at,
      id: newId('bi'),
      sessionId,
    };
    const bundle: SessionBundle = existing
      ? { ...existing, items: [...existing.items, item], updatedAt: at }
      : { sessionId, createdAt: at, updatedAt: at, items: [item] };
    await writeBundle(bundle);
    notify(sessionId);
    return item;
  });
}

/** The whole bundle for a session, or undefined if the session has none yet. */
export async function getBundle(sessionId: string): Promise<SessionBundle | undefined> {
  return readBundle(sessionId);
}

/** The items for a session (empty when the session has no bundle yet). */
export async function getItems(sessionId: string): Promise<BundleItem[]> {
  const bundle = await readBundle(sessionId);
  return bundle?.items ?? [];
}

/** The current item count for a session (drives the Carry affordance, C1.3). */
export async function getCount(sessionId: string): Promise<number> {
  const bundle = await readBundle(sessionId);
  return bundle?.items.length ?? 0;
}

/**
 * Link a session's bundle to its ancestor (Carry to Research lineage, C4.2).
 * Bidirectional: records the parent on the child and the child on the parent, so
 * the lineage is navigable both ways. Idempotent; creates either bundle if it
 * does not exist yet.
 */
export async function linkAncestor(
  sessionId: string,
  parentSessionId: string,
): Promise<void> {
  await serialize(sessionId, async () => {
    const existing = await readBundle(sessionId);
    const at = nowMs();
    const bundle: SessionBundle = existing
      ? { ...existing, parentSessionId, updatedAt: at }
      : { sessionId, createdAt: at, updatedAt: at, items: [], parentSessionId };
    await writeBundle(bundle);
    notify(sessionId);
  });
  // Record the descendant on the parent (separate serialize chain, its own key).
  await serialize(parentSessionId, async () => {
    const parent = await readBundle(parentSessionId);
    const at = nowMs();
    const children = new Set(parent?.childSessionIds ?? []);
    children.add(sessionId);
    const bundle: SessionBundle = parent
      ? { ...parent, childSessionIds: [...children], updatedAt: at }
      : { sessionId: parentSessionId, createdAt: at, updatedAt: at, items: [], childSessionIds: [...children] };
    await writeBundle(bundle);
    notify(parentSessionId);
  });
}

/** Remove a session's bundle (used by tests and explicit clears). */
export async function clearBundle(sessionId: string): Promise<void> {
  await serialize(sessionId, async () => {
    if (!hasIndexedDb()) {
      memory.delete(sessionId);
      notify(sessionId);
      return;
    }
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(sessionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }).then(() => notify(sessionId));
}
