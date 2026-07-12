'use client';

/**
 * Receipt rail (HANDOFF-COBROWSE-PRESENCE D6): a quiet collapsible timeline of
 * agent actions, captures, and approvals in order. Collapsed by default,
 * persistent across in-session navigation, never a modal, never the headline.
 * Entries stream in as actions complete; rows virtualize via
 * @tanstack/react-virtual so a long session scrolls smoothly.
 */

import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import styles from './cobrowse.module.css';
import type { RailEntry } from './useCoBrowseSession';

function kindClass(kind: RailEntry['kind']): string {
  if (kind === 'approval' || kind === 'decline') {
    return `${styles.railKind} ${styles.railKindApproval}`;
  }
  if (kind === 'capture') return `${styles.railKind} ${styles.railKindCapture}`;
  return styles.railKind;
}

export function ReceiptRail({ entries }: { entries: RailEntry[] }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 30,
    overscan: 12,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  return (
    <div className={styles.rail}>
      <button
        type="button"
        className={styles.railToggle}
        aria-expanded={open}
        onPointerDown={() => setOpen((prev) => !prev)}
      >
        <span>Receipts</span>
        <span>{entries.length === 1 ? '1 entry' : `${entries.length} entries`}</span>
      </button>
      {open ? (
        <div ref={bodyRef} className={styles.railBody}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => {
              const entry = entries[row.index];
              const expanded = expandedId === entry.id;
              return (
                <div
                  key={entry.id}
                  ref={virtualizer.measureElement}
                  data-index={row.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <button
                    type="button"
                    className={styles.railEntry}
                    aria-expanded={expanded}
                    onPointerDown={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <span className={kindClass(entry.kind)}>{entry.kind}</span>
                    <span>{entry.summary}</span>
                  </button>
                  {expanded && entry.receipt !== undefined ? (
                    <div className={styles.railReceipt}>
                      {formatReceipt(entry.receipt)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Receipt fields as readable key/value lines; never a raw JSON headline. */
function formatReceipt(receipt: unknown): string {
  if (receipt === null || typeof receipt !== 'object') return String(receipt);
  return Object.entries(receipt as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) =>
      typeof value === 'object' ? `${key}: ${JSON.stringify(value)}` : `${key}: ${String(value)}`,
    )
    .join('\n');
}
