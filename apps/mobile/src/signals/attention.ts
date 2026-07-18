import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

export type AttentionSignalKind =
  | 'opened'
  | 'ignored'
  | 'dismissed'
  | 'tell_me_sooner'
  | 'do_not_show_again';

export type AttentionRewardVector = {
  relevance: number;
  timing: number;
  interruptionCost: number;
  trust: number;
};

const vectors: Record<AttentionSignalKind, AttentionRewardVector> = {
  opened: { relevance: 1, timing: 0.5, interruptionCost: 0, trust: 0.25 },
  ignored: { relevance: -0.25, timing: -0.5, interruptionCost: -0.25, trust: 0 },
  dismissed: { relevance: -0.75, timing: -0.25, interruptionCost: -0.25, trust: -0.25 },
  tell_me_sooner: { relevance: 0.5, timing: 1, interruptionCost: 0.25, trust: 0.25 },
  do_not_show_again: { relevance: -1, timing: -0.5, interruptionCost: -1, trust: -0.5 },
};

const db = SQLite.openDatabaseSync('signals.db');
db.execSync(`
  CREATE TABLE IF NOT EXISTS attention_signals (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    subject_id TEXT NOT NULL,
    basis_hash TEXT,
    kind TEXT NOT NULL,
    reward_vector_json TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  )
`);

export function recordAttentionSignal(input: {
  subjectId: string;
  basisHash?: string;
  kind: AttentionSignalKind;
}): string {
  const id = `attention-${Crypto.randomUUID()}`;
  db.runSync(
    `INSERT INTO attention_signals (id, created_at, subject_id, basis_hash, kind, reward_vector_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, Date.now(), input.subjectId, input.basisHash ?? null, input.kind, JSON.stringify(vectors[input.kind])],
  );
  return id;
}
