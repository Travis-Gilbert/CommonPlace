'use client';

/* Grid — dense table. Columns = visible relations, first column the title. */
import type { DbViewProps } from './view-types';
import { RelationCell } from './cells';
import styles from './database.module.css';

export function GridView({ graph, objects, view, onOpen }: DbViewProps) {
  const cols = view.visibleRelations.filter((k) => graph.relations[k]);
  if (objects.length === 0) return <div className={styles.empty}>No objects.</div>;
  return (
    <div className={styles.gridScroll}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>Name</th>
            {cols.map((k) => (
              <th key={k}>{graph.relations[k]?.name ?? k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {objects.map((o) => (
            <tr key={o.id} onClick={() => onOpen(o.id)}>
              <td>
                <span className={styles.gridTitleCell}>
                  {o.cover ? <img className={styles.gridThumb} src={o.cover.url} alt="" loading="lazy" /> : o.emoji ? <span>{o.emoji}</span> : null}
                  {o.title}
                </span>
              </td>
              {cols.map((k) => (
                <td key={k}>{o.cells[k] ? <RelationCell cell={o.cells[k]} density="inline" /> : <span className={styles.cellEmpty}>—</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
