'use client';

/* Board — group by a status/tag relation into kanban columns. */
import type { DbViewProps } from './view-types';
import type { DbObject } from './model';
import { groupObjects } from './model';
import { RelationCell, TagChip } from './cells';
import styles from './database.module.css';

export function BoardView({ graph, objects, view, onOpen }: DbViewProps) {
  const groupBy = view.groupBy ?? view.visibleRelations.find((k) => {
    const f = graph.relations[k]?.format;
    return f === 'status' || f === 'tag';
  });
  if (!groupBy) return <div className={styles.empty}>No status or tag relation to group by.</div>;

  const groups = groupObjects(objects, groupBy);
  const chipCols = view.visibleRelations.filter((k) => k !== groupBy && graph.relations[k]).slice(0, 3);

  return (
    <div className={styles.board}>
      {groups.map((g) => (
        <section key={g.key} className={styles.boardCol}>
          <div className={styles.boardHead}>
            {g.color ? <TagChip option={{ id: g.key, name: g.label, color: g.color }} /> : <strong>{g.label}</strong>}
            <span className={styles.boardCount}>{g.objects.length}</span>
          </div>
          <div className={styles.boardStack}>
            {g.objects.map((o) => (
              <BoardCard key={o.id} object={o} cols={chipCols} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BoardCard({ object, cols, onOpen }: { object: DbObject; cols: readonly string[]; onOpen: (id: string) => void }) {
  return (
    <button type="button" className={styles.boardCard} onClick={() => onOpen(object.id)}>
      <span className={styles.cardTitle}>{object.title}</span>
      {cols.filter((k) => object.cells[k]).map((k) => (
        <RelationCell key={k} cell={object.cells[k]} density="chip" />
      ))}
    </button>
  );
}
