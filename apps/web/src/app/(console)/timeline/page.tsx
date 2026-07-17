'use client';

/* Timeline (Data): the bi-temporal axis. Items on a vertical spine; the toggle
   scrubs between transaction time (created_at, when the record landed) and valid
   time (valid_from, when the assertion holds in the world). Items with no valid
   interval surface honestly as "no valid time" in valid-time view.

   Strangler discipline: seed rows so the surface can be judged against the
   north-star. Replace ITEMS with commonplace-api itemsAsOf(validAtMs,
   transactionAtMs); the toggle then drives the as-of query parameters. */

import { useMemo, useState } from 'react';
import styles from './timeline.module.css';

type Item = { id: string; kind: string; title: string; created: string; validFrom: string | null };

const ITEMS: Item[] = [
  { id: 'itm_9f2a', kind: 'file', title: 'Ordinance 24-113, porch lighting and setbacks.pdf', created: '2026-07-02', validFrom: '2026-06-18' },
  { id: 'itm_7c11', kind: 'link', title: 'How ADHD brains use external memory systems', created: '2026-07-02', validFrom: null },
  { id: 'itm_5b83', kind: 'note', title: 'Voice note, 47 seconds (transcribed)', created: '2026-07-01', validFrom: null },
  { id: 'itm_44de', kind: 'task', title: 'Send GCLBA compliance report, week 27', created: '2026-07-01', validFrom: '2026-07-06' },
  { id: 'itm_2a90', kind: 'claim', title: 'Required setback distance is 15 feet on corner lots', created: '2026-06-30', validFrom: '2026-06-18' },
  { id: 'itm_1f57', kind: 'note', title: 'Pairformer scatter-add kernel notes', created: '2026-06-29', validFrom: null },
  { id: 'itm_0c3b', kind: 'source', title: '2019 zoning map, Genesee County', created: '2026-06-28', validFrom: '2019-01-01' },
  { id: 'itm_e81d', kind: 'link', title: 'Elicit corpus-table extraction pattern', created: '2026-06-27', validFrom: null },
];

type Basis = 'transaction' | 'valid';

export default function TimelinePage() {
  const [basis, setBasis] = useState<Basis>('transaction');

  const ordered = useMemo(() => {
    const rows = ITEMS.map((i) => {
      const when = basis === 'valid' ? i.validFrom : i.created;
      const other = basis === 'valid' ? i.created : i.validFrom;
      return { ...i, when, other, hasWhen: when !== null };
    });
    return rows.sort((a, b) => {
      if (a.hasWhen && b.hasWhen) return (b.when as string).localeCompare(a.when as string);
      if (a.hasWhen) return -1;
      if (b.hasWhen) return 1;
      return 0;
    });
  }, [basis]);

  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Data / Timeline</div>
          <h1 className="p-h1">Timeline</h1>
        </div>
        <div className={styles.toolbar} role="tablist" aria-label="Time basis">
          <button
            className={`${styles.seg} ${basis === 'transaction' ? styles.segActive : ''}`}
            onClick={() => setBasis('transaction')}
          >
            Transaction time
          </button>
          <button
            className={`${styles.seg} ${basis === 'valid' ? styles.segActive : ''}`}
            onClick={() => setBasis('valid')}
          >
            Valid time
          </button>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.timeline}>
          {ordered.map((i) => (
            <div key={i.id} className={styles.item}>
              <span className={`${styles.dot} ${!i.hasWhen ? styles.dotNull : ''}`} />
              <div className={styles.card}>
                <div className={`${styles.when} ${!i.hasWhen ? styles.whenNull : ''}`}>
                  {i.hasWhen ? i.when : 'no valid time'}
                </div>
                <div className={styles.title}>{i.title}</div>
                <div className={styles.meta}>
                  <span className={styles.pill}>{i.kind}</span>
                  <span className={styles.other}>
                    {basis === 'valid' ? 'created' : 'valid from'} {i.other ?? 'none'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
