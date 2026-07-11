'use client';

/* Records surface: the TW5 flip over a live ObjectQuery. Table and board are
   swapped in place over one ObjectSet from the connected instance. No mock data:
   an empty or unreachable instance renders an honest state (see RecordSurface). */

import type { ObjectQuery } from '@/lib/block-view/types';
import { RecordSurface } from '@/components/v2/surface/RecordSurface';
import styles from './records.module.css';

// Stable query reference: an inline object would re-run the surface fetch effect every render.
const RECORDS_QUERY: ObjectQuery = {
  types: ['task'],
  page: { limit: 200 },
};

export default function RecordsPage() {
  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Data / Records</div>
          <h1 className="p-h1">Records</h1>
        </div>
        <div className="p-cmd">
          <span>Search or command</span>
          <span className="p-kbd">&#8984;K</span>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.frame}>
          <RecordSurface query={RECORDS_QUERY} />
        </div>
      </div>
    </>
  );
}
