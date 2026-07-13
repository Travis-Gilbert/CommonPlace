'use client';

/* SPEC-OBJECT-CONTRACT-V2 OC5 — the Operator's concrete BlockHost.
 *
 * It serves two shapes from the live operator state: the arrangement
 * (surface/region/view-instance ObjectRefs) so SurfaceRenderer can walk it, and
 * one lightweight ObjectSet per view-instance query so the interpreter resolves
 * a renderer and knows the set is non-empty. The renderers cast `host` to
 * OperatorHost and read the typed slices + callbacks directly — the same seam
 * MemoryBlockHost uses for the database Set. `emit` keeps views from widening
 * actions: `open` routes to the Room Panel, everything else is accepted intent. */

import type {
  BlockHost,
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  ObjectShape,
  Result,
  ThemeTokens,
  ViewDescriptor,
} from '@/lib/block-view/types';
import type { Bay, OperatorTask } from '@/lib/theorem-operator';

export interface AttentionCounts {
  readonly awaitingYou: number;
  readonly blocked: number;
  readonly newAtGate: number;
}

export interface OperatorCallbacks {
  openRoom(taskId: string): void;
  reorder(taskId: string, priority: number): void;
  toggleBlockedOnly(): void;
  openGate(): void;
  scrollToBays(): void;
}

export interface OperatorHost extends BlockHost {
  readonly attention: AttentionCounts;
  readonly bays: readonly Bay[];
  readonly tasks: readonly OperatorTask[];
  readonly urgentFromHeads: Set<string>;
  readonly blockedOnly: boolean;
  readonly callbacks: OperatorCallbacks;
}

const LAYOUT_TYPES = new Set(['surface', 'region', 'view-instance']);

const OPERATOR_TOKENS: ThemeTokens = {
  color: { ground: 'var(--g0)', ink: 'var(--ink)', accent: 'var(--accent)' },
  space: { u: 'var(--u)' },
  typography: { body: 'var(--font-body)', display: 'var(--font-display)' },
  radius: { band: 'var(--r-band)' },
};

function descriptor(id: string, name: string): ViewDescriptor {
  return {
    id,
    name,
    renderer: id,
    accepts: { cardinality: 'any' },
    emits: ['open', 'update'],
    source: { package: 'commonplace', component: id, mode: 'wrap', regime: 'css-vars' },
    render: (() => null) as unknown as ViewDescriptor['render'],
  };
}

const OPERATOR_DESCRIPTORS: readonly ViewDescriptor[] = [
  descriptor('operator-attention', 'Attention'),
  descriptor('operator-bays', 'Bays'),
  descriptor('operator-bay-table', 'Bays (table)'),
  descriptor('operator-queue', 'Queue'),
];

const NOOP_UNSUB = () => {};

export class OperatorBlockHost implements OperatorHost {
  readonly tokens = OPERATOR_TOKENS;

  constructor(
    private readonly surfaceObjects: readonly ObjectRef[],
    readonly attention: AttentionCounts,
    readonly bays: readonly Bay[],
    readonly tasks: readonly OperatorTask[],
    readonly urgentFromHeads: Set<string>,
    readonly blockedOnly: boolean,
    readonly callbacks: OperatorCallbacks,
  ) {}

  private toSet(objects: readonly ObjectRef[], types: readonly string[]): ObjectSet {
    return {
      objects,
      shape: {
        types: [...types],
        fields: [],
        relations: [],
        axes: {},
        cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
      },
      subscribe: () => NOOP_UNSUB,
    };
  }

  query(q: ObjectQuery): ObjectSet {
    if (q.types.some((t) => LAYOUT_TYPES.has(t))) {
      return this.toSet(this.surfaceObjects, q.types);
    }
    if (q.types.includes('operator-attention')) {
      // Always one object so the strip renders (it hides itself at zero counts).
      return this.toSet([{ id: 'attention', type: 'operator-attention', properties: {} }], q.types);
    }
    if (q.types.includes('operator-bay')) {
      return this.toSet(
        this.bays.map((bay) => ({ id: bay.head, type: 'operator-bay', properties: { label: bay.label } })),
        q.types,
      );
    }
    if (q.types.includes('operator-queue')) {
      return this.toSet(
        this.tasks.map((task) => ({ id: task.id, type: 'operator-queue', properties: {} })),
        q.types,
      );
    }
    return this.toSet([], q.types);
  }

  emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    if (action.kind === 'open') this.callbacks.openRoom(action.id);
    return Promise.resolve({
      ok: true,
      value: { action_kind: action.kind, status: 'accepted' },
    });
  }

  viewsFor(_shape: ObjectShape): readonly ViewDescriptor[] {
    return OPERATOR_DESCRIPTORS;
  }
}
