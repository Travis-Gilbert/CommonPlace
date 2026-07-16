'use client';

/* Row 4 — the Next queue. A compact ranked list (h-40 rows): drag handle,
   status dot, title, one lane chip maximum, age right-aligned. A blocked row
   shows the amber dot and carries its reason as the dot's tooltip — no inline
   refusal sentences. Row 5 — Icebox and Done stay as collapsed disclosures.
   Drag-to-reorder writes priority (@dnd-kit); collapsibles are Radix. */

import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRight } from '@/lib/icons';
import type { OperatorTask } from '@/lib/theorem-operator';
import { isBlocked, unmetPrerequisites } from '@/lib/theorem-operator';
import { Empty, formatAge } from './parts';
import styles from './operator.module.css';

interface QueueOrderState {
  signature: string;
  order: string[];
}

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

function SortableQueueCard({
  task,
  onOpen,
  disabled,
}: {
  task: OperatorTask;
  onOpen: (taskId: string) => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <QueueCard
        task={task}
        onOpen={onOpen}
        dragging={isDragging}
        handleProps={disabled ? undefined : { ...attributes, ...listeners }}
      />
    </div>
  );
}

export function Queue({
  tasks,
  onOpen,
  onReorder,
  blockedOnly,
}: {
  tasks: readonly OperatorTask[];
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

  const nextSignature = JSON.stringify(nextFromProps.map((t) => [t.id, t.priority] as const));
  const [orderState, setOrderState] = useState<QueueOrderState>(() => ({
    signature: nextSignature,
    order: orderIdsFromSignature(nextSignature),
  }));
  const order =
    orderState.signature === nextSignature
      ? orderState.order
      : orderIdsFromSignature(nextSignature);

  const nextOrdered = useMemo(() => {
    const byId = new Map(nextFromProps.map((t) => [t.id, t]));
    const rows = order.map((id) => byId.get(id)).filter((t): t is OperatorTask => Boolean(t));
    return blockedOnly ? rows.filter(isBlocked) : rows;
  }, [order, nextFromProps, blockedOnly]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(order, oldIndex, newIndex);
    setOrderState({ signature: nextSignature, order: reordered });
    onReorder(String(active.id), newIndex);
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={nextOrdered.map((t) => t.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className={styles.qCardRow}>
                {nextOrdered.map((task) => (
                  <SortableQueueCard
                    key={task.id}
                    task={task}
                    onOpen={onOpen}
                    disabled={blockedOnly}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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

function orderIdsFromSignature(signature: string): string[] {
  return (JSON.parse(signature) as Array<readonly [string, number]>).map(([id]) => id);
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
