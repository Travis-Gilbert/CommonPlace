// SOURCING: none. Pure why-trace path projection for the SSE overlay. It
// reads directed graph edges only and never edits the stored graph state.

import type { ProactivityGraph } from './types';

export interface ProactiveFiring {
  readonly watch_id?: unknown;
  readonly touched_assumptions?: unknown;
}

export function firingPath(graph: ProactivityGraph, firing: ProactiveFiring): ReadonlySet<string> {
  const highlighted = new Set<string>();
  const watchId = typeof firing.watch_id === 'string' ? firing.watch_id : null;
  const assumptions = Array.isArray(firing.touched_assumptions)
    ? firing.touched_assumptions.filter((value): value is string => typeof value === 'string')
    : [];
  for (const assumption of assumptions) highlighted.add(assumption);
  if (!watchId) return highlighted;
  highlighted.add(watchId);
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const targets = outgoing.get(edge.from) ?? [];
    targets.push(edge.to);
    outgoing.set(edge.from, targets);
  }
  const queue = [watchId];
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) continue;
    for (const target of outgoing.get(source) ?? []) {
      if (highlighted.has(target)) continue;
      highlighted.add(target);
      queue.push(target);
    }
  }
  return highlighted;
}
