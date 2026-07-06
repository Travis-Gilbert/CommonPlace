'use client';

/* List — one row per object: thumb/emoji + title + a few inline cells. */
import type { DbViewProps } from './view-types';
import { RelationCell } from './cells';
import styles from './database.module.css';

export function ListView({ graph, objects, view, onOpen }: DbViewProps) {
  const cols = view.visibleRelations.filter((k) => graph.relations[k]).slice(0, 4);
  if (objects.length === 0) return <div className={styles.empty}>No objects.</div>;
  return (
    <div className={styles.list}>
      {objects.map((o) => (
        <div key={o.id} className={styles.row} onClick={() => onOpen(o.id)}>
          {o.cover ? <img className={styles.rowThumb} src={o.cover.url} alt="" loading="lazy" /> : <span className={styles.rowEmoji}>{o.emoji ?? '◍'}</span>}
          <span className={styles.rowTitle}>{o.title}</span>
          <span className={styles.rowCells}>
            {cols.filter((k) => o.cells[k]).map((k) => (
              <RelationCell key={k} cell={o.cells[k]} density="inline" />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
