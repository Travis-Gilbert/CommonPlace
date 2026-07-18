/**
 * The capture trust loop. Every capture persists to on-device SQLite BEFORE any
 * network, then walks a visible state machine:
 *
 *   kept (on this phone) -> syncing -> filed (receipt)   [verb: keep]
 *   kept                 -> syncing -> answered (receipt) [verb: ask]
 *   any                  -> error (retryable)
 *
 * The row is the state machine; the Index renders it directly.
 */
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { readInstanceSettings } from '@/api/instance';
import { ingestItem, putNote, runTheoremAgent } from '@/api/queries';
import type { ItemGql } from '@/api/types';
import { createRevisionStore } from '@/lib/revisionStore';

export type CaptureVerb = 'keep' | 'ask';
export type CaptureState = 'kept' | 'syncing' | 'filed' | 'answered' | 'error';
export type CaptureSource = 'omnibar' | 'share' | 'voice' | 'camera' | 'file' | 'web' | 'paste';

export type CaptureRow = {
  id: string;
  createdAt: number;
  verb: CaptureVerb;
  title: string | null;
  text: string;
  kindHint: string | null;
  source: CaptureSource;
  attachmentUri: string | null;
  attachmentMime: string | null;
  state: CaptureState;
  error: string | null;
  receiptJson: string | null;
  remoteId: string | null;
  notifyOnAnswer: number;
};

export type CaptureReceipt = {
  item?: ItemGql;
  answer?: string;
  answerNoteId?: string;
};

const db = SQLite.openDatabaseSync('capture.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    verb TEXT NOT NULL,
    title TEXT,
    text TEXT NOT NULL,
    kind_hint TEXT,
    source TEXT NOT NULL,
    attachment_uri TEXT,
    attachment_mime TEXT,
    state TEXT NOT NULL,
    error TEXT,
    receipt_json TEXT,
    remote_id TEXT,
    notify_on_answer INTEGER NOT NULL DEFAULT 0
  );
`);

const queueChanges = createRevisionStore();
export const subscribeQueue = queueChanges.subscribe;
export const getQueueRevision = queueChanges.getSnapshot;
const emit = queueChanges.emit;

function rowFrom(r: Record<string, unknown>): CaptureRow {
  return {
    id: r.id as string,
    createdAt: r.created_at as number,
    verb: r.verb as CaptureVerb,
    title: (r.title as string) ?? null,
    text: r.text as string,
    kindHint: (r.kind_hint as string) ?? null,
    source: r.source as CaptureSource,
    attachmentUri: (r.attachment_uri as string) ?? null,
    attachmentMime: (r.attachment_mime as string) ?? null,
    state: r.state as CaptureState,
    error: (r.error as string) ?? null,
    receiptJson: (r.receipt_json as string) ?? null,
    remoteId: (r.remote_id as string) ?? null,
    notifyOnAnswer: (r.notify_on_answer as number) ?? 0,
  };
}

export type EnqueueArgs = {
  verb: CaptureVerb;
  text: string;
  title?: string;
  kindHint?: string;
  source: CaptureSource;
  attachmentUri?: string;
  attachmentMime?: string;
  notifyOnAnswer?: boolean;
};

/** Durable write FIRST; network never gates the return. */
export function enqueueCapture(args: EnqueueArgs): CaptureRow {
  const id = `local-${Crypto.randomUUID()}`;
  const createdAt = Date.now();
  db.runSync(
    `INSERT INTO captures (id, created_at, verb, title, text, kind_hint, source, attachment_uri, attachment_mime, state, notify_on_answer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'kept', ?)`,
    [
      id,
      createdAt,
      args.verb,
      args.title ?? null,
      args.text,
      args.kindHint ?? null,
      args.source,
      args.attachmentUri ?? null,
      args.attachmentMime ?? null,
      args.notifyOnAnswer ? 1 : 0,
    ],
  );
  emit();
  // Fire-and-forget drain attempt; offline just leaves the row kept.
  void drainQueue();
  return listAll(1)[0];
}

export function listPending(): CaptureRow[] {
  return db
    .getAllSync(`SELECT * FROM captures WHERE state IN ('kept','syncing','error') ORDER BY created_at DESC`)
    .map((r) => rowFrom(r as Record<string, unknown>));
}

export function listAll(limit = 50): CaptureRow[] {
  return db
    .getAllSync(`SELECT * FROM captures ORDER BY created_at DESC LIMIT ?`, [limit])
    .map((r) => rowFrom(r as Record<string, unknown>));
}

export function pendingCount(): number {
  const r = db.getFirstSync(`SELECT COUNT(*) AS n FROM captures WHERE state IN ('kept','syncing','error')`) as {
    n: number;
  };
  return r?.n ?? 0;
}

export function getCapture(id: string): CaptureRow | null {
  const r = db.getFirstSync(`SELECT * FROM captures WHERE id = ?`, [id]);
  return r ? rowFrom(r as Record<string, unknown>) : null;
}

export function clearQueue() {
  db.runSync(`DELETE FROM captures`);
  emit();
}

function setState(id: string, state: CaptureState, patch: { error?: string | null; receipt?: CaptureReceipt; remoteId?: string } = {}) {
  db.runSync(`UPDATE captures SET state = ?, error = ?, receipt_json = COALESCE(?, receipt_json), remote_id = COALESCE(?, remote_id) WHERE id = ?`, [
    state,
    patch.error ?? null,
    patch.receipt ? JSON.stringify(patch.receipt) : null,
    patch.remoteId ?? null,
    id,
  ]);
  emit();
}

async function uploadBlobCapture(row: CaptureRow): Promise<ItemGql> {
  const settings = await readInstanceSettings();
  const form = new FormData();
  form.append('title', row.title ?? row.text.slice(0, 80) ?? 'Capture');
  if (row.kindHint) form.append('kind', row.kindHint);
  if (row.text) form.append('text', row.text);
  form.append('file', {
    uri: row.attachmentUri!,
    name: row.attachmentUri!.split('/').pop() ?? 'capture.bin',
    type: row.attachmentMime ?? 'application/octet-stream',
  } as unknown as Blob);
  const res = await fetch(`${settings.url.replace(/\/$/, '')}/ingest/blob`, {
    method: 'POST',
    headers: { 'x-api-key': settings.apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`blob upload HTTP ${res.status}`);
  return (await res.json()) as ItemGql;
}

let draining = false;

/** Walk every retryable row through its verb. Safe to call anytime. */
export async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const rows = db
      .getAllSync(`SELECT * FROM captures WHERE state IN ('kept','error') ORDER BY created_at ASC`)
      .map((r) => rowFrom(r as Record<string, unknown>));
    for (const row of rows) {
      setState(row.id, 'syncing');
      try {
        if (row.verb === 'keep') {
          const item = row.attachmentUri
            ? await uploadBlobCapture(row)
            : await ingestItem({
                title: row.title ?? row.text.split('\n')[0].slice(0, 120),
                text: row.text,
                kind: row.kindHint ?? undefined,
                source: `mobile:${row.source}`,
              });
          setState(row.id, 'filed', { receipt: { item }, remoteId: item.id });
          onFiled?.(row, item);
        } else {
          const run = await runTheoremAgent(row.text, 'ask');
          const note = await putNote(row.text.slice(0, 120), run.answer, ['ask']);
          setState(row.id, 'answered', {
            receipt: { answer: run.answer, answerNoteId: note.id, item: note },
            remoteId: note.id,
          });
          onAnswered?.(row, run.answer, note);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Network-ish failures go back to kept (retry silently); anything else is error.
        const retryable = /Network|network|Failed to fetch|abort|timeout|TypeError/.test(message);
        setState(row.id, retryable ? 'kept' : 'error', { error: message });
        if (retryable) break; // offline: stop hammering, next trigger retries
      }
    }
  } finally {
    draining = false;
  }
}

/** Hooks the notifications layer registers (kept out of this module: no cycles). */
export let onFiled: ((row: CaptureRow, item: ItemGql) => void) | null = null;
export let onAnswered: ((row: CaptureRow, answer: string, note: ItemGql) => void) | null = null;
export function setQueueCallbacks(cb: {
  onFiled?: (row: CaptureRow, item: ItemGql) => void;
  onAnswered?: (row: CaptureRow, answer: string, note: ItemGql) => void;
}) {
  onFiled = cb.onFiled ?? null;
  onAnswered = cb.onAnswered ?? null;
}

// ponytail: 15s interval + AppState drain instead of a netinfo listener; swap in
// expo-network's network-state event if battery or immediacy ever matters.
let interval: ReturnType<typeof setInterval> | null = null;
export function startQueuePump() {
  if (interval) return;
  interval = setInterval(() => {
    if (pendingCount() > 0) void drainQueue();
  }, 15000);
}
export function stopQueuePump() {
  if (interval) clearInterval(interval);
  interval = null;
}
