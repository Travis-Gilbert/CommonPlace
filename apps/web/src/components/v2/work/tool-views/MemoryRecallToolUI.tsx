'use client';

import type { WorkToolPart } from '@/lib/work-surface/types';
import { readAskResult, readErrorResult } from '@/lib/work-surface/tool-result-readers';
import styles from '../work.module.css';

/**
 * WS3 bespoke tool view for the omnibar's /recall command. Renders the
 * already-fetched gqlAsk result (answer + provenance with real item ids and
 * scores) -- gqlAsk runs once in use-work-thread.ts's runTool, this
 * component only ever reads the settled result off the tool part.
 */
export function MemoryRecallToolUI({ part }: { part: WorkToolPart }) {
  const question = typeof part.args.arg === 'string' ? part.args.arg : '';

  if (part.status === 'running') {
    return (
      <div className={styles.toolCard}>
        <div className={styles.toolCardHead}>Recall &middot; {question}</div>
        <div className={styles.toolLoading}>Asking memory recall&hellip;</div>
      </div>
    );
  }

  const errorMessage = readErrorResult(part.result);
  if (errorMessage) {
    return (
      <div className={styles.toolCard}>
        <div className={styles.toolCardHead}>Recall &middot; {question}</div>
        <div className={styles.toolError}>{errorMessage}</div>
      </div>
    );
  }

  const parsed = readAskResult(part.result);
  if (!parsed) {
    return (
      <div className={styles.toolCard}>
        <div className={styles.toolCardHead}>Recall &middot; {question}</div>
        <div className={styles.toolEmpty}>No answer.</div>
      </div>
    );
  }

  return (
    <div className={styles.toolCard}>
      <div className={styles.toolCardHead}>Recall &middot; {question}</div>
      {parsed.answerKind === 'EMPTY' ? (
        <div className={styles.toolEmpty}>No memory found for this question.</div>
      ) : (
        <p className={styles.toolAnswer}>{parsed.answer}</p>
      )}
      {parsed.provenance.length > 0 && (
        <ul className={styles.toolProvenance}>
          {parsed.provenance.map((entry) => (
            <li key={entry.itemId} className={styles.toolProvenanceItem}>
              <span>{entry.title}</span>
              <span className={styles.toolProvenanceScore}>{entry.score.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
