"use client";

/* Gallery — cover + title + the view's visible relations stacked. This is the
   plant/movie card from the Anytype screenshots, rendered from resolved cells. */

import styles from "../database.module.css";
import { RelationCell } from "./cells";
import type { ViewProps } from "./types";

export function GalleryView({ objects, view, onOpen }: ViewProps) {
  if (!objects.length) return <div className={styles.emptyState}>Nothing here yet.</div>;
  return (
    <div className={styles.gallery}>
      {objects.map((o) => (
        <button key={o.id} className={styles.card} onClick={() => onOpen(o.id)}>
          {o.cover ? (
            <img className={styles.cardCover} src={o.cover.url} alt="" loading="lazy" />
          ) : (
            <div className={styles.cardCoverEmpty}>{o.emoji ?? "○"}</div>
          )}
          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>{o.title}</div>
            <div className={styles.cardFields}>
              {view.visibleRelations.map((k) => {
                const cell = o.cells[k];
                if (!cell || cell.empty) return null;
                return (
                  <div key={k} className={styles.cardFieldVal}>
                    <RelationCell cell={cell} />
                  </div>
                );
              })}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
