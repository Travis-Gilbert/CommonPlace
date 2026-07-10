// Floating bulk-action bar that appears when rows are selected.
// Actions emit real ObjectActions through the BlockHost. Delete is two-step
// (Delete then Confirm) so a large selection is not removed by one stray click.

'use client';

import { useCallback, useState, type FC } from 'react';
import type { BlockHost } from '@/lib/block-view/types';
import { useRecordTableStore } from './record-table-store';
import styles from './record-table.module.css';

interface RecordTableBulkBarProps {
  count: number;
  host: BlockHost;
}

export const RecordTableBulkBar: FC<RecordTableBulkBarProps> = ({ count, host }) => {
  const store = useRecordTableStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const clearSelection = useCallback(() => {
    setConfirmingDelete(false);
    store.clearSelection();
  }, [store]);

  const deleteSelected = useCallback(async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setBusy(true);
    const ids = [...store.selectedIds];
    try {
      // allSettled (not all): one rejection must not abort the batch or leave
      // the bar stuck. Count both rejections and non-ok receipts as failures.
      const results = await Promise.allSettled(ids.map((id) => host.emit({ kind: 'delete', id })));
      const failedIds = ids.filter((_, i) => {
        const result = results[i];
        return result.status === 'rejected' || !result.value.ok;
      });
      if (failedIds.length) {
        console.error(`RecordTable bulk delete: ${failedIds.length}/${ids.length} action(s) failed`, failedIds);
        // Narrow the selection to just the rows that failed, so the user sees
        // and can retry exactly those.
        store.selectAll(failedIds);
      } else {
        store.clearSelection();
      }
    } finally {
      // Always clear transient UI state, even if every emit threw.
      setBusy(false);
      setConfirmingDelete(false);
    }
  }, [confirmingDelete, host, store]);

  return (
    <div className={styles['rt-bulk-bar']} role="toolbar" aria-label={`${count} rows selected`}>
      <span className={styles['rt-bulk-count']}>
        {count} row{count !== 1 ? 's' : ''} selected
      </span>
      <div className={styles['rt-bulk-actions']}>
        <button
          className={styles['rt-bulk-btn']}
          onClick={deleteSelected}
          disabled={busy}
          aria-label={confirmingDelete ? 'Confirm delete selected rows' : 'Delete selected rows'}
        >
          {busy ? 'Deleting' : confirmingDelete ? 'Confirm delete' : 'Delete'}
        </button>
        <button
          className={styles['rt-bulk-btn']}
          onClick={clearSelection}
          aria-label="Clear selection"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
