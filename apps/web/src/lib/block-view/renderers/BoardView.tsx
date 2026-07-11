"use client";

/* Board — objects grouped into columns by a status/tag relation. Dragging a card
   between columns emits an `update` action through the host (real mutation of the
   object model), so the change persists and every other view reflects it. */

import type { HTMLAttributes } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import styles from "../database.module.css";
import { groupObjects } from "../database/model";
import { RelationCell } from "./cells";
import type { ViewProps } from "./types";

export function BoardView({ objects, view, host, onOpen }: ViewProps) {
  const groupKey = view.groupBy;
  if (!groupKey) return <div className={styles.emptyState}>This view has no group-by relation.</div>;
  const groups = groupObjects(objects, groupKey);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const optionId = r.destination.droppableId;
    void host.emit({ kind: "update", id: r.draggableId, patch: { [groupKey]: optionId === "∅" ? [] : [optionId] } });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={styles.board}>
        {groups.map((g) => (
          <Droppable droppableId={g.key} key={g.key}>
            {(prov) => (
              <div className={styles.col} ref={prov.innerRef} {...prov.droppableProps}>
                <div className={styles.colHead}>
                  {g.color && <span className={styles.colDot} style={{ background: `var(--tag-${g.color})` }} />}
                  <span className={styles.colName}>{g.label}</span>
                  <span className={styles.colCount}>{g.objects.length}</span>
                </div>
                {g.objects.map((o, i) => (
                  <Draggable draggableId={o.id} index={i} key={o.id}>
                    {(dp, snap) => {
                      const dragProps = { ...dp.draggableProps, ...dp.dragHandleProps } as HTMLAttributes<HTMLDivElement>;
                      return (
                      <div
                        ref={dp.innerRef}
                        {...dragProps}
                        className={`${styles.boardCard} ${snap.isDragging ? styles.boardDragging : ""}`}
                        onClick={() => onOpen(o.id)}
                      >
                        <div className={styles.boardCardTitle}>{o.title}</div>
                        {view.visibleRelations
                          .filter((k) => k !== groupKey)
                          .slice(0, 3)
                          .map((k) => {
                            const cell = o.cells[k];
                            if (!cell || cell.empty) return null;
                            return <RelationCell key={k} cell={cell} />;
                          })}
                      </div>
                      );
                    }}
                  </Draggable>
                ))}
                {prov.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
