/**
 * Session receipt rail store (HANDOFF-CARRY C5.1, shared with HANDOFF-PUBLISH
 * P4.4). One timeline per session that renders browse actions, the carry event,
 * destination actions, and publish events in order. The rail is keyed by session
 * id and persists, so it "travels" with the session across destinations: opening
 * Write/Build/Research with the same session id shows the same rail, and a
 * second carry from that session appends rather than forking (C5.3).
 *
 * The entry shape is a superset of the co-browse rail's `RailEntry`
 * (useCoBrowseSession) so the two rails speak one vocabulary and can share the
 * ReceiptRail rendering; carry/publish/destination are the entries this shared
 * rail adds on top of the browse-stage kinds.
 */

import type { RailEntryKind } from '@/components/commonplace/cobrowse/useCoBrowseSession';

/** Browse-stage kinds plus the cross-surface kinds this shared rail adds. */
export type SessionRailKind = RailEntryKind | 'carry' | 'publish' | 'destination';

export interface SessionRailEntry {
  id: string;
  at: number;
  kind: SessionRailKind;
  summary: string;
  /** Full receipt payload, rendered when the entry expands (carry manifest,
   *  publish receipt). */
  receipt?: unknown;
}

interface SessionRailRecord {
  sessionId: string;
  entries: SessionRailEntry[];
  updatedAt: number;
}

const DB_NAME = 'commonplace-session-rail';
const STORE_NAME = 'rails';
const DB_VERSION = 1;

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `rail-${crypto.randomUUID()}`;
  return `rail-${Date.now().toString(36)}-${Math.round(Math.random() * 1e9).toString(36)}`;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

const memory = new Map<string, SessionRailRecord>();

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

async function read(sessionId: string): Promise<SessionRailRecord | undefined> {
  if (!hasIndexedDb()) return memory.get(sessionId);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(sessionId);
    req.onsuccess = () => resolve((req.result as SessionRailRecord | undefined) ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

async function write(record: SessionRailRecord): Promise<void> {
  if (!hasIndexedDb()) {
    memory.set(record.sessionId, record);
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribeRail(sessionId: string, listener: Listener): () => void {
  const set = listeners.get(sessionId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(sessionId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(sessionId);
  };
}

function notify(sessionId: string): void {
  listeners.get(sessionId)?.forEach((cb) => cb());
}

const chains = new Map<string, Promise<unknown>>();
function serialize<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  const prior = chains.get(sessionId) ?? Promise.resolve();
  const next = prior.then(task, task);
  chains.set(
    sessionId,
    next.catch(() => undefined),
  );
  return next;
}

/**
 * Append one entry to a session's rail (creating the rail on first write).
 * Because the rail is keyed by session id, a second carry from the same session
 * appends here rather than forking a new rail (C5.3).
 */
export async function appendRailEntry(
  sessionId: string,
  entry: Omit<SessionRailEntry, 'id' | 'at'> & { at?: number },
): Promise<SessionRailEntry> {
  return serialize(sessionId, async () => {
    const existing = await read(sessionId);
    const at = entry.at ?? Date.now();
    const full: SessionRailEntry = { ...entry, id: newId(), at };
    const record: SessionRailRecord = existing
      ? { ...existing, entries: [...existing.entries, full], updatedAt: at }
      : { sessionId, entries: [full], updatedAt: at };
    await write(record);
    notify(sessionId);
    return full;
  });
}

/** The rail entries for a session, in order (empty when none yet). */
export async function getRailEntries(sessionId: string): Promise<SessionRailEntry[]> {
  const record = await read(sessionId);
  return record?.entries ?? [];
}

/** Remove a session's rail (tests, explicit resets). */
export async function clearRail(sessionId: string): Promise<void> {
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
    notify(sessionId);
  });
}
