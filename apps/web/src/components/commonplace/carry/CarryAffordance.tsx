'use client';

/**
 * Carry affordance (HANDOFF-CARRY C1.3 / D2): a quiet count in the session
 * chrome that appears only once the bundle is non-empty (gold register), then
 * offers the one Carry action with its three destinations. Never the headline:
 * before the bundle has anything it renders nothing.
 *
 * The count is live from the real bundle store; the destinations dispatch the
 * real carry orchestration supplied by the mounting surface. No dead controls.
 */

import { useState } from 'react';

import {
  CARRY_DESTINATIONS,
  CARRY_DESTINATION_LABEL,
  type CarryDestination,
} from '@/lib/carry/carry';
import { useBundleCount } from '@/lib/carry/useBundle';
import styles from './carry.module.css';

export function CarryAffordance({
  sessionId,
  onCarry,
  busy = false,
}: {
  sessionId: string | null;
  onCarry: (destination: CarryDestination) => void;
  /** True while a carry is in flight, so the menu reflects real progress. */
  busy?: boolean;
}) {
  const count = useBundleCount(sessionId);
  const [open, setOpen] = useState(false);

  // Quiet until the bundle is non-empty (spec D1: quiet before that).
  if (!sessionId || count === 0) return null;

  return (
    <div className={styles.carry}>
      <button
        type="button"
        className={styles.carryChip}
        aria-expanded={open}
        aria-label={`Carry ${count} ${count === 1 ? 'item' : 'items'}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.carryDot} aria-hidden />
        <span>Carry</span>
        <span className={styles.carryCount}>{count}</span>
      </button>
      {open ? (
        <div className={styles.carryMenu} role="menu">
          <div className={styles.carryMenuLabel}>
            Carry {count} {count === 1 ? 'source' : 'sources'} into
          </div>
          {CARRY_DESTINATIONS.map((destination) => (
            <button
              key={destination}
              type="button"
              role="menuitem"
              className={styles.carryDestination}
              disabled={busy}
              onClick={() => {
                onCarry(destination);
                setOpen(false);
              }}
            >
              {CARRY_DESTINATION_LABEL[destination]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
