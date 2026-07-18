'use client';

/**
 * Carry lineage link (HANDOFF-CARRY C4.2): the research bundle's ancestor and
 * descendants, navigable both ways. From a research session it links up to the
 * carried session it was seeded from; from that carried session it links down to
 * the research sessions it seeded. Clicking a link opens that session's rail
 * inline, so the lineage is traversable in either direction.
 */

import { useState } from 'react';

import { useBundle } from '@/lib/carry/useBundle';
import { SessionRail } from '@/components/commonplace/rail/SessionRail';
import styles from './carry-lineage.module.css';

export function CarryLineage({ sessionId }: { sessionId: string | null }) {
  const bundle = useBundle(sessionId);
  const [openId, setOpenId] = useState<string | null>(null);

  const parent = bundle?.parentSessionId;
  const children = bundle?.childSessionIds ?? [];
  if (!bundle || (!parent && children.length === 0)) return null;

  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  return (
    <div className={styles.lineage}>
      <div className={styles.links}>
        {parent ? (
          <button
            type="button"
            className={styles.link}
            aria-expanded={openId === parent}
            onClick={() => toggle(parent)}
          >
            ↑ Seeded from a carried session
          </button>
        ) : null}
        {children.map((child, index) => (
          <button
            key={child}
            type="button"
            className={styles.link}
            aria-expanded={openId === child}
            onClick={() => toggle(child)}
          >
            ↓ Seeded research {children.length > 1 ? index + 1 : ''}
          </button>
        ))}
      </div>
      {openId ? (
        <div className={styles.linkedRail}>
          <SessionRail sessionId={openId} title="Linked session" defaultOpen />
        </div>
      ) : null}
    </div>
  );
}
