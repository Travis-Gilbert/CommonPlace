'use client';

/**
 * Session receipt rail (HANDOFF-CARRY C5.1, shared with HANDOFF-PUBLISH P4.4).
 * One quiet, collapsible timeline for a session: browse actions, the carry
 * event, destination actions, and publish events, in order. Entries stream in
 * from the session-keyed rail store, so the rail travels across destinations and
 * a second carry appends rather than forking (C5.3). Each entry expands to its
 * receipt (the carry manifest, the publish receipt): receipts beneath capability,
 * never the headline.
 */

import { useState } from 'react';

import { useSessionRail } from '@/lib/carry/useBundle';
import type { SessionRailKind } from '@/lib/carry/session-rail';
import styles from './session-rail.module.css';

function kindClass(kind: SessionRailKind): string {
  switch (kind) {
    case 'carry':
      return `${styles.kind} ${styles.kindCarry}`;
    case 'publish':
      return `${styles.kind} ${styles.kindPublish}`;
    case 'destination':
      return `${styles.kind} ${styles.kindDestination}`;
    case 'approval':
    case 'decline':
      return `${styles.kind} ${styles.kindApproval}`;
    case 'capture':
      return `${styles.kind} ${styles.kindCapture}`;
    default:
      return styles.kind;
  }
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

export function SessionRail({
  sessionId,
  title = 'Session',
  defaultOpen = false,
}: {
  sessionId: string | null;
  title?: string;
  defaultOpen?: boolean;
}) {
  const entries = useSessionRail(sessionId);
  const [open, setOpen] = useState(defaultOpen);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!sessionId || entries.length === 0) return null;

  return (
    <div className={styles.rail}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{title}</span>
        <span className={styles.count}>
          {entries.length === 1 ? '1 entry' : `${entries.length} entries`}
        </span>
      </button>
      {open ? (
        <div className={styles.body}>
          {entries.map((entry) => {
            const expanded = expandedId === entry.id;
            const hasReceipt = entry.receipt !== undefined && entry.receipt !== null;
            return (
              <div key={entry.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.entry}
                  aria-expanded={hasReceipt ? expanded : undefined}
                  onClick={() => hasReceipt && setExpandedId(expanded ? null : entry.id)}
                >
                  <span className={kindClass(entry.kind)}>{entry.kind}</span>
                  <span className={styles.summary}>{entry.summary}</span>
                </button>
                {expanded && hasReceipt ? (
                  <pre className={styles.receipt}>{formatReceipt(entry.receipt)}</pre>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
