'use client';

/* The row/card anatomy shared by the bays and the queue (OP2): state dot, goal,
   source-doc chip, lane chip, prerequisite indicators (blocked rows visibly
   gated), age, claim head. Clicking opens the run drawer. Queued unblocked tasks
   carry Send affordances targeting empty bays; blocked tasks are gated and
   cannot be sent (the unmet prerequisite is named). */

import type { OperatorTask, RegisteredHead } from '@/lib/theorem-operator';
import { isBlocked, unmetPrerequisites } from '@/lib/theorem-operator';
import { Dot, Pill, SourceBadge, formatAge } from './parts';
import styles from './operator.module.css';

export function TaskCard({
  task,
  emptyBays,
  onOpen,
  onSend,
  dragHandle,
}: {
  task: OperatorTask;
  /** Empty bays a queued task may be sent to. Empty array -> no bay free. */
  emptyBays?: RegisteredHead[];
  onOpen?: (taskId: string) => void;
  onSend?: (taskId: string, head: string) => void;
  /** True to render a drag grip (Next lane only). */
  dragHandle?: boolean;
}) {
  const blocked = isBlocked(task);
  const unmet = unmetPrerequisites(task);
  const sendable = task.status === 'queued' && !blocked && !!onSend && (emptyBays?.length ?? 0) > 0;
  // A drawer exists only for claimed/done tasks (those carry a runId).
  const canOpen = !!onOpen && !!task.runId;

  return (
    <article className={`${styles.task} ${blocked ? styles.taskBlocked : ''}`} data-lane={task.lane}>
      <div className={styles.taskTop}>
        {dragHandle && (
          <span className={styles.grip} aria-hidden="true" title="Drag to reorder priority">
            ⋮⋮
          </span>
        )}
        <Dot status={blocked ? 'blocked' : task.status} />
        <button
          className={styles.taskGoal}
          onClick={canOpen ? () => onOpen!(task.id) : undefined}
          disabled={!canOpen}
          title={canOpen ? 'Open run drawer' : 'No receipts yet'}
        >
          {task.goal}
        </button>
        <span className={`${styles.mono} ${styles.dim} ${styles.taskAge}`}>{formatAge(task.ageMs)}</span>
      </div>

      <div className={styles.taskMeta}>
        {task.sourceDoc &&
          (task.sourceDoc.href ? (
            <a className={styles.docChip} href={task.sourceDoc.href} title={task.sourceDoc.id}>
              {task.sourceDoc.id}
            </a>
          ) : (
            <span className={styles.docChip}>{task.sourceDoc.id}</span>
          ))}
        {task.laneChip && <Pill>{task.laneChip}</Pill>}
        {task.claim && (
          <span className={`${styles.mono} ${styles.muted}`}>{task.claim.head}</span>
        )}
        {blocked && <Pill tone="attention">gated</Pill>}
        <SourceBadge source={task.source} />
      </div>

      {blocked && (
        <div className={styles.prereqs}>
          {unmet.map((p) => (
            <span key={p.taskId} className={styles.prereq} title={`Unmet prerequisite: ${p.goal}`}>
              needs {p.goal}
            </span>
          ))}
        </div>
      )}

      {(sendable || (task.status === 'queued' && blocked)) && (
        <div className={styles.taskActions}>
          {blocked ? (
            <span className={styles.gatedNote}>
              Assignment refused — unmet prerequisite {unmet.map((p) => `"${p.goal}"`).join(', ')}.
            </span>
          ) : (
            <>
              <span className={styles.sendLabel}>Send to</span>
              {emptyBays!.map((h) => (
                <button
                  key={h.id}
                  className={styles.btn}
                  onClick={() => onSend!(task.id, h.id)}
                  title={`Assign to ${h.label} and render the session bootstrap`}
                >
                  {h.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </article>
  );
}
