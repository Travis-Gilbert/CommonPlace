'use client';

/**
 * Local-first read cache (SPEC-UX-PHYSICS D2). A synchronous last-value store so a
 * read-bearing surface can seed from cache in the same frame it mounts (loading
 * false when a value exists) and revalidate the network in the background, without
 * clearing or jumping.
 *
 * Design note: the spec names IndexedDB, but IndexedDB reads are asynchronous and
 * cannot seed the first paint after a browser refresh synchronously, which is the
 * observable acceptance ("refresh does not clear or jump"). This uses an in-memory
 * map (synchronous within a session) backed by localStorage (synchronous, survives
 * refresh, size guarded). Values larger than the cap stay in memory only, so the
 * cache degrades to a session cache for them rather than throwing on quota.
 */

const MEMORY = new Map<string, unknown>();
const LS_PREFIX = 'cpread:';
// Per-key cap. Above this a value is kept in memory only (not persisted to
// localStorage), so one large payload cannot blow the ~5MB origin quota.
const MAX_PERSIST_CHARS = 512 * 1024;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Synchronous read: memory first, then a lazy synchronous hydrate from localStorage. */
export function readCacheSync<T>(key: string): T | undefined {
  if (MEMORY.has(key)) return MEMORY.get(key) as T;
  if (!hasLocalStorage()) return undefined;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (raw == null) return undefined;
    const value = JSON.parse(raw) as T;
    MEMORY.set(key, value);
    return value;
  } catch {
    return undefined;
  }
}

/** Write-through: always to memory, and to localStorage when the value fits and is serialisable. */
export function writeCache<T>(key: string, value: T): void {
  MEMORY.set(key, value);
  if (!hasLocalStorage()) return;
  try {
    const raw = JSON.stringify(value);
    if (raw.length > MAX_PERSIST_CHARS) return;
    window.localStorage.setItem(LS_PREFIX + key, raw);
  } catch {
    // Quota exceeded or value not serialisable: keep the in-memory copy only.
  }
}

/** Drop a cached value (both layers). Used when a mutation invalidates a read. */
export function invalidateCache(key: string): void {
  MEMORY.delete(key);
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(LS_PREFIX + key);
  } catch {
    // ignore
  }
}
