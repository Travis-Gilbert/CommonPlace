'use client';

/**
 * Keep confirmation (HANDOFF-COBROWSE-PRESENCE D8): small, fast, gold register.
 * Shows where the capture landed with real receipt fields only: destination
 * store, trust tier, nearest existing memory when the store returned one, and
 * the receipt id. The object link renders only when the store named the
 * written note's id; no fabricated destination text, ever. Motion is a single
 * 180ms rise, disabled under prefers-reduced-motion (see cobrowse.module.css).
 */

import type { AgentIngestionReceipt } from '@/lib/desktop';
import { useLayout } from '@/lib/providers/layout-provider';
import styles from './cobrowse.module.css';

export function KeepToast({
  receipt,
  onDismiss,
}: {
  receipt: AgentIngestionReceipt;
  onDismiss: () => void;
}) {
  const { launchView } = useLayout();
  const destination =
    receipt.storeTarget === 'hosted' ? 'hosted harness store' : 'local harness store';

  return (
    <div className={styles.keepToast} role="status">
      <div className={styles.keepHeading}>
        {receipt.status === 'ok' ? 'Kept' : 'Keep failed'}
      </div>
      {receipt.status === 'ok' ? (
        <>
          {receipt.objectId ? (
            <button
              type="button"
              className={styles.keepLink}
              onPointerDown={() => {
                launchView('object-detail', { objectSlug: receipt.objectId });
                onDismiss();
              }}
            >
              {receipt.title || receipt.url}
            </button>
          ) : (
            <span>{receipt.title || receipt.url}</span>
          )}
          <span className={styles.keepMeta}>
            {destination} · {receipt.trustTier ?? 'open_web_unverified'}
          </span>
          {receipt.nearestNeighbor ? (
            <span className={styles.keepMeta}>near: {receipt.nearestNeighbor}</span>
          ) : null}
          <span className={styles.keepMeta}>receipt {receipt.id}</span>
        </>
      ) : (
        <span className={styles.keepMeta}>{receipt.message}</span>
      )}
      <button type="button" className={styles.keepLink} onPointerDown={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
