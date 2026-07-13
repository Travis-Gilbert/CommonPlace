'use client';

/* The gate, relocated: OP5's review content unchanged in substance, now behind
   the Gate badge on the breadcrumb rail instead of a tab. A drawer keeps the
   monitoring screen a single surface; the evening ritual opens on demand. */

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { GateCard } from '@/lib/theorem-operator';
import { Gate } from './Gate';
import styles from './operator.module.css';

export function GateDrawer({
  cards,
  busy,
  open,
  onClose,
  onPass,
  onBounce,
}: {
  cards: GateCard[];
  busy: string | null;
  open: boolean;
  onClose: () => void;
  onPass: (taskId: string) => void;
  onBounce: (taskId: string, requiredChanges: string) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.drawerOverlay} />
        <Dialog.Content className={`porcelain ${styles.panel}`} aria-describedby={undefined}>
          <div className={styles.panelHead}>
            <Dialog.Title className={styles.drawerTitle}>The gate</Dialog.Title>
            <Dialog.Close className={styles.iconBtn} aria-label="Close gate">
              <X className={styles.glyph} />
            </Dialog.Close>
          </div>
          <div className={styles.panelScroll}>
            <Gate cards={cards} busy={busy} onPass={onPass} onBounce={onBounce} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
