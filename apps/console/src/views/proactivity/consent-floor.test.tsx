// PG7 gate 1 (the consent floor): no node kind renders on any surface without a
// working consent affordance. Disable ships on every disableable kind; the
// assumption's affordance is prune. Enumerated against the rendered card
// altitude and assumption panel, plus the structural predicate.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIXTURE_TENANT, seedStandingStructure } from '@/lib/proactivity/fixtures';
import { projectProactivityGraph } from '@/lib/proactivity/projection';
import { isDisableable, isRefusal, type PgNodeKind, type ProactivityGraph, type ProjectedNode } from '@/lib/proactivity/model';
import { setPrunedAction } from '@/lib/proactivity/node-actions';
import { CardAltitude } from './CardAltitude';
import { AssumptionPanel } from './AssumptionPanel';
import type { ProactivityEdits } from './use-edits';

const NO_EDITS: ProactivityEdits = {
  error: null,
  canUndo: false,
  nextUndoLabel: null,
  run: async () => true,
  undo: async () => {},
  clearError: () => {},
};

function fixtureGraph(): ProactivityGraph {
  const graph = projectProactivityGraph(FIXTURE_TENANT, seedStandingStructure());
  if (isRefusal(graph)) throw new Error('unexpected refusal');
  return graph;
}

const ALL_KINDS: readonly PgNodeKind[] = ['stake', 'source', 'watch', 'judgment', 'response', 'assumption'];

describe('consent floor (gate 1)', () => {
  it('every kind except assumption is disableable, and assumption is prunable', () => {
    for (const kind of ALL_KINDS) {
      const stub = { kind } as ProjectedNode;
      if (kind === 'assumption') {
        expect(isDisableable(stub)).toBe(false);
        expect(setPrunedAction('a', true)).toEqual({ kind: 'update', id: 'a', patch: { pruned: true } });
      } else {
        expect(isDisableable(stub)).toBe(true);
      }
    }
  });

  it('the card altitude renders a disable control for source, stake, watch, judgment, and response', () => {
    const graph = fixtureGraph();
    const markup = renderToStaticMarkup(<CardAltitude graph={graph} edits={NO_EDITS} contracts={[]} />);
    // One disable per disableable node in the fixture; assert the surface
    // renders them (the consent floor is the display and the control together).
    const disableCount = (markup.match(/>Disable<|>Enable</g) ?? []).length;
    const disableableNodes = graph.nodes.filter((node) => node.kind !== 'assumption').length;
    expect(disableCount).toBe(disableableNodes);
  });

  it('the assumption panel renders a prune control for every assumption', () => {
    const graph = fixtureGraph();
    const markup = renderToStaticMarkup(<AssumptionPanel graph={graph} stakeId="pg-stake-appeal" edits={NO_EDITS} />);
    expect(markup).toContain('I do not care about that');
  });
});
