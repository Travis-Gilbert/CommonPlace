'use client';

/* OP4 (+ OP3) — the task drawer. Every task opens here; the board row stays
   minimal. Shows the task's detail (source doc, prerequisites, scope, source
   mode), the Send-to-bay action for a queued unblocked task (OP3: assign +
   bootstrap), and — when the task carries a run — the Verify First checklist and
   the deploy-log event stream (OP4), assembled from the task's coordination
   records, contributions, stream events, and checklist transitions.

   Built on Radix Dialog (focus trap, Escape, aria-modal, portal), dressed in
   porcelain. Event payloads expand with native <details>. */

import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw } from 'lucide-react';
import type { OperatorTask, RunDrawer as RunData, RegisteredHead } from '@/lib/theorem-operator';
import { isBlocked, unmetPrerequisites } from '@/lib/theorem-operator';
import { Pill, SourceBadge, Dot, formatTime } from './parts';
import styles from './operator.module.css';

export function TaskDrawer({
  task,
  run,
  emptyBays,
  open,
  onClose,
  onSend,
  onRefresh,
  busy,
}: {
  task: OperatorTask | null;
  run: RunData | null;
  emptyBays: RegisteredHead[];
  open: boolean;
  onClose: () => void;
  onSend: (taskId: string, head: string) => void;
  onRefresh: (taskId: string) => void;
  busy: boolean;
}) {
  const blocked = task ? isBlocked(task) : false;
  const unmet = task ? unmetPrerequisites(task) : [];
  const sendable = !!task && task.status === 'queued' && !blocked && emptyBays.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={styles.drawer} aria-describedby={undefined}>
          {task ? (
            <>
              <div className={styles.drawerHead}>
                <div>
                  <Dialog.Title className={styles.drawerTitle}>{task.goal}</Dialog.Title>
                  <div className={styles.drawerSub}>
                    {task.laneChip && <span className={styles.tag}>{task.laneChip}</span>}
                    {task.status === 'done' ? (
                      <Pill tone="ok">done</Pill>
                    ) : blocked ? (
                      <span className={styles.statusMuted}>blocked</span>
                    ) : (
                      <span className={styles.statusMuted}>{task.status}</span>
                    )}
                    {task.claim && <span className={`${styles.mono} ${styles.dim}`}>{task.claim.head}</span>}
                    <span className={`${styles.mono} ${styles.dim}`}>{task.id}</span>
                    <SourceBadge source={task.source} />
                  </div>
                </div>
                <div className={styles.drawerHeadActions}>
                  {run && (
                    <button
                      className={styles.iconBtn}
                      onClick={() => onRefresh(task.id)}
                      disabled={busy}
                      title={run.live ? 'Pull the latest cursor delta' : 'Reconstruct from the substrate'}
                      aria-label="Refresh drawer"
                    >
                      <RefreshCw className={styles.glyph} data-spin={busy || undefined} />
                    </button>
                  )}
                  <Dialog.Close className={styles.iconBtn} aria-label="Close drawer">
                    <X className={styles.glyph} />
                  </Dialog.Close>
                </div>
              </div>

              {/* Source doc */}
              {task.sourceDoc && (
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>source</span>
                  {task.sourceDoc.href ? (
                    <a className={styles.kvLink} href={task.sourceDoc.href}>
                      {task.sourceDoc.label}
                    </a>
                  ) : (
                    <span className={styles.kvVal}>{task.sourceDoc.label}</span>
                  )}
                </div>
              )}

              {/* Prerequisites */}
              {task.prerequisites.length > 0 && (
                <div className={styles.detailBlock}>
                  <div className={styles.detailTitle}>Prerequisites</div>
                  <ul className={styles.prereqList}>
                    {task.prerequisites.map((p) => (
                      <li key={p.taskId} className={styles.prereqItem} data-met={p.met || undefined}>
                        <span className={styles.prereqMark} data-met={p.met || undefined} aria-hidden="true">
                          {p.met ? '✓' : '○'}
                        </span>
                        {p.goal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scope */}
              {task.fileScope && task.fileScope.length > 0 && (
                <div className={styles.detailBlock}>
                  <div className={styles.detailTitle}>Scope</div>
                  <div className={styles.chips}>
                    {task.fileScope.map((f) => (
                      <span key={f} className={styles.chip}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* OP3 — Send to bay, or a calm blocked note */}
              {sendable ? (
                <div className={styles.drawerSend}>
                  <span className={styles.sendLabel}>Send to</span>
                  {emptyBays.map((h) => (
                    <button
                      key={h.id}
                      className={styles.btn}
                      onClick={() => onSend(task.id, h.id)}
                      title={`Assign to ${h.label} and render the session bootstrap`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              ) : blocked ? (
                <div className={styles.blockedNote}>
                  Blocked — needs {unmet.map((p) => `"${p.goal}"`).join(', ')} before it can be claimed.
                </div>
              ) : null}

              {/* OP4 — run receipts, when the task has a run */}
              {run && (
                <>
                  <div className={styles.detailBlock}>
                    <div className={styles.detailTitle}>Verify First</div>
                    <ul className={styles.verifyList}>
                      {run.verifyFirst.map((v) => (
                        <li key={v.id} className={styles.verifyItem} data-done={v.done || undefined}>
                          <span className={styles.verifyMark} data-done={v.done || undefined} aria-hidden="true">
                            {v.done ? '✓' : '○'}
                          </span>
                          <div>
                            <div className={styles.verifyLabel}>{v.label}</div>
                            {v.evidence && <div className={styles.verifyEvidence}>{v.evidence}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={styles.detailTitle}>
                    Event stream {run.live ? <Pill tone="ok">live</Pill> : <span className={styles.statusMuted}>cold replay</span>}
                  </div>
                  <ol className={styles.log}>
                    {run.events.map((e) => (
                      <li key={e.id} className={styles.logRow}>
                        <span className={`${styles.mono} ${styles.dim} ${styles.logTime}`}>{formatTime(e.at)}</span>
                        <Dot status={e.kind === 'release' || e.kind === 'outcome' ? 'done' : 'active'} />
                        <div className={styles.logBody}>
                          {e.payload ? (
                            <details className={styles.logDetails}>
                              <summary className={styles.logSummary}>
                                <span className={styles.logActor}>{e.actor}</span>
                                <Pill>{e.kind}</Pill>
                                <span className={styles.logText}>{e.summary}</span>
                              </summary>
                              <div className={styles.logPayload}>{e.payload}</div>
                            </details>
                          ) : (
                            <div className={styles.logSummary}>
                              <span className={styles.logActor}>{e.actor}</span>
                              <Pill>{e.kind}</Pill>
                              <span className={styles.logText}>{e.summary}</span>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          ) : (
            <div className={styles.empty}>No task.</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
