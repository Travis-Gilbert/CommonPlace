// Filter chip bar for the record table.
// Shows active filter chips below the table header. Each chip can be removed
// or edited. Supports "add filter" to create new ones.

'use client';

import { useCallback, useState, type FC } from 'react';
import type { ColumnMeta, FilterChip, FilterOp } from './types';
import { useRecordTableStore } from './record-table-store';
import styles from './record-table.module.css';

interface RecordTableFilterBarProps {
  columns: ColumnMeta[];
}

export const RecordTableFilterBar: FC<RecordTableFilterBarProps> = ({ columns }) => {
  const store = useRecordTableStore();
  const [addingFilter, setAddingFilter] = useState(false);
  const [newField, setNewField] = useState('');
  const [newOp, setNewOp] = useState<FilterOp>('contains');
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
      op: newOp,
      value: newValue,
    });
    setNewValue('');
    setNewField('');
    setNewOp('contains');
    setAddingFilter(false);
  }, [newField, newOp, newValue, store]);

  const clearAll = useCallback(() => {
    store.clearFilters();
  }, [store]);

  return (
    <div className={styles['rt-filter-bar']} role="search" aria-label="Active filters">
      <label className={styles['rt-filter-groupby']}>
        <span>Group</span>
        <select
          className={styles['rt-filter-select']}
          value={store.groupBy?.field ?? ''}
          onChange={(e) =>
            store.setGroupBy(e.target.value ? { field: e.target.value, expanded: true } : null)
          }
          aria-label="Group by field"
        >
          <option value="">None</option>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {store.filters.map((f) => {
        const col = columns.find((c) => c.id === f.field);
        return (
          <div key={f.id} className={styles['rt-filter-chip']}>
            <span className={styles['rt-filter-chip-field']}>{col?.label ?? f.field}</span>
            <span className={styles['rt-filter-chip-op']}>{f.op}</span>
            <span className={styles['rt-filter-chip-value']}>{`"${f.value}"`}</span>
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
          <select
            className={styles['rt-filter-select']}
            value={newOp}
            onChange={(e) => setNewOp(e.target.value as FilterOp)}
            aria-label="Filter operator"
          >
            <option value="contains">contains</option>
            <option value="eq">=</option>
            <option value="gt">&gt;</option>
            <option value="gte">&ge;</option>
            <option value="lt">&lt;</option>
            <option value="lte">&le;</option>
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
