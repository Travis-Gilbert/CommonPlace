'use client';

/* OP2 task row — deliberately minimal: a status dot, the title, one teal category
   tag, and age. Everything else (source doc, prerequisites, file scope, source
   mode, the Send action, receipts) lives in the openable task drawer. The whole
   face opens the drawer; the grip (Next lane only) is the drag handle. */

import type { OperatorTask } from '@/lib/theorem-operator';
import { isBlocked } from '@/lib/theorem-operator';
import { formatAge } from './parts';
import styles from './operator.module.css';

export function TaskCard({
  task,
  onOpen,
  handleProps,
}: {
  task: OperatorTask;
  onOpen: (taskId: string) => void;
  /** Drag-handle props from @hello-pangea/dnd, applied to the grip (Next lane). */
  handleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const blocked = isBlocked(task);
  const status = blocked ? 'blocked' : task.status;

  return (
    <article className={`${styles.task} ${blocked ? styles.taskBlocked : ''}`} data-lane={task.lane}>
      {handleProps && (
        <span className={styles.grip} {...handleProps} aria-hidden="true" title="Drag to reorder priority">
          ⋮⋮
        </span>
      )}
      <button className={styles.taskFace} onClick={() => onOpen(task.id)} title="Open task">
        <span className={styles.dot} data-status={status} />
        <span className={styles.taskGoal}>{task.goal}</span>
        {task.laneChip && <span className={styles.tag}>{task.laneChip}</span>}
        <span className={`${styles.mono} ${styles.dim} ${styles.taskAge}`}>{formatAge(task.ageMs)}</span>
      </button>
    </article>
  );
}
