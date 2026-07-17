'use client';

/* The Room Panel: progressive disclosure for one task's room. Drawer from the
   right (720px, focus-trapped, Escape closes). Not tabs: three stacked sections
   with sticky mini-headers.

   1. Spec: the claimed task's markdown (CommonPlace renderer: react-markdown +
      GFM so the Build Table renders live), plus Verify First states and the
      OP3 Send action for a queued, unblocked task.
   2. Activity: footprint file list, then the last 20 room events, mono,
      timestamped, no cards around them.
   3. Chat: the Task Dial composer, fixed at the bottom; messages scroll above.

   The Operator page is the aggregate view; this panel is the unit view. The
   room binding travels with the panel: never a global selector. */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Bay, HeadId, OperatorTask, RegisteredHead, RoomMessage, RunDrawer } from '@/lib/theorem-operator';
import { isBlocked, unmetPrerequisites } from '@/lib/theorem-operator';
import { formatTime } from './parts';
import { TaskDialComposer } from './TaskDialComposer';
import styles from './operator.module.css';

export function RoomPanel({
  task,
  run,
  bays,
  emptyBays,
  open,
  onClose,
  onSend,
  onRefresh,
  onSendMessage,
  busy,
}: {
  task: OperatorTask | null;
  run: RunDrawer | null;
  bays: Bay[];
  emptyBays: RegisteredHead[];
  open: boolean;
  onClose: () => void;
  onSend: (taskId: string, head: HeadId) => void;
  onRefresh: (taskId: string) => void;
  onSendMessage: (taskId: string, text: string, mention?: HeadId) => Promise<boolean>;
  busy: boolean;
}) {
  const blocked = task ? isBlocked(task) : false;
  const unmet = task ? unmetPrerequisites(task) : [];
  const sendable = !!task && task.status === 'queued' && !blocked && emptyBays.length > 0;

  // Optimistic chat tail: substrate messages + what the human just sent.
  const [localMessages, setLocalMessages] = useState<RoomMessage[]>([]);
  useEffect(() => setLocalMessages([]), [task?.id]);
  const messages = useMemo(
    () => [...(run?.messages ?? []), ...localMessages],
    [run?.messages, localMessages],
  );
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  async function sendMessage(text: string, mention?: HeadId) {
    if (!task) return;
    const ok = await onSendMessage(task.id, text, mention);
    if (ok) {
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `local_${prev.length}`,
          at: new Date().toISOString(),
          from: 'you',
          text: mention ? `@${mention} ${text}` : text,
        },
      ]);
    }
  }

  const events = useMemo(() => (run?.events ?? []).slice(-20), [run?.events]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={`porcelain ${styles.panel}`} aria-describedby={undefined}>
          {task ? (
            <>
              <div className={styles.panelHead}>
                <div className={styles.panelHeadText}>
                  <Dialog.Title className={styles.drawerTitle}>{task.goal}</Dialog.Title>
                  <div className={styles.drawerSub}>
                    {task.laneChip && <span className={styles.qChip}>{task.laneChip}</span>}
                    <span className={styles.statusMuted}>{blocked ? 'blocked' : task.status}</span>
                    {task.claim && <span className={`${styles.mono} ${styles.dim}`}>{task.claim.head}</span>}
                  </div>
                </div>
                <div className={styles.drawerHeadActions}>
                  {run && (
                    <button
                      className={styles.iconBtn}
                      onClick={() => onRefresh(task.id)}
                      disabled={busy}
                      title={run.live ? 'Pull the latest cursor delta' : 'Reconstruct from the substrate'}
                      aria-label="Refresh room"
                    >
                      <RefreshCw className={styles.glyph} data-spin={busy || undefined} />
                    </button>
                  )}
                  <Dialog.Close className={styles.iconBtn} aria-label="Close room panel">
                    <X className={styles.glyph} />
                  </Dialog.Close>
                </div>
              </div>

              <div className={styles.panelScroll}>
                {/* ── 1. Spec ─────────────────────────────────────────────── */}
                <div className={styles.panelMiniHead}>Spec</div>
                <section className={styles.panelSection} aria-label="Spec">
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

                  {run?.specMarkdown ? (
                    <div className={styles.specProse}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.specMarkdown}</ReactMarkdown>
                    </div>
                  ) : (
                    <>
                      {task.prerequisites.length > 0 && (
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
                      )}
                      {task.fileScope && task.fileScope.length > 0 && (
                        <div className={styles.chips}>
                          {task.fileScope.map((f) => (
                            <span key={f} className={styles.chip}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                      {!task.prerequisites.length && !task.fileScope?.length && (
                        <div className={`${styles.mono} ${styles.dim}`}>No spec bound yet.</div>
                      )}
                    </>
                  )}

                  {run && run.verifyFirst.length > 0 && (
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
                  )}

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
                      Blocked: needs {unmet.map((p) => `"${p.goal}"`).join(', ')} before it can be claimed.
                    </div>
                  ) : null}
                </section>

                {/* ── 2. Activity ─────────────────────────────────────────── */}
                <div className={styles.panelMiniHead}>
                  Activity
                  {run && (
                    <span className={styles.statusMuted}>{run.live ? 'live tail' : 'cold replay'}</span>
                  )}
                </div>
                <section className={styles.panelSection} aria-label="Activity">
                  {run?.footprint && run.footprint.length > 0 && (
                    <ul className={styles.footprintList}>
                      {run.footprint.map((f) => (
                        <li key={f} className={styles.footprintItem}>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  {events.length === 0 ? (
                    <div className={`${styles.mono} ${styles.dim}`}>No events yet.</div>
                  ) : (
                    <ol className={styles.activityLog}>
                      {events.map((e) => (
                        <li key={e.id} className={styles.activityRow}>
                          <span className={styles.activityTime}>{formatTime(e.at)}</span>
                          <span className={styles.activityActor}>{e.actor}</span>
                          <span className={styles.activityKind}>{e.kind}</span>
                          <span className={styles.activityText}>{e.summary}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                {/* ── 3. Chat ─────────────────────────────────────────────── */}
                <div className={styles.panelMiniHead}>Chat</div>
                <section className={`${styles.panelSection} ${styles.panelChat}`} aria-label="Chat">
                  {messages.length === 0 ? (
                    <div className={`${styles.mono} ${styles.dim}`}>Nothing said in this room yet.</div>
                  ) : (
                    <ol className={styles.chatList}>
                      {messages.map((m) => (
                        <li key={m.id} className={styles.chatMsg} data-you={m.from === 'you' || undefined}>
                          <span className={styles.chatMeta}>
                            <span className={styles.activityActor}>{m.from}</span>
                            <span className={styles.activityTime}>{formatTime(m.at)}</span>
                          </span>
                          <span className={styles.chatText}>{m.text}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div ref={chatEndRef} />
                </section>
              </div>

              {/* Composer: fixed at the bottom of the drawer. */}
              <TaskDialComposer bays={bays} drawer={run} busy={busy} onSend={(text, mention) => void sendMessage(text, mention)} />
            </>
          ) : (
            <div className={styles.empty}>No task.</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
