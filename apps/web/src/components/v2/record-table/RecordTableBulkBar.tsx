// Floating bulk-action bar that appears when rows are selected.
// Slides up from the bottom with a count and action buttons.

'use client';

import { useCallback, type FC } from 'react';
import { useRecordTableStore } from './record-table-store';
import styles from './record-table.module.css';

interface RecordTableBulkBarProps {
  count: number;
}

export const RecordTableBulkBar: FC<RecordTableBulkBarProps> = ({ count }) => {
  const store = useRecordTableStore();

  const clearSelection = useCallback(() => {
    store.clearSelection();
  }, [store]);

  return (
    <div className={styles['rt-bulk-bar']} role="toolbar" aria-label={`${count} rows selected`}>
      <span className={styles['rt-bulk-count']}>
        {count} row{count !== 1 ? 's' : ''} selected
      </span>
      <div className={styles['rt-bulk-actions']}>
        <button
          className={styles['rt-bulk-btn']}
          onClick={clearSelection}
          aria-label="Clear selection"
        >
          Clear
        </button>
        {/* Additional action slots for delete, export, etc. */}
      </div>
    </div>
  );
};
