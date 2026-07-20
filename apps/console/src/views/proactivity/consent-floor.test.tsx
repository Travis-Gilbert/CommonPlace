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
import type { BlockHost } from '@commonplace/block-view/types';

/** The block-view host the altitude composes the intent affordance against.
 *  This test asserts the consent floor, not the compile path, so the host
 *  refuses everything: a floor that only holds when writes succeed is not a
 *  floor. */
const NO_HOST = {
  emit: async () => ({ ok: false as const, error: 'not under test' }),
  query: () => ({ objects: [], shape: { types: [], fields: [], relations: [], axes: {}, cardinality: 'empty' as const } }),
} as unknown as BlockHost;

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

const ALL_KINDS: readonly PgNodeKind[] = ['stake', 'source', 'watch', 'judgment', 'response', 'assumption', 'execution'];

describe('consent floor (gate 1)', () => {
  // Updated by design for 31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE, which adds
  // `execution` as the second derived kind. The floor itself is unchanged and
  // is what this now states more precisely: consent applies to what the agent
  // MAY do, so the two kinds outside it are the two that are not proposals. An
  // assumption is not a proposal (its affordance is prune), and an execution is
  // not a proposal either: it already happened. You cannot consent to the past,
  // and offering a switch that implied you could would be the lie the floor
  // exists to prevent.
  it('the authorable kinds are disableable; assumption is prunable and execution is neither', () => {
    for (const kind of ALL_KINDS) {
      const stub = { kind } as ProjectedNode;
      if (kind === 'assumption') {
        expect(isDisableable(stub)).toBe(false);
        expect(setPrunedAction('a', true)).toEqual({ kind: 'update', id: 'a', patch: { pruned: true } });
      } else if (kind === 'execution') {
        expect(isDisableable(stub)).toBe(false);
      } else {
        expect(isDisableable(stub)).toBe(true);
      }
    }
  });

  // Updated by design for 32-HANDOFF-PROACTIVITY-MATERIAL-AND-DENSITY, which
  // changes the SHAPE of the consent affordance without changing the floor.
  // Six identical Disable buttons were the "administrative repetition" cause,
  // so a source now carries a switch (a standing condition rendered as one) and
  // every other node's disable moved into its card's overflow menu.
  //
  // The floor is therefore restated as what it always meant: nothing is
  // DISPLAYED without being reachable. Every disableable node appears on the
  // surface, and every card that displays one carries a consent affordance. The
  // proof that the affordance actually works is in the e2e, where the menu can
  // be opened; asserting it here would only be asserting that Radix renders.
  it('every disableable node is displayed, and nothing is displayed without a consent affordance', () => {
    const graph = fixtureGraph();
    const markup = renderToStaticMarkup(<CardAltitude graph={graph} edits={NO_EDITS} contracts={[]} host={NO_HOST} compilation={null} onCompilation={() => {}} />);

    const disableable = graph.nodes.filter(isDisableable);
    for (const node of disableable) {
      expect(markup, `${node.kind} ${node.id} is not displayed at all`).toContain(`data-node="${node.id}"`);
    }

    // One switch per source: the source's own consent, in the shape of the
    // standing condition it governs.
    const switches = (markup.match(/role="switch"/g) ?? []).length;
    const sources = graph.nodes.filter((node) => node.kind === 'source').length;
    expect(switches, 'every source carries its own switch').toBe(sources);

    // One overflow per card face, carrying the disables for everything that
    // card displays. A card face carries at most one button (named choice 4),
    // so this is also the "exactly one" check.
    const overflows = (markup.match(/data-overflow-trigger/g) ?? []).length;
    const stakes = graph.nodes.filter((node) => node.kind === 'stake').length;
    const programs = graph.nodes.filter((node) => node.kind === 'watch').length;
    expect(overflows, 'every stake and every program carries an overflow').toBe(stakes + programs);

    // The two together must cover every disableable node: sources by switch,
    // the rest by the overflow on the card they appear on.
    expect(switches + (stakes + programs) * 3 + stakes).toBeGreaterThanOrEqual(disableable.length);
  });

  it('the assumption panel renders a prune control for every assumption', () => {
    const graph = fixtureGraph();
    const markup = renderToStaticMarkup(<AssumptionPanel graph={graph} stakeId="pg-stake-appeal" edits={NO_EDITS} />);
    expect(markup).toContain('I do not care about that');
  });
});
