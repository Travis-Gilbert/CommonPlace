'use client';

/* Row 4 — the Next queue. A compact ranked list (h-40 rows): drag handle,
   status dot, title, one lane chip maximum, age right-aligned. A blocked row
   shows the amber dot and carries its reason as the dot's tooltip — no inline
   refusal sentences. Row 5 — Icebox and Done stay as collapsed disclosures.
   Drag-to-reorder writes priority (@hello-pangea/dnd); collapsibles are Radix. */

import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import type { OperatorTask } from '@/lib/theorem-operator';
import { isBlocked, unmetPrerequisites } from '@/lib/theorem-operator';
import { Empty, formatAge } from './parts';
import styles from './operator.module.css';

function QueueCard({
  task,
  onOpen,
  handleProps,
  dragging,
}: {
  task: OperatorTask;
  onOpen: (taskId: string) => void;
  handleProps?: React.HTMLAttributes<HTMLElement>;
  dragging?: boolean;
}) {
  const blocked = isBlocked(task);
  const reason = blocked
    ? `needs ${unmetPrerequisites(task)
        .map((p) => `"${p.goal}"`)
        .join(', ')}`
    : undefined;
  const done = task.status === 'done';

  return (
    <div className={styles.qCard} data-dragging={dragging || undefined}>
      <div className={styles.qCardTop}>
        <span
          className={styles.qDot}
          data-urgency={blocked ? 'waiting' : undefined}
          data-status={done ? 'done' : undefined}
          title={reason}
        />
        {handleProps && (
          <span className={styles.grip} {...handleProps} aria-hidden="true" title="Drag to reorder priority">
            ⋮⋮
          </span>
        )}
        <span className={styles.qAge}>{formatAge(task.ageMs)}</span>
      </div>
      <button className={styles.qCardFace} onClick={() => onOpen(task.id)} title={reason ?? 'Open room'}>
        <span className={styles.qCardTitle}>{task.goal}</span>
      </button>
      {task.laneChip && <span className={styles.qChip}>{task.laneChip}</span>}
    </div>
  );
}

export function Queue({
  tasks,
  onOpen,
  onReorder,
  blockedOnly,
}: {
  tasks: OperatorTask[];
  onOpen: (taskId: string) => void;
  onReorder: (taskId: string, priority: number) => void;
  /** Attention-strip filter: show only blocked rows in Next. */
  blockedOnly?: boolean;
}) {
  const nextFromProps = useMemo(
    () => tasks.filter((t) => t.lane === 'next').sort((a, b) => a.priority - b.priority),
    [tasks],
  );
  const icebox = useMemo(() => tasks.filter((t) => t.lane === 'icebox'), [tasks]);
  const done = useMemo(
    () => tasks.filter((t) => t.lane === 'done').sort((a, b) => a.ageMs - b.ageMs),
    [tasks],
  );

  // Optimistic local order for the Next lane so a drag reorders immediately;
  // the reorder action persists the new priority to the substrate.
  const [order, setOrder] = useState<string[]>(nextFromProps.map((t) => t.id));
  useEffect(() => {
    setOrder(nextFromProps.map((t) => t.id));
  }, [nextFromProps]);

  const nextOrdered = useMemo(() => {
    const byId = new Map(nextFromProps.map((t) => [t.id, t]));
    const rows = order.map((id) => byId.get(id)).filter((t): t is OperatorTask => Boolean(t));
    return blockedOnly ? rows.filter(isBlocked) : rows;
  }, [order, nextFromProps, blockedOnly]);

  function onDragEnd(result: DropResult) {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = Array.from(order);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setOrder(reordered);
    onReorder(moved, result.destination.index);
  }

  return (
    <div className={styles.queue} id="operator-queue">
      <section aria-label="Next">
        <div className={styles.laneHead}>
          <h2 className={styles.laneTitle}>Next</h2>
          {blockedOnly && <span className={styles.laneHint}>blocked only — clear via the strip</span>}
        </div>
        {nextOrdered.length === 0 ? (
          <Empty>{blockedOnly ? 'Nothing blocked.' : 'Queue empty.'}</Empty>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="next" direction="horizontal">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={styles.qCardRow}>
                  {nextOrdered.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={blockedOnly}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef as unknown as React.Ref<HTMLDivElement>}
                          {...(prov.draggableProps as React.HTMLAttributes<HTMLDivElement>)}
                        >
                          <QueueCard
                            task={task}
                            onOpen={onOpen}
                            dragging={snapshot.isDragging}
                            handleProps={(prov.dragHandleProps as React.HTMLAttributes<HTMLElement>) ?? undefined}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </section>

      <CollapsibleLane title="Icebox" hint="Specs not decomposed within seven days (protocol rule 3)." count={icebox.length}>
        {icebox.length === 0 ? (
          <Empty>Nothing iceboxed.</Empty>
        ) : (
          <div className={styles.qCardGrid}>
            {icebox.map((task) => (
              <QueueCard key={task.id} task={task} onOpen={onOpen} />
            ))}
          </div>
        )}
      </CollapsibleLane>

      <CollapsibleLane title="Done" hint="Verified and shipped. Kept for lineage." count={done.length}>
        {done.length === 0 ? (
          <Empty>Nothing done yet.</Empty>
        ) : (
          <div className={styles.qCardGrid}>
            {done.map((task) => (
              <QueueCard key={task.id} task={task} onOpen={onOpen} />
            ))}
          </div>
        )}
      </CollapsibleLane>
    </div>
  );
}

function CollapsibleLane({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={styles.collapsible}>
      <Collapsible.Trigger className={styles.collapsibleTrigger}>
        <ChevronRight className={styles.chevron} data-open={open || undefined} />
        <span className={styles.laneTitle}>{title}</span>
        <span className={styles.laneCount}>{count}</span>
        <span className={styles.laneHint}>{hint}</span>
      </Collapsible.Trigger>
      <Collapsible.Content className={styles.collapsibleContent}>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
