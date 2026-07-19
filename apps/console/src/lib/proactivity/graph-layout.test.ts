// SOURCING: vitest. Dagre's ranked layout must remain deterministic and
// topological, so a graph renderer never quietly falls back to force motion.

import { describe, expect, it } from 'vitest';
import { layoutProactivityGraph } from './graph-layout';
import type { ProactivityGraph } from './types';

const graph: ProactivityGraph = {
  nodes: [
    { id: 'source', kind: 'source', author: 'human', label: 'Source', enabled: true, resolved: {} },
    { id: 'watch', kind: 'watch', author: 'agent', label: 'Watch', enabled: true, resolved: {} },
    { id: 'judgment', kind: 'judgment', author: 'agent', label: 'Judgment', enabled: true, resolved: {} },
    { id: 'response', kind: 'response', author: 'human', label: 'Response', enabled: true, resolved: {} },
  ],
  edges: [
    { id: 'source-watch', from: 'source', to: 'watch', kind: 'evidence' },
    { id: 'watch-judgment', from: 'watch', to: 'judgment', kind: 'evaluates' },
    { id: 'judgment-response', from: 'judgment', to: 'response', kind: 'responds' },
  ],
};

describe('layoutProactivityGraph', () => {
  it('produces deterministic left-to-right ranks for directed dependencies', () => {
    const first = layoutProactivityGraph(graph);
    const second = layoutProactivityGraph(graph);
    expect(first).toEqual(second);
    const position = new Map(first.nodes.map((node) => [node.id, node.position]));
    expect(position.get('source')!.x).toBeLessThan(position.get('watch')!.x);
    expect(position.get('watch')!.x).toBeLessThan(position.get('judgment')!.x);
    expect(position.get('judgment')!.x).toBeLessThan(position.get('response')!.x);
  });
});
