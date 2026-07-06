/** Chat threads live on-device (SQLite); answers come from theoremAgent. */
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

export type ChatThread = { id: string; title: string; createdAt: number; updatedAt: number };
export type ChatMessage = {
  id: string;
  threadId: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  createdAt: number;
  /** Set when a scene was compiled for this answer. */
  sceneUrl?: string | null;
  pending?: number;
};

const db = SQLite.openDatabaseSync('chat.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL,
    created_at INTEGER NOT NULL, scene_url TEXT, pending INTEGER NOT NULL DEFAULT 0
  );
`);

const listeners = new Set<() => void>();
export const subscribeChat = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn());

export function listThreads(): ChatThread[] {
  return db
    .getAllSync(`SELECT * FROM threads ORDER BY updated_at DESC`)
    .map((r: any) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function createThread(title: string): ChatThread {
  const t = { id: `thread-${Crypto.randomUUID()}`, title, createdAt: Date.now(), updatedAt: Date.now() };
  db.runSync(`INSERT INTO threads (id, title, created_at, updated_at) VALUES (?,?,?,?)`, [
    t.id,
    t.title,
    t.createdAt,
    t.updatedAt,
  ]);
  emit();
  return t;
}

export function listMessages(threadId: string): ChatMessage[] {
  return db
    .getAllSync(`SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC`, [threadId])
    .map((r: any) => ({
      id: r.id,
      threadId: r.thread_id,
      role: r.role,
      text: r.text,
      createdAt: r.created_at,
      sceneUrl: r.scene_url,
      pending: r.pending,
    }));
}

export function appendMessage(
  threadId: string,
  role: ChatMessage['role'],
  text: string,
  opts: { sceneUrl?: string; pending?: boolean } = {},
): ChatMessage {
  const m: ChatMessage = {
    id: `msg-${Crypto.randomUUID()}`,
    threadId,
    role,
    text,
    createdAt: Date.now(),
    sceneUrl: opts.sceneUrl ?? null,
    pending: opts.pending ? 1 : 0,
  };
  db.runSync(
    `INSERT INTO messages (id, thread_id, role, text, created_at, scene_url, pending) VALUES (?,?,?,?,?,?,?)`,
    [m.id, m.threadId, m.role, m.text, m.createdAt, m.sceneUrl ?? null, m.pending ?? 0],
  );
  db.runSync(`UPDATE threads SET updated_at = ? WHERE id = ?`, [m.createdAt, threadId]);
  emit();
  return m;
}

export function resolveMessage(id: string, text: string, sceneUrl?: string) {
  db.runSync(`UPDATE messages SET text = ?, pending = 0, scene_url = COALESCE(?, scene_url) WHERE id = ?`, [
    text,
    sceneUrl ?? null,
    id,
  ]);
  emit();
}
