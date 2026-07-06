'use client';

/* OP6 — The shift summary. The fifteen-minute screen: a since-you-last-looked
   rollup at the top of the board, ordered by what needs a human. Urgent blocks
   and newly-blocked work come first; informational counts follow. Sized to a
   laptop viewport without scrolling. */

import type { ShiftSummary as ShiftSummaryData } from '@/lib/theorem-operator';
import { Pill, SourceBadge, formatTime } from './parts';
import styles from './operator.module.css';

export function ShiftSummary({
  summary,
  onOpenTask,
  onGoGate,
}: {
  summary: ShiftSummaryData;
  onOpenTask: (taskId: string) => void;
  onGoGate: () => void;
}) {
  const {
    since,
    completed,
    newlyBlocked,
    reviewReadyCount,
    queueDepth,
    iceboxMovements,
    urgentMessages,
  } = summary;

  return (
    <section className={styles.shift} aria-label="Shift summary">
      <div className={styles.shiftHead}>
        <span className={styles.shiftKicker}>Since you last looked</span>
        <span className={`${styles.mono} ${styles.dim}`}>{formatTime(since)}</span>
        <SourceBadge source={summary.source} />
      </div>

      <div className={styles.shiftGrid}>
        {/* Needs-a-human first: urgent block messages. */}
        {urgentMessages.length > 0 && (
          <div className={`${styles.shiftCell} ${styles.shiftUrgent}`}>
            <div className={styles.shiftCellTitle}>Awaiting you</div>
            <ul className={styles.shiftList}>
              {urgentMessages.map((m) => (
                <li key={m.id}>
                  <span className={styles.mono}>{m.from}</span> {m.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Newly blocked, with blocker names. */}
        <div className={styles.shiftCell}>
          <div className={styles.shiftCellTitle}>
            Newly blocked <span className={styles.shiftCount}>{newlyBlocked.length}</span>
          </div>
          {newlyBlocked.length === 0 ? (
            <div className={styles.shiftMuted}>None.</div>
          ) : (
            <ul className={styles.shiftList}>
              {newlyBlocked.map((b) => (
                <li key={b.taskId}>
                  <button className={styles.linkBtn} onClick={() => onOpenTask(b.taskId)}>
                    {b.goal}
                  </button>
                  <div className={styles.shiftBlockers}>
                    {b.blockers.map((x) => (
                      <Pill key={x} tone="attention">
                        {x}
                      </Pill>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Review-ready count -> jump to the gate. */}
        <button className={`${styles.shiftCell} ${styles.shiftStat}`} onClick={onGoGate} type="button">
          <div className={styles.shiftStatVal} data-tone={reviewReadyCount > 0 ? 'attention' : undefined}>
            {reviewReadyCount}
          </div>
          <div className={styles.shiftStatKey}>review-ready</div>
        </button>

        {/* Queue depth. */}
        <div className={`${styles.shiftCell} ${styles.shiftStat}`}>
          <div className={styles.shiftStatVal}>{queueDepth}</div>
          <div className={styles.shiftStatKey}>in queue</div>
        </div>

        {/* Completed, with gate status. */}
        <div className={styles.shiftCell}>
          <div className={styles.shiftCellTitle}>
            Completed <span className={styles.shiftCount}>{completed.length}</span>
          </div>
          {completed.length === 0 ? (
            <div className={styles.shiftMuted}>None.</div>
          ) : (
            <ul className={styles.shiftList}>
              {completed.map((c) => (
                <li key={c.taskId}>
                  <button className={styles.linkBtn} onClick={() => onOpenTask(c.taskId)}>
                    {c.goal}
                  </button>{' '}
                  <Pill tone={c.gateStatus === 'bounced' ? 'attention' : 'ok'}>{c.gateStatus}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Icebox movements. */}
        {iceboxMovements.length > 0 && (
          <div className={styles.shiftCell}>
            <div className={styles.shiftCellTitle}>
              Iceboxed <span className={styles.shiftCount}>{iceboxMovements.length}</span>
            </div>
            <ul className={styles.shiftList}>
              {iceboxMovements.map((m) => (
                <li key={m.taskId} className={styles.shiftMuted}>
                  {m.goal}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
