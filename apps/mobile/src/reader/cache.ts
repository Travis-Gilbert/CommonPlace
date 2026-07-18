import * as SQLite from 'expo-sqlite';

import type { ItemGql } from '@/api/types';

const db = SQLite.openDatabaseSync('reader.db');
const CACHE_LIMIT = 20;

db.execSync(`
  CREATE TABLE IF NOT EXISTS reader_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    body_text TEXT,
    payload_json TEXT NOT NULL,
    opened_at INTEGER NOT NULL
  )
`);

export function cacheReaderDocument(item: ItemGql): void {
  db.runSync(
    `INSERT INTO reader_documents (id, title, kind, body_text, payload_json, opened_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, kind=excluded.kind,
       body_text=excluded.body_text, payload_json=excluded.payload_json, opened_at=excluded.opened_at`,
    [item.id, item.title, item.kind, item.bodyText ?? null, JSON.stringify(item), Date.now()],
  );
  db.runSync(
    `DELETE FROM reader_documents WHERE id NOT IN (
       SELECT id FROM reader_documents ORDER BY opened_at DESC LIMIT ?
     )`,
    [CACHE_LIMIT],
  );
}

export function readCachedDocument(id: string): ItemGql | null {
  const row = db.getFirstSync<{ payload_json: string }>(`SELECT payload_json FROM reader_documents WHERE id = ?`, [id]);
  if (!row) return null;
  try {
    return JSON.parse(row.payload_json) as ItemGql;
  } catch {
    return null;
  }
}
