'use client';

/* OP4 — the run drawer. A right-side deploy-log for any claimed or done task,
   assembled from that task's coordination records, contributions, stream events,
   and checklist transitions. Verify First renders as a checklist at the top.
   Active tasks cursor-tail live; done tasks reconstruct cold from the substrate.

   Built on Radix Dialog for the overlay (focus trap, Escape, aria-modal, portal),
   dressed in porcelain. Event payloads expand with native <details>. */

import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw } from 'lucide-react';
import type { RunDrawer as RunDrawerData } from '@/lib/theorem-operator';
import { Pill, SourceBadge, Dot, formatTime } from './parts';
import styles from './operator.module.css';

export function RunDrawer({
  drawer,
  open,
  onClose,
  onRefresh,
  busy,
}: {
  drawer: RunDrawerData | null;
  open: boolean;
  onClose: () => void;
  onRefresh: (taskId: string) => void;
  busy: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={styles.drawer} aria-describedby={undefined}>
          {drawer ? (
            <>
              <div className={styles.drawerHead}>
                <div>
                  <Dialog.Title className={styles.drawerTitle}>{drawer.goal}</Dialog.Title>
                  <div className={styles.drawerSub}>
                    <span className={`${styles.mono} ${styles.dim}`}>{drawer.taskId}</span>
                    {drawer.live ? (
                      <Pill tone="ok">live</Pill>
                    ) : (
                      <Pill>cold replay</Pill>
                    )}
                    {drawer.cursor && <span className={`${styles.mono} ${styles.dim}`}>{drawer.cursor}</span>}
                    <SourceBadge source={drawer.source} />
                  </div>
                </div>
                <div className={styles.drawerHeadActions}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => onRefresh(drawer.taskId)}
                    disabled={busy}
                    title={drawer.live ? 'Pull the latest cursor delta' : 'Reconstruct from the substrate'}
                    aria-label="Refresh drawer"
                  >
                    <RefreshCw className={styles.glyph} data-spin={busy || undefined} />
                  </button>
                  <Dialog.Close className={styles.iconBtn} aria-label="Close drawer">
                    <X className={styles.glyph} />
                  </Dialog.Close>
                </div>
              </div>

              {/* Verify First checklist at the top of the drawer */}
              <div className={styles.verifyBlock}>
                <div className={styles.verifyHead}>Verify First</div>
                <ul className={styles.verifyList}>
                  {drawer.verifyFirst.map((v) => (
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

              {/* Deploy-log event stream */}
              <div className={styles.logHead}>Event stream</div>
              <ol className={styles.log}>
                {drawer.events.map((e) => (
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
          ) : (
            <div className={styles.empty}>No drawer.</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
