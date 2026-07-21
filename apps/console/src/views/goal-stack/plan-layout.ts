// SOURCING: @dagrejs/dagre for left-to-right DAG coordinates and @xyflow/react for the
// canvas projection. The canonical graph remains the Harness Plan substrate.
// Clew click-to-path illumination is applied after layout via plan-path.

import type { Edge, Node } from '@xyflow/react';
import { Graph, layout } from '@dagrejs/dagre';
import {
  reportedEdgeProgress,
  type PlanCanvasSnapshot,
  type PlanTask,
  type PlanTaskStatus,
} from '@commonplace/theorem-acp/plan-state';
import { computePlanPath } from '@commonplace/theorem-acp/plan-path';

export type GoalEdgeState = 'pending' | 'claimed' | 'running' | 'verified' | 'blocked' | 'failed' | 'superseded';

export interface GoalEdgeData extends Record<string, unknown> {
  progress: number;
  state: GoalEdgeState;
  relation: 'dependency' | 'supersedes';
  onPath: boolean;
}

export interface GoalNodeData extends Record<string, unknown> {
  task: PlanTask;
  onPath: boolean;
  pathRole: 'selected' | 'ancestor' | 'descendant' | 'idle';
}

export type GoalFlowNode = Node<GoalNodeData, 'goalTask'>;
export type GoalFlowEdge = Edge<GoalEdgeData, 'goalProgress'>;

const NODE_WIDTH = 248;
const NODE_HEIGHT = 120;
const BRANCH_Y_OFFSET = 72;

export async function layoutGoalPlan(
  snapshot: PlanCanvasSnapshot,
  hideSuperseded: boolean,
  selectedTaskId: string | null = null,
  pinnedOverrides: ReadonlyMap<string, { x: number; y: number }> = new Map(),
): Promise<{ nodes: GoalFlowNode[]; edges: GoalFlowEdge[] }> {
  const tasks = hideSuperseded
    ? snapshot.tasks.filter((task) => task.status !== 'superseded')
    : snapshot.tasks;
  const visible = new Set(tasks.map((task) => task.id));
  const path = computePlanPath(tasks, selectedTaskId);
  const edgePairs = tasks.flatMap((task) => [
    ...task.dependencies
      .filter((source) => visible.has(source))
      .map((source) => ({ source, target: task.id, relation: 'dependency' as const })),
    ...task.supersedes
      .filter((source) => visible.has(source))
      .map((source) => ({ source, target: task.id, relation: 'supersedes' as const })),
  ]);

  const graph = new Graph()
    .setGraph({
      rankdir: 'LR',
      nodesep: 32,
      edgesep: 16,
      ranksep: 80,
      marginx: 16,
      marginy: 16,
    })
    .setDefaultEdgeLabel(() => ({}));
  tasks.forEach((task) => graph.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edgePairs.forEach((edge) => graph.setEdge(edge.source, edge.target));

  // Deterministic under the plan seed: dagre is already deterministic for a
  // fixed topology; the seed is retained on the snapshot for substrate parity.
  void snapshot.seed;
  layout(graph);

  const positions = new Map(
    tasks.map((task) => {
      const override = pinnedOverrides.get(task.id) ?? task.position;
      if (override) return [task.id, { x: override.x, y: override.y }] as const;
      const node = graph.node(task.id);
      const baseY = (node?.y ?? NODE_HEIGHT / 2) - NODE_HEIGHT / 2;
      return [task.id, {
        x: (node?.x ?? NODE_WIDTH / 2) - NODE_WIDTH / 2,
        y: task.branch ? baseY + BRANCH_Y_OFFSET : baseY,
      }] as const;
    }),
  );

  const illuminate = selectedTaskId !== null && path.pathNodeIds.size > 0;

  return {
    nodes: tasks.map((task) => {
      const onPath = !illuminate || path.pathNodeIds.has(task.id);
      const pathRole = !illuminate
        ? 'idle'
        : task.id === selectedTaskId
          ? 'selected'
          : path.ancestorIds.has(task.id)
            ? 'ancestor'
            : path.descendantIds.has(task.id)
              ? 'descendant'
              : 'idle';
      return {
        id: task.id,
        type: 'goalTask',
        position: positions.get(task.id) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        draggable: true,
        connectable: false,
        data: { task, onPath, pathRole },
        style: illuminate && !onPath ? { opacity: 0.28 } : undefined,
      };
    }),
    edges: edgePairs.map((edge) => {
      const task = tasks.find((candidate) => candidate.id === edge.target);
      const state = edge.relation === 'supersedes'
        ? 'superseded'
        : edgeState(task?.status ?? 'pending');
      const edgeId = `${edge.relation}:${edge.source}:${edge.target}`;
      const onPath = !illuminate || path.pathEdgeIds.has(edgeId) || (
        edge.relation === 'dependency'
        && path.pathNodeIds.has(edge.source)
        && path.pathNodeIds.has(edge.target)
      );
      return {
        id: edgeId,
        source: edge.source,
        target: edge.target,
        type: 'goalProgress',
        data: {
          progress: edge.relation === 'supersedes'
            ? 1
            : reportedEdgeProgress(task ?? { status: 'pending', progressFraction: null }),
          state,
          relation: edge.relation,
          onPath,
        },
        style: illuminate && !onPath ? { opacity: 0.22 } : undefined,
      };
    }),
  };
}

/** @deprecated Prefer reportedEdgeProgress; kept for older tests that assert terminals. */
export function edgeProgress(status: PlanTaskStatus): number {
  return reportedEdgeProgress({ status, progressFraction: null });
}

function edgeState(status: PlanTaskStatus): GoalEdgeState {
  if (status === 'claimed') return 'claimed';
  if (status === 'running' || status === 'patch_proposed' || status === 'verifying') return 'running';
  if (status === 'verified') return 'verified';
  if (status === 'failed') return 'failed';
  if (status === 'blocked') return 'blocked';
  if (status === 'superseded') return 'superseded';
  return 'pending';
}
