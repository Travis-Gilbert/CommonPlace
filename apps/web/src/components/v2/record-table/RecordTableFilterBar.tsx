// Filter chip bar for the record table.
// Shows active filter chips below the table header. Each chip can be removed
// or edited. Supports "add filter" to create new ones.

'use client';

import { useCallback, useState, type FC } from 'react';
import type { ColumnMeta, FilterChip } from './types';
import { useRecordTableStore } from './record-table-store';
import styles from './record-table.module.css';

interface RecordTableFilterBarProps {
  columns: ColumnMeta[];
}

export const RecordTableFilterBar: FC<RecordTableFilterBarProps> = ({ columns }) => {
  const store = useRecordTableStore();
  const [addingFilter, setAddingFilter] = useState(false);
  const [newField, setNewField] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleRemoveFilter = useCallback(
    (id: string) => {
      store.removeFilter(id);
    },
    [store],
  );

  const handleAddFilter = useCallback(() => {
    if (!newField || !newValue) return;
    const id = `filter-${Date.now()}`;
    store.addFilter({
      id,
      field: newField,
      op: 'contains',
      value: newValue,
    });
    setNewValue('');
    setNewField('');
    setAddingFilter(false);
  }, [newField, newValue, store]);

  const clearAll = useCallback(() => {
    store.clearFilters();
  }, [store]);

  return (
    <div className={styles['rt-filter-bar']} role="search" aria-label="Active filters">
      {store.filters.map((f) => {
        const col = columns.find((c) => c.id === f.field);
        return (
          <div key={f.id} className={styles['rt-filter-chip']}>
            <span className={styles['rt-filter-chip-field']}>{col?.label ?? f.field}</span>
            <span className={styles['rt-filter-chip-op']}>{f.op}</span>
            <span className={styles['rt-filter-chip-value']}>"{f.value}"</span>
            <button
              className={styles['rt-filter-chip-remove']}
              onClick={() => handleRemoveFilter(f.id)}
              aria-label={`Remove filter on ${col?.label ?? f.field}`}
            >
              ×
            </button>
          </div>
        );
      })}

      {addingFilter ? (
        <div className={styles['rt-filter-add-form']}>
          <select
            className={styles['rt-filter-select']}
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            aria-label="Filter field"
          >
            <option value="">Field…</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className={styles['rt-filter-input']}
            type="text"
            placeholder="Value…"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFilter();
              if (e.key === 'Escape') setAddingFilter(false);
            }}
            aria-label="Filter value"
          />
          <button className={styles['rt-filter-add-btn']} onClick={handleAddFilter}>
            Add
          </button>
          <button className={styles['rt-filter-cancel-btn']} onClick={() => setAddingFilter(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          className={styles['rt-filter-new-btn']}
          onClick={() => setAddingFilter(true)}
        >
          + Filter
        </button>
      )}

      {store.filters.length > 0 && (
        <button className={styles['rt-filter-clear-all']} onClick={clearAll}>
          Clear all
        </button>
      )}
    </div>
  );
};
