'use client';

/* OP3: assign and bootstrap. Dispatch-as-spawner is out of scope for v1: "Send
   to head" assigns the task and renders a copy-ready session bootstrap block (task
   id, governing handoff path, and the one-line opener that invokes the AGENTS.md
   protocol). Pasted into a fresh head session, it makes that head claim the task.
   The button graduates to true dispatch when the receiver lands, with no UI change. */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Copy, Check } from 'lucide-react';
import type { SessionBootstrap } from '@/lib/theorem-operator';
import styles from './operator.module.css';

export function BootstrapDialog({
  bootstrap,
  onClose,
}: {
  bootstrap: SessionBootstrap | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!bootstrap) return;
    try {
      await navigator.clipboard.writeText(bootstrap.block);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog.Root open={!!bootstrap} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={`porcelain ${styles.bootstrap}`} aria-describedby={undefined}>
          {bootstrap && (
            <>
              <div className={styles.bootstrapHead}>
                <Dialog.Title className={styles.bootstrapTitle}>
                  Session bootstrap → {bootstrap.head}
                </Dialog.Title>
                <Dialog.Close className={styles.iconBtn} aria-label="Close">
                  <X className={styles.glyph} />
                </Dialog.Close>
              </div>
              <p className={styles.bootstrapHint}>
                Assigned and mention published. Paste this into a fresh {bootstrap.head} session to have it
                claim the task and run Verify First before code.
              </p>
              <pre className={styles.bootstrapBlock}>{bootstrap.block}</pre>
              <div className={styles.bootstrapActions}>
                <button className={styles.btnNavy} onClick={copy}>
                  {copied ? <Check className={styles.glyph} /> : <Copy className={styles.glyph} />}
                  {copied ? 'Copied' : 'Copy bootstrap'}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
