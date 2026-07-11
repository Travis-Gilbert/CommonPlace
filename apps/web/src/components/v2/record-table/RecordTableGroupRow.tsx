// Group header row for group-by feature.
// Renders a collapsible group header with group key label and count.
// Uses store for collapse state and column count unless overridden via props.

'use client';

import { type FC } from 'react';
import { useRecordTableStore } from './record-table-store';
import styles from './record-table.module.css';

interface RecordTableGroupRowProps {
  /** The group value as a display label. */
  label: string;
  /** Number of rows in this group. */
  count: number;
  /** Nesting depth for indent. */
  depth: number;
  /** Optional override: whether the group is collapsed. Defaults to store. */
  collapsed?: boolean;
  /** Optional override: toggle callback. Defaults to store. */
  onToggle?: () => void;
}

export const RecordTableGroupRow: FC<RecordTableGroupRowProps> = ({
  label,
  count,
  depth,
  collapsed: collapsedOverride,
  onToggle,
}) => {
  const store = useRecordTableStore();
  const isCollapsed = collapsedOverride ?? store.collapsedGroups.has(label);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      store.toggleGroupCollapsed(label);
    }
  };

  const colSpan = store.columnOrder.filter(
    (id) => store.columnVisibility[id] !== false,
  ).length + (store.selectionMode !== 'none' ? 1 : 0);

  return (
    <tr
      className={styles['rt-tr-group']}
      data-group-key={label}
      role="row"
      aria-expanded={!isCollapsed}
    >
      <td
        className={styles['rt-td-group']}
        colSpan={colSpan || 1}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        <button
          className={styles['rt-group-toggle']}
          onClick={handleToggle}
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          <span className={`${styles['rt-group-chevron']} ${isCollapsed ? styles['rt-collapsed'] : ''}`}>
            ▶
          </span>
          <span className={styles['rt-group-label']}>{label}</span>
          <span className={styles['rt-group-count']}>{count}</span>
        </button>
      </td>
    </tr>
  );
};
