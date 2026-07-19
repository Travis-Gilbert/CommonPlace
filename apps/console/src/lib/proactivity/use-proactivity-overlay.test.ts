// SOURCING: vitest. A firing highlights only its why-trace, never every node
// in the graph and never unrelated tenant-shaped identifiers.

import { describe, expect, it } from 'vitest';
import { firingPath } from './use-proactivity-overlay';

const graph = {
  nodes: [
    { id: 'assumption:deadline', kind: 'assumption', author: 'agent', label: 'deadline', enabled: true, resolved: {} },
    { id: 'watch:deadline', kind: 'watch', author: 'agent', label: 'watch', enabled: true, resolved: {} },
    { id: 'judgment:risk', kind: 'judgment', author: 'agent', label: 'risk', enabled: true, resolved: {} },
    { id: 'response:draft', kind: 'response', author: 'human', label: 'draft', enabled: true, resolved: {} },
    { id: 'watch:unrelated', kind: 'watch', author: 'agent', label: 'unrelated', enabled: true, resolved: {} },
  ] as const,
  edges: [
    { id: 'one', from: 'watch:deadline', to: 'judgment:risk', kind: 'evaluates' },
    { id: 'two', from: 'judgment:risk', to: 'response:draft', kind: 'responds' },
  ] as const,
};

describe('proactivity why-trace overlay', () => {
  it('lights touched assumptions through the directed response path only', () => {
    expect([...firingPath(graph, {
      watch_id: 'watch:deadline',
      touched_assumptions: ['assumption:deadline'],
    })]).toEqual([
      'assumption:deadline',
      'watch:deadline',
      'judgment:risk',
      'response:draft',
    ]);
  });

  it('does not infer a graph path from malformed event data', () => {
    expect([...firingPath(graph, { watch_id: 1, touched_assumptions: ['assumption:deadline', 2] })])
      .toEqual(['assumption:deadline']);
  });
});
