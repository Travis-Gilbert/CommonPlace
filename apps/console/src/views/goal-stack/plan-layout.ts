// SOURCING: @dagrejs/dagre for left-to-right DAG coordinates and @xyflow/react for the
// canvas projection. The canonical graph remains the Harness Plan substrate.

import type { Edge, Node } from '@xyflow/react';
import { Graph, layout } from '@dagrejs/dagre';
import type {
  PlanCanvasSnapshot,
  PlanTask,
  PlanTaskStatus,
} from '@commonplace/theorem-acp/plan-state';

export type GoalEdgeState = 'pending' | 'claimed' | 'running' | 'verified' | 'blocked' | 'failed' | 'superseded';

export interface GoalEdgeData extends Record<string, unknown> {
  progress: number;
  state: GoalEdgeState;
  relation: 'dependency' | 'supersedes';
}

export interface GoalNodeData extends Record<string, unknown> {
  task: PlanTask;
}

export type GoalFlowNode = Node<GoalNodeData, 'goalTask'>;
export type GoalFlowEdge = Edge<GoalEdgeData, 'goalProgress'>;

const NODE_WIDTH = 232;
const NODE_HEIGHT = 104;

export async function layoutGoalPlan(
  snapshot: PlanCanvasSnapshot,
  hideSuperseded: boolean,
): Promise<{ nodes: GoalFlowNode[]; edges: GoalFlowEdge[] }> {
  const tasks = hideSuperseded
    ? snapshot.tasks.filter((task) => task.status !== 'superseded')
    : snapshot.tasks;
  const visible = new Set(tasks.map((task) => task.id));
  const edgePairs = tasks.flatMap((task) => [
    ...task.dependencies
      .filter((source) => visible.has(source))
      .map((source) => ({ source, target: task.id, relation: 'dependency' as const })),
    ...task.supersedes
      .filter((source) => visible.has(source))
      .map((source) => ({ source, target: task.id, relation: 'supersedes' as const })),
  ]);
  const graph = new Graph()
    .setGraph({ rankdir: 'LR', nodesep: 32, edgesep: 16, ranksep: 80, marginx: 16, marginy: 16 })
    .setDefaultEdgeLabel(() => ({}));
  tasks.forEach((task) => graph.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edgePairs.forEach((edge) => graph.setEdge(edge.source, edge.target));
  layout(graph);
  const positions = new Map(
    tasks.map((task) => {
      const node = graph.node(task.id);
      return [task.id, {
        x: (node?.x ?? NODE_WIDTH / 2) - NODE_WIDTH / 2,
        y: (node?.y ?? NODE_HEIGHT / 2) - NODE_HEIGHT / 2,
      }] as const;
    }),
  );
  return {
    nodes: tasks.map((task) => ({
      id: task.id,
      type: 'goalTask',
      position: positions.get(task.id) ?? { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      draggable: false,
      connectable: false,
      data: { task },
    })),
    edges: edgePairs.map((edge) => {
      const task = tasks.find((candidate) => candidate.id === edge.target);
      const state = edge.relation === 'supersedes'
        ? 'superseded'
        : edgeState(task?.status ?? 'pending');
      return {
        id: `${edge.relation}:${edge.source}:${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'goalProgress',
        data: {
          progress: edgeProgress(edge.relation === 'supersedes' ? 'superseded' : task?.status ?? 'pending'),
          state,
          relation: edge.relation,
        },
      };
    }),
  };
}

export function edgeProgress(status: PlanTaskStatus): number {
  if (status === 'claimed') return 0.18;
  if (status === 'running') return 0.58;
  if (status === 'patch_proposed') return 0.76;
  if (status === 'verifying') return 0.88;
  if (status === 'verified' || status === 'failed' || status === 'superseded') return 1;
  if (status === 'blocked') return 1;
  return 0;
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
