'use client';

/* OP2 — the queue. Below the bays: Next (priority-ordered, drag-to-reorder writes
   priority), Icebox (auto-swept per protocol rule 3, collapsed by default), and
   Done (collapsed). Drag uses @hello-pangea/dnd; the collapsibles use Radix so
   the disclosure a11y is not hand-rolled. Now is rendered by the bays above. */

import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import type { OperatorTask, RegisteredHead } from '@/lib/theorem-operator';
import { TaskCard } from './TaskCard';
import { Empty } from './parts';
import styles from './operator.module.css';

export function Queue({
  tasks,
  emptyBays,
  onOpen,
  onSend,
  onReorder,
}: {
  tasks: OperatorTask[];
  emptyBays: RegisteredHead[];
  onOpen: (taskId: string) => void;
  onSend: (taskId: string, head: string) => void;
  onReorder: (taskId: string, priority: number) => void;
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
    return order.map((id) => byId.get(id)).filter((t): t is OperatorTask => Boolean(t));
  }, [order, nextFromProps]);

  function onDragEnd(result: DropResult) {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = Array.from(order);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setOrder(reordered);
    // New priority = destination index (lower is higher priority).
    onReorder(moved, result.destination.index);
  }

  return (
    <div className={styles.queue}>
      {/* Next — draggable priority queue */}
      <section aria-label="Next">
        <div className={styles.laneHead}>
          <h2 className={styles.laneTitle}>Next</h2>
          <span className={styles.laneHint}>Priority order. Drag a card to reorder — the new priority persists.</span>
        </div>
        {nextOrdered.length === 0 ? (
          <Empty>Queue empty.</Empty>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="next">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={styles.laneCol}>
                  {nextOrdered.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef as unknown as React.Ref<HTMLDivElement>}
                          {...(prov.draggableProps as React.HTMLAttributes<HTMLDivElement>)}
                          {...(prov.dragHandleProps as React.HTMLAttributes<HTMLDivElement>)}
                          className={snapshot.isDragging ? styles.dragging : undefined}
                        >
                          <TaskCard
                            task={task}
                            emptyBays={emptyBays}
                            onOpen={onOpen}
                            onSend={onSend}
                            dragHandle
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

      {/* Icebox — collapsed by default */}
      <CollapsibleLane title="Icebox" hint="Specs not decomposed within seven days (protocol rule 3)." count={icebox.length}>
        {icebox.length === 0 ? (
          <Empty>Nothing iceboxed.</Empty>
        ) : (
          <div className={styles.laneCol}>
            {icebox.map((task) => (
              <TaskCard key={task.id} task={task} onOpen={onOpen} />
            ))}
          </div>
        )}
      </CollapsibleLane>

      {/* Done — collapsed by default */}
      <CollapsibleLane title="Done" hint="Verified and shipped. Kept for lineage." count={done.length}>
        {done.length === 0 ? (
          <Empty>Nothing done yet.</Empty>
        ) : (
          <div className={styles.laneCol}>
            {done.map((task) => (
              <TaskCard key={task.id} task={task} onOpen={onOpen} />
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
