/**
 * Clew click-to-path adapted to Plan DAGs.
 *
 * Selecting a task illuminates its ancestor chain (what this task waits on)
 * and its descendant chain (what waits on it). Geometry only: no UI chrome.
 */

export type PlanPathTopology = {
  ancestorIds: ReadonlySet<string>;
  descendantIds: ReadonlySet<string>;
  pathNodeIds: ReadonlySet<string>;
  pathEdgeIds: ReadonlySet<string>;
};

export type PlanPathTask = {
  id: string;
  dependencies: readonly string[];
};

export function computePlanPath(
  tasks: readonly PlanPathTask[],
  selectedTaskId: string | null,
): PlanPathTopology {
  const empty = {
    ancestorIds: new Set<string>(),
    descendantIds: new Set<string>(),
    pathNodeIds: new Set<string>(),
    pathEdgeIds: new Set<string>(),
  };
  if (!selectedTaskId) return empty;

  const byId = new Map(tasks.map((task) => [task.id, task]));
  if (!byId.has(selectedTaskId)) return empty;

  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  for (const task of tasks) {
    parentsByChild.set(task.id, []);
    childrenByParent.set(task.id, []);
  }
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (!byId.has(dependency)) continue;
      parentsByChild.get(task.id)!.push(dependency);
      childrenByParent.get(dependency)!.push(task.id);
    }
  }

  const ancestorIds = walk(parentsByChild, selectedTaskId);
  const descendantIds = walk(childrenByParent, selectedTaskId);
  const pathNodeIds = new Set<string>([...ancestorIds, selectedTaskId, ...descendantIds]);

  const pathEdgeIds = new Set<string>();
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (pathNodeIds.has(dependency) && pathNodeIds.has(task.id)) {
        pathEdgeIds.add(`dependency:${dependency}:${task.id}`);
      }
    }
  }

  return { ancestorIds, descendantIds, pathNodeIds, pathEdgeIds };
}

function walk(adjacency: Map<string, string[]>, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(adjacency.get(start) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }
  return seen;
}
