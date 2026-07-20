// PG7 gate 6 (altitude coherence: sentence -> nodes -> sentence is stable) and
// gate 7 (frontier honesty: a bounded label renders explored-frontier wording
// and never says "all"). Also checks the decompile reads as sentences.

import { describe, expect, it } from 'vitest';
import { FIXTURE_TENANT, seedStandingStructure } from './fixtures';
import { ProactivityStore } from './store';
import { projectProactivityGraph } from './projection';
import { graphFromObjects } from './object-bridge';
import { decompileGraph, lineToText } from './sentences';
import { isRefusal, type ProactivityGraph } from './model';
import { setConditionParamsAction } from './node-actions';

const PG_QUERY = {
  types: ['pg.stake', 'pg.source', 'pg.watch', 'pg.judgment', 'pg.response', 'pg.assumption', 'pg.execution'],
  live: true,
} as const;

function fixtureGraph(): ProactivityGraph {
  const graph = projectProactivityGraph(FIXTURE_TENANT, seedStandingStructure());
  if (isRefusal(graph)) throw new Error('unexpected refusal');
  return graph;
}

/** Read the projected graph the store currently holds, the way the view does:
 *  through the ObjectRef seam and back. */
function graphFromStore(store: ProactivityStore): ProactivityGraph {
  const rebuilt = graphFromObjects(store.query(PG_QUERY).objects);
  return { tenant: rebuilt.tenant ?? FIXTURE_TENANT, nodes: rebuilt.nodes, edges: rebuilt.edges };
}

describe('decompileGraph', () => {
  it('every program group reads as a non-empty sentence', () => {
    const doc = decompileGraph(fixtureGraph());
    expect(doc.programs.length).toBeGreaterThan(0);
    for (const line of doc.programs) {
      const text = lineToText(line);
      expect(text.length).toBeGreaterThan(10);
      expect(text.includes(')')).toBe(true);
    }
  });

  it('is deterministic (a pure function of the nodes)', () => {
    const a = decompileGraph(fixtureGraph()).programs.map(lineToText);
    const b = decompileGraph(fixtureGraph()).programs.map(lineToText);
    expect(a).toEqual(b);
  });

  it('renders explored-frontier wording for a bounded label and never says all (gate 7)', () => {
    const doc = decompileGraph(fixtureGraph());
    const book = doc.stakes.find((line) => line.stakeId === 'pg-stake-book');
    const appeal = doc.stakes.find((line) => line.stakeId === 'pg-stake-appeal');
    expect(book?.bounded).toBe(true);
    expect(book?.assumptionSummary).toMatch(/beyond what has been explored/);
    expect(book?.assumptionSummary).not.toMatch(/\ball\b/i);
    expect(appeal?.bounded).toBe(false);
    expect(appeal?.assumptionSummary).not.toMatch(/beyond what has been explored/);
  });

  it('is stable across a sentence-to-nodes-to-sentence round trip (gate 6)', () => {
    const store = new ProactivityStore(FIXTURE_TENANT, seedStandingStructure);
    const read = () => decompileGraph(graphFromStore(store)).programs.map(lineToText);
    const original = read();
    // Edit a threshold: the sentence changes (they share one object).
    store.emit(setConditionParamsAction('pg-watch-owe', { quietDays: 9 }));
    expect(read()).not.toEqual(original);
    // Revert it: the sentence returns exactly, so the altitudes cannot drift.
    store.emit(setConditionParamsAction('pg-watch-owe', { quietDays: 3 }));
    expect(read()).toEqual(original);
  });
});
