import type { PlanCanvasSnapshot, PlanTask } from './plan-state';

const SHAPE_ID = 'theorem.plan-task.v1';

export interface ProgrammableGraphDefinition {
  tenant_id?: string;
  name: string;
  intent: string;
  trigger: { kind: 'coordination_stream'; stream: string };
  budget: { max_invocations: number; window_seconds: number; max_cost_microunits: number };
  approval: { mode: 'require_side_effects'; grant_ids: string[] };
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

export function planToProgrammableGraph(snapshot: PlanCanvasSnapshot): ProgrammableGraphDefinition {
  const tasks = snapshot.tasks.filter((task) => task.status !== 'superseded');
  const taskIds = new Set(tasks.map((task) => task.id));
  const dependents = new Map<string, string[]>();
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (!taskIds.has(dependency)) continue;
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), task.id]);
    }
  }
  const terminals = tasks.filter((task) => (dependents.get(task.id)?.length ?? 0) === 0);
  const nodes = tasks.map((task) => programNode(task, dependents.get(task.id) ?? []));
  nodes.push({
    id: 'plan-output',
    block_id: 'block:plan-output',
    contract: blockContract('contract:plan-output', 'Plan output', 'Materialize the completed plan output.', false),
    inputs: terminals.map((task) => ({ id: portId('from', task.id), shape_id: SHAPE_ID })),
    outputs: [],
    kind: 'sink',
    sink_id: 'tenant-graph',
    asserts: false,
  });

  const edges: Array<Record<string, unknown>> = [];
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (!taskIds.has(dependency)) continue;
      edges.push({
        id: `plan-edge:${dependency}:${task.id}`,
        from_node: dependency,
        from_port: portId('to', task.id),
        to_node: task.id,
        to_port: portId('from', dependency),
      });
    }
  }
  for (const task of terminals) {
    edges.push({
      id: `plan-edge:${task.id}:plan-output`,
      from_node: task.id,
      from_port: 'result',
      to_node: 'plan-output',
      to_port: portId('from', task.id),
    });
  }

  return {
    name: snapshot.title,
    intent: snapshot.objective,
    trigger: { kind: 'coordination_stream', stream: `plan:${snapshot.planId}` },
    budget: {
      max_invocations: Math.max(1, tasks.length * 4),
      window_seconds: 3_600,
      max_cost_microunits: Math.max(50_000, tasks.length * 10_000),
    },
    approval: { mode: 'require_side_effects', grant_ids: [] },
    nodes,
    edges,
    metadata: {
      source_register: 'plan_canvas',
      source_plan_id: snapshot.planId,
      source_schema: snapshot.schema,
    },
  };
}

function programNode(task: PlanTask, dependentIds: string[]): Record<string, unknown> {
  const destructive = task.queuedAffordances.some((affordance) => affordance.annotations.destructive);
  const base = {
    id: task.id,
    block_id: `block:plan-task:${task.alias}`,
    contract: blockContract(`contract:plan-task:${task.alias}`, task.title, task.description, destructive),
    inputs: task.dependencies.map((dependency) => ({ id: portId('from', dependency), shape_id: SHAPE_ID })),
    outputs: [
      ...dependentIds.map((dependent) => ({ id: portId('to', dependent), shape_id: SHAPE_ID })),
      ...(dependentIds.length === 0 ? [{ id: 'result', shape_id: SHAPE_ID }] : []),
    ],
  };
  if (task.kind === 'verify' || task.kind === 'review') {
    return { ...base, kind: 'verify', verifier_id: `plan:${task.kind}` };
  }
  return {
    ...base,
    kind: 'stochastic',
    affordance_id: task.queuedAffordances[0]?.ref ?? `plan-task:${task.alias}`,
  };
}

function blockContract(id: string, name: string, description: string, hasSideEffects: boolean) {
  return {
    id,
    name,
    version: '1.0.0',
    description,
    capabilities: [{
      name: 'run',
      description: `Run ${name}`,
      input_schema: { type: 'object' },
      has_side_effects: hasSideEffects,
    }],
  };
}

function portId(direction: 'from' | 'to', taskId: string): string {
  return `${direction}-${taskId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}
