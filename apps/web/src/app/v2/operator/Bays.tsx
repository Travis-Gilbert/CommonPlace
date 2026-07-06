'use client';

/* OP2 — the bays. One bay per registered head (Claude Code, Codex), each empty
   or holding its claimed task card. The WIP rule is the bays' physical capacity
   (Invariant 2): you cannot assign to an occupied bay, so there is no Send target
   here for a full bay. This row is the "Now" lane — claimed work in flight. */

import type { Bay } from '@/lib/theorem-operator';
import { TaskCard } from './TaskCard';
import { SourceBadge } from './parts';
import styles from './operator.module.css';

export function Bays({ bays, onOpen }: { bays: Bay[]; onOpen: (taskId: string) => void }) {
  return (
    <section className={styles.bays} aria-label="Bays">
      <div className={styles.laneHead}>
        <h2 className={styles.laneTitle}>Now · bays</h2>
        <span className={styles.laneHint}>WIP equals head count — one claimed task per bay.</span>
      </div>
      <div className={styles.bayRow}>
        {bays.map((bay) => (
          <div key={bay.head} className={styles.bay} data-empty={bay.task ? undefined : 'true'}>
            <div className={styles.bayHead}>
              <span className={styles.bayName}>{bay.label}</span>
              <SourceBadge source={bay.source} />
            </div>
            {bay.task ? (
              <TaskCard task={bay.task} onOpen={onOpen} />
            ) : (
              <div className={styles.bayEmpty}>
                Empty — send a queued task here.
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
