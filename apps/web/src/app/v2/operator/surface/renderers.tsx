'use client';

/* SPEC-OBJECT-CONTRACT-V2 OC5 — the Operator view renderers.
 *
 * Each is a thin wrapper: it casts the host to OperatorHost, pulls the live
 * slice + callbacks, and renders the existing operator component unchanged. The
 * layout that places them is data (the surface objects), not this code. */

import type { CSSProperties } from 'react';
import type { SurfaceViewRendererProps } from '@/components/commonplace/surface/types';
import { bayUrgency } from '@/lib/theorem-operator';
import type { OperatorHost } from './OperatorBlockHost';
import { AttentionStrip } from '../AttentionStrip';
import { BayCard } from '../BayCard';
import { Queue } from '../Queue';
import styles from '../operator.module.css';

export function OperatorAttentionView({ host }: SurfaceViewRendererProps) {
  const h = host as OperatorHost;
  return (
    <AttentionStrip
      counts={h.attention}
      onAwaiting={h.callbacks.scrollToBays}
      onBlocked={h.callbacks.toggleBlockedOnly}
      onGate={h.callbacks.openGate}
    />
  );
}

export function OperatorBaysView({ host }: SurfaceViewRendererProps) {
  const h = host as OperatorHost;
  return (
    <section className={styles.bayStrip} aria-label="Bays" data-op="bays">
      {h.bays.map((bay) => (
        <BayCard
          key={bay.head}
          bay={bay}
          urgency={bayUrgency(bay, h.urgentFromHeads)}
          onOpenRoom={h.callbacks.openRoom}
        />
      ))}
    </section>
  );
}

export function OperatorQueueView({ host }: SurfaceViewRendererProps) {
  const h = host as OperatorHost;
  return (
    <Queue
      tasks={[...h.tasks]}
      onOpen={h.callbacks.openRoom}
      onReorder={h.callbacks.reorder}
      blockedOnly={h.blockedOnly}
    />
  );
}

/* The swap-demo variant: the same bays, rendered as a compact table instead of
 * cards. Styled inline against the porcelain tokens so it stays self-contained. */
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const cellStyle: CSSProperties = {
  padding: 'calc(var(--u) * 1.25) var(--u)',
  borderBottom: '1px solid var(--hair)',
  textAlign: 'left',
  verticalAlign: 'baseline',
};

export function OperatorBayTableView({ host }: SurfaceViewRendererProps) {
  const h = host as OperatorHost;
  return (
    <table style={tableStyle} data-op="bays">
      <tbody>
        {h.bays.map((bay) => {
          const urgency = bay.task ? bayUrgency(bay, h.urgentFromHeads) : 'idle';
          return (
            <tr
              key={bay.head}
              onClick={() => bay.task && h.callbacks.openRoom(bay.task.id)}
              style={{ cursor: bay.task ? 'pointer' : 'default' }}
            >
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', color: 'var(--ink-dim)', width: '9rem' }}>
                {bay.label}
              </td>
              <td style={{ ...cellStyle, fontWeight: 500 }}>{bay.task?.title ?? '—'}</td>
              <td style={{ ...cellStyle, color: 'var(--ink-dim)', width: '6rem' }}>{urgency}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
