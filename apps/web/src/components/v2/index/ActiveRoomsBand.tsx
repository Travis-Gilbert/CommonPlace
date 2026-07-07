'use client';

/* The Index gains a row per active room (SPEC-OPERATOR-SURFACE-V2): each
   claimed task in a bay is one quiet row here; clicking opens the same Room
   Panel via the Operator's ?room= deep link. The Operator page is the
   aggregate view, the panel is the unit view — one component serves both.
   Renders nothing while loading or when no room is active. */

import Link from 'next/link';
import { useApiData } from '@/lib/commonplace-api';
import { fetchOperatorState } from '@/lib/theorem-operator-client';
import { formatAge } from '@/app/v2/operator/parts';
import styles from '@/app/v2/operator/operator.module.css';

export function ActiveRoomsBand() {
  const { data } = useApiData(() => fetchOperatorState(), []);
  const active = (data?.bays ?? []).filter((b) => b.task);
  if (active.length === 0) return null;

  return (
    <section aria-label="Active rooms" style={{ padding: '0 40px 16px' }}>
      <div className={styles.laneHead}>
        <h2 className={styles.laneTitle}>Active rooms</h2>
      </div>
      <div className={styles.queueList}>
        {active.map((bay) => {
          const task = bay.task!;
          const elapsed = task.claim
            ? formatAge(Date.now() - new Date(task.claim.claimedAt).getTime())
            : null;
          return (
            <Link
              key={bay.head}
              className={styles.qRow}
              href={`/v2/operator?room=${encodeURIComponent(task.id)}`}
              style={{ textDecoration: 'none' }}
            >
              <span
                className={styles.bayLiveDot}
                data-streaming={bay.streaming || undefined}
                aria-hidden="true"
              />
              <span className={styles.qTitle}>{task.goal}</span>
              <span className={styles.qChip}>{bay.label}</span>
              {elapsed && <span className={styles.qAge}>{elapsed}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
