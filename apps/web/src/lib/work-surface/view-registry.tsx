'use client';

/**
 * TW5 client view registry.
 *
 * The switchable renderers (table, board, and later canvas and graph) are React
 * components, so their `ViewDescriptor.render` is client-side by nature: a
 * render function cannot cross the `/objects/views` JSON wire. This registry is
 * the client source of truth for those descriptors. Each carries the
 * SPEC-OBJECT-CONTRACT-V2 `accepts`/`emits` contract (so the flip only ever
 * offers renderers that accept the current shape, and a renderer may only fire
 * its declared ActionKinds) plus the real render component, adapted to the
 * `ViewRenderProps { set, host }` shape.
 *
 * `matchingViews(shape)` filters via the documented ObjectShapeMatch interpreter
 * (`matchesShape`). Additional descriptors (canvas, graph) register here as
 * their record-shape adapters land (see docs/plans/twenty-recon).
 */

import type {
  ActionKind,
  ObjectShape,
  ViewDescriptor,
  ViewRenderProps,
} from '@/lib/block-view/types';
import { matchesShape } from './shape-match';
import { RecordTable } from '@/components/v2/record-table';
import { KanbanBoard } from '@/components/v2/kanban';
import { PathGraphView } from '@/components/v2/path/PathGraphView';

// Declared ActionKinds each renderer is allowed to emit (provenance contract).
const TABLE_EMITS: readonly ActionKind[] = ['update', 'select', 'open', 'delete'];
const BOARD_EMITS: readonly ActionKind[] = ['update', 'create'];
const PATH_EMITS: readonly ActionKind[] = ['select', 'open'];

function TableRender({ set, host }: ViewRenderProps) {
  return <RecordTable objectSet={set} host={host} />;
}

function BoardRender({ set, host }: ViewRenderProps) {
  return <KanbanBoard objectSet={set} host={host} />;
}

function PathRender({ set, host }: ViewRenderProps) {
  return <PathGraphView set={set} host={host} />;
}

const TABLE_VIEW: ViewDescriptor = {
  id: 'table',
  name: 'Table',
  // A table renders any set; no shape precondition.
  accepts: {},
  emits: TABLE_EMITS,
  renderer: 'table',
  source: {
    package: '@/components/v2/record-table',
    component: 'RecordTable',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'Clean-room TW2 record grid on the Theorem object contract.',
  },
  render: TableRender,
};

const BOARD_VIEW: ViewDescriptor = {
  id: 'board',
  name: 'Board',
  // A board can group any set by one of its fields; no shape precondition.
  accepts: {},
  emits: BOARD_EMITS,
  renderer: 'board',
  source: {
    package: '@/components/v2/kanban',
    component: 'KanbanBoard',
    mode: 'bespoke',
    regime: 'css-vars',
    allowedBespokeReason: 'Clean-room TW3 kanban on the Theorem object contract.',
  },
  render: BoardRender,
};

/** PL2 Path lens: any relation-bearing ObjectSet inherits Path via views_for(shape). */
const PATH_VIEW: ViewDescriptor = {
  id: 'path',
  name: 'Path',
  accepts: { requires_relation: true },
  emits: PATH_EMITS,
  renderer: 'path',
  source: {
    package: '@/components/v2/path/PathGraphView',
    component: 'PathGraphView',
    mode: 'bespoke',
    regime: 'scene',
    allowedBespokeReason:
      'HANDOFF-CANON Path lens over @cosmos.gl/graph; Clew interaction on Theorem substrate.',
  },
  render: PathRender,
};

/** All client-side record renderers, in switcher order. */
export const V2_VIEW_REGISTRY: readonly ViewDescriptor[] = [TABLE_VIEW, BOARD_VIEW, PATH_VIEW];

/** The registry views whose `accepts` clause matches the given shape, in order. */
export function matchingViews(shape: ObjectShape): readonly ViewDescriptor[] {
  return V2_VIEW_REGISTRY.filter((view) => matchesShape(view.accepts, shape));
}

/** Look up a registered view by id. */
export function viewById(id: string): ViewDescriptor | undefined {
  return V2_VIEW_REGISTRY.find((view) => view.id === id);
}
