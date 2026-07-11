'use client';

/* Gallery — cover + title + subtitle + label-less relation rows (Anytype set). */
import type { DbViewProps } from './view-types';
import type { DbObject } from './model';
import { RelationCell } from './cells';
import styles from './database.module.css';

const TEXT_FORMATS = new Set(['shorttext', 'longtext']);

export function GalleryView({ graph, objects, view, onOpen }: DbViewProps) {
  const cols = view.visibleRelations.filter((k) => graph.relations[k]);
  if (objects.length === 0) return <div className={styles.empty}>No objects.</div>;
  return (
    <div className={styles.gallery}>
      {objects.map((o) => (
        <GalleryCard key={o.id} object={o} cols={cols} onOpen={onOpen} />
      ))}
    </div>
  );
}

function GalleryCard({ object, cols, onOpen }: { object: DbObject; cols: readonly string[]; onOpen: (id: string) => void }) {
  // First text cell becomes the italic subtitle (e.g. botanical name); the rest render as chip rows.
  const subKey = cols.find((k) => object.cells[k] && TEXT_FORMATS.has(object.cells[k].format));
  const rowKeys = cols.filter((k) => k !== subKey && object.cells[k]);

  return (
    <button type="button" className={styles.card} onClick={() => onOpen(object.id)}>
      {object.cover ? (
        <img className={styles.cardCover} src={object.cover.url} alt="" loading="lazy" />
      ) : (
        <div className={styles.cardCoverEmpty}>{object.emoji ?? '◍'}</div>
      )}
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>
          {object.title}
          {object.origin === 'seed' && <span className={styles.seedTag}>seed</span>}
        </div>
        {subKey && <div className={styles.cardSub}>{object.cells[subKey].text}</div>}
        {rowKeys.length > 0 && (
          <div className={styles.cellRows}>
            {rowKeys.map((k) => (
              <RelationCell key={k} cell={object.cells[k]} density="chip" />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
