"use client";

/* List — one compact row per object: glyph + title, then its visible relations
   inline. The densest read of the same object set. */

import styles from "../database.module.css";
import { ObjectGlyph, RelationCell } from "./cells";
import type { ViewProps } from "./types";

export function ListView({ objects, view, onOpen }: ViewProps) {
  if (!objects.length) return <div className={styles.emptyState}>Nothing here yet.</div>;
  return (
    <div className={styles.list}>
      {objects.map((o) => (
        <button key={o.id} className={styles.listRow} onClick={() => onOpen(o.id)}>
          <span className={styles.listTitle}>
            <ObjectGlyph object={o} />
            {o.title}
          </span>
          <span className={styles.listChips}>
            {view.visibleRelations.map((k) => {
              const cell = o.cells[k];
              if (!cell || cell.empty) return null;
              return <RelationCell key={k} cell={cell} />;
            })}
          </span>
        </button>
      ))}
    </div>
  );
}
