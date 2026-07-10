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
    const results = await Promise.all(ids.map((id) => host.emit({ kind: 'delete', id })));
    const failed = results.filter((result) => !result.ok);
    if (failed.length) {
      console.error(`RecordTable bulk delete: ${failed.length}/${ids.length} action(s) failed`, failed);
    }
    setBusy(false);
    setConfirmingDelete(false);
    store.clearSelection();
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
