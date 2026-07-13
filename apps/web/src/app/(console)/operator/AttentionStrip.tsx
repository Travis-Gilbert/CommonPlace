'use client';

/* Row 2 — the attention strip. At most three chips, rendered only when nonzero:
   Awaiting you, Blocked, New at gate. Ink on parchment; the amber left-dot marks
   a chip that demands action. When all are zero the strip does not render and
   the bays rise. Clicking scrolls or filters — never navigates away. */

import styles from './operator.module.css';

export interface AttentionCounts {
  awaitingYou: number;
  blocked: number;
  newAtGate: number;
}

export function AttentionStrip({
  counts,
  onAwaiting,
  onBlocked,
  onGate,
}: {
  counts: AttentionCounts;
  onAwaiting: () => void;
  onBlocked: () => void;
  onGate: () => void;
}) {
  const { awaitingYou, blocked, newAtGate } = counts;
  if (awaitingYou === 0 && blocked === 0 && newAtGate === 0) return null;

  return (
    <div className={styles.strip} role="group" aria-label="Attention">
      {awaitingYou > 0 && (
        <button className={styles.chipBtn} onClick={onAwaiting}>
          <span className={styles.chipDot} data-urgent="true" />
          Awaiting you
          <span className={styles.chipCount}>{awaitingYou}</span>
        </button>
      )}
      {blocked > 0 && (
        <button className={styles.chipBtn} onClick={onBlocked}>
          <span className={styles.chipDot} />
          Blocked
          <span className={styles.chipCount}>{blocked}</span>
        </button>
      )}
      {newAtGate > 0 && (
        <button className={styles.chipBtn} onClick={onGate}>
          <span className={styles.chipDot} data-urgent="true" />
          New at gate
          <span className={styles.chipCount}>{newAtGate}</span>
        </button>
      )}
    </div>
  );
}
