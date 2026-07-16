'use client';

/* Object detail — cover hero, featured line, poster + relations, body.
   Mirrors the Anytype object page (2001: A Space Odyssey). */
import { ArrowLeft } from '@/lib/icons';
import type { DbObject, ObjectGraph } from './model';
import { RelationCell } from './cells';
import styles from './database.module.css';

export function ObjectDetail({ graph, object, onBack }: { graph: ObjectGraph; object: DbObject; onBack: () => void }) {
  const cellKeys = Object.keys(object.cells);
  const featNumber = cellKeys.find((k) => object.cells[k].format === 'number');
  const featTag = cellKeys.find((k) => object.cells[k].format === 'status' || object.cells[k].format === 'tag');
  const posterCell = cellKeys.map((k) => object.cells[k]).find((c) => c.format === 'file' && c.files?.length);
  const poster = posterCell?.files?.[0]?.url ?? object.cover?.url;
  const description = cellKeys.map((k) => object.cells[k]).find((c) => c.key === 'description' || (c.format === 'longtext' && (c.text?.length ?? 0) > 40));
  const relKeys = cellKeys.filter((k) => object.cells[k] !== description && object.cells[k] !== posterCell);

  return (
    <div className={styles.detail}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <ArrowLeft size={15} /> {graph.set.name}
      </button>
      {object.cover && <img className={styles.detailHero} src={object.cover.url} alt="" />}
      <div className={styles.detailInner}>
        <h1 className={styles.detailTitle}>
          {object.emoji && <span className={styles.detailEmoji}>{object.emoji}</span>}
          {object.title}
        </h1>
        <div className={styles.featLine}>
          <span>{graph.type.name}</span>
          {featNumber && (<><span className={styles.featDot}>·</span><RelationCell cell={object.cells[featNumber]} density="inline" /></>)}
          {featTag && (<><span className={styles.featDot}>·</span><RelationCell cell={object.cells[featTag]} density="inline" /></>)}
        </div>
        <div className={styles.detailGrid}>
          {poster && <img className={styles.detailPoster} src={poster} alt="" />}
          <div>
            {description?.text && <p className={styles.detailBody}>{description.text}</p>}
            <div className={styles.relTable}>
              {relKeys.map((k) => (
                <div key={k} className={styles.relRow}>
                  <span className={styles.relLabel}>{graph.relations[k]?.name ?? object.cells[k].name}</span>
                  <span className={styles.relVal}><RelationCell cell={object.cells[k]} density="inline" /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
