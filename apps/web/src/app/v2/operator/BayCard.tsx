'use client';

/* The bay card — the hero of the Operator screen. One card per head, landscape
   3:2 at 340x227. Exactly four zones: head row (name + live dot), one-line task
   title, 4px checklist progress bar, tri-segment footer (PR light | last step |
   elapsed). Urgency is a 4px left rail with three discrete stops: ink (calm),
   amber (waiting on a human), oxblood (blocked) — no spectrum. Zero badges on
   the face. Hover (or focus) reveals the action row inside the tilt; click
   opens the Room Panel. Empty bay: dashed outline at 60%, mono invitation. */

import { useEffect, useState } from 'react';
import type { Bay, BayUrgency } from '@/lib/theorem-operator';
import { TiltCard } from './TiltCard';
import { formatAge } from './parts';
import styles from './operator.module.css';

function useElapsed(sinceIso: string | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!sinceIso) {
      setLabel(null);
      return;
    }
    const tick = () => setLabel(formatAge(Date.now() - new Date(sinceIso).getTime()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [sinceIso]);
  return label;
}

export function BayCard({
  bay,
  urgency,
  onOpenRoom,
}: {
  bay: Bay;
  urgency: BayUrgency;
  onOpenRoom: (taskId: string) => void;
}) {
  const task = bay.task;
  const elapsed = useElapsed(task?.claim?.claimedAt);

  if (!task) {
    return (
      <div className={styles.bayEmptyCard}>
        <span className={styles.bayEmptyName}>{bay.label}</span>
        <span className={styles.bayEmptyHint}>send a queued task</span>
      </div>
    );
  }

  const progress = task.checklist && task.checklist.total > 0 ? task.checklist.done / task.checklist.total : 0;

  return (
    <TiltCard className={styles.bayTilt} tiltLimit={6} scale={1.02} perspective={1200} spotlight>
      <article className={styles.bayCard} data-urgency={urgency}>
        <span className={styles.bayRail} data-urgency={urgency} aria-hidden="true" />

        {/* Whole-face open affordance; the action row layers above it. */}
        <button
          className={styles.bayFaceBtn}
          onClick={() => onOpenRoom(task.id)}
          aria-label={`Open room — ${task.goal}`}
        />

        {/* 1 — head row */}
        <div className={styles.bayZoneHead}>
          <span className={styles.bayHeadName}>{bay.label}</span>
          <span
            className={styles.bayLiveDot}
            data-streaming={bay.streaming || undefined}
            title={bay.streaming ? 'Streaming' : 'Idle'}
            aria-hidden="true"
          />
        </div>

        {/* 2 — task title, one line, zero badges */}
        <div className={styles.bayTaskTitle}>{task.goal}</div>

        {/* 3 — checklist progress */}
        <div
          className={styles.bayProgress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={task.checklist?.total ?? 0}
          aria-valuenow={task.checklist?.done ?? 0}
          aria-label="Build Table completion"
        >
          <span className={styles.bayProgressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        {/* 4 — tri-segment footer */}
        <div className={styles.bayFooter}>
          <span className={styles.bayFootCell}>
            <span
              className={styles.bayPrDot}
              data-pr={bay.prLight}
              title={bay.prLight === 'none' ? 'No PR' : bay.prLight === 'open' ? 'PR open' : 'PR merged'}
            />
          </span>
          <span className={`${styles.bayFootCell} ${styles.bayFootStep}`} title={bay.lastStep}>
            {bay.lastStep ?? '—'}
          </span>
          <span className={`${styles.bayFootCell} ${styles.bayFootElapsed}`}>{elapsed ?? ''}</span>
        </div>

        {/* Hover / focus-within action row, InfoCard reveal pattern */}
        <div className={styles.bayActions}>
          <button className={styles.bayActionBtn} onClick={() => onOpenRoom(task.id)}>
            Open room
          </button>
          <button className={styles.bayActionBtn} disabled title="Diff link lands with the live wiring (Codex lane)">
            View diff
          </button>
          <button className={styles.bayActionBtn} disabled title="Release lands with the live claim wiring (Codex lane)">
            Release claim
          </button>
        </div>
      </article>
    </TiltCard>
  );
}
