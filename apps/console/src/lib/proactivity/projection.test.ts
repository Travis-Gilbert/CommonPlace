// PG1 acceptance: the standing-graph read model, validated against the fixture.

import { describe, expect, it } from 'vitest';
import { FIXTURE_TENANT, seedStandingStructure } from './fixtures';
import { projectProactivityGraph } from './projection';
import { isRefusal, isResponse, type ProjectedNode } from './model';

function projectFixture() {
  const result = projectProactivityGraph(FIXTURE_TENANT, seedStandingStructure());
  if (isRefusal(result)) throw new Error('fixture projection unexpectedly refused');
  return result;
}

function nodesOfKind<K extends ProjectedNode['kind']>(kind: K) {
  return projectFixture().nodes.filter((node): node is Extract<ProjectedNode, { kind: K }> => node.kind === kind);
}

describe('projectProactivityGraph', () => {
  it('projects all seven node kinds', () => {
    const graph = projectFixture();
    const kinds = new Set(graph.nodes.map((node) => node.kind));
    // The five authorable kinds plus the two derived ones: assumption, and
    // execution (a firing, projected as a commit on the agent lane).
    expect(kinds).toEqual(new Set(['stake', 'source', 'watch', 'judgment', 'response', 'assumption', 'execution']));
  });

  it('derives correct edges including the two-sided convergence at a watch', () => {
    const graph = projectFixture();
    // rests_on: every assumption points at its stake.
    const restsOn = graph.edges.filter((edge) => edge.kind === 'rests_on');
    expect(restsOn.length).toBeGreaterThan(0);
    expect(restsOn.every((edge) => edge.to.startsWith('pg-stake-'))).toBe(true);

    // The join: the derived appeal watch has BOTH a feeds edge (from a source)
    // and a declares edge (from its stake). This is what makes it not a pipe.
    const intoAppealWatch = graph.edges.filter((edge) => edge.to === 'pg-watch-appeal');
    expect(intoAppealWatch.some((edge) => edge.kind === 'feeds' && edge.from === 'pg-source-email')).toBe(true);
    expect(intoAppealWatch.some((edge) => edge.kind === 'declares' && edge.from === 'pg-stake-appeal')).toBe(true);

    // The chain continues: watch -> judgment -> response.
    expect(graph.edges.some((e) => e.kind === 'gates' && e.from === 'pg-watch-appeal' && e.to === 'pg-judg-appeal')).toBe(true);
    expect(graph.edges.some((e) => e.kind === 'acts' && e.from === 'pg-judg-appeal' && e.to === 'pg-resp-appeal')).toBe(true);
  });

  it('every response resolves its EffectContract and reports true permission state', () => {
    const responses = nodesOfKind('response');
    expect(responses.length).toBeGreaterThan(0);
    for (const response of responses) {
      expect(response.effectContract.actionClass).toBe(response.actionClass);
      expect(response.permission.capabilityClass).toBe(response.effectContract.capabilityClass);
    }
    // A send:email response with no grant renders "will ask you every time".
    const appeal = responses.find((r) => r.id === 'pg-resp-appeal');
    expect(appeal?.permission.hasGrant).toBe(false);
    // A granted response reports its date and revocability.
    const book = responses.find((r) => r.id === 'pg-resp-book');
    expect(book?.permission.hasGrant).toBe(true);
    expect(book?.permission.grantedOn).toBe('2026-06-30');
    expect(book?.permission.revocable).toBe(true);
  });

  it('a stake assumption set matches its ATMS label exactly', () => {
    const stakes = nodesOfKind('stake');
    const assumptions = nodesOfKind('assumption');
    for (const stake of stakes) {
      const owned = assumptions.filter((a) => a.stakeId === stake.id).map((a) => a.id).sort();
      expect(owned).toEqual([...stake.label.assumptionIds].sort());
    }
    const appeal = stakes.find((s) => s.id === 'pg-stake-appeal');
    expect(appeal?.label.assumptionIds).toHaveLength(4);
  });

  it('a node whose standing spend exceeds budget reports over-budget', () => {
    const responses = nodesOfKind('response');
    const subs = responses.find((r) => r.id === 'pg-resp-subs');
    expect(subs?.budget.overBudget).toBe(true);
    expect(subs?.budget.projectedSpend).toBeGreaterThan(subs?.budget.cap ?? 0);
    // The distinct boundary: over budget even though the capability is granted.
    expect(subs?.permission.hasGrant).toBe(true);
    // Every within-budget response stays within.
    const book = responses.find((r) => r.id === 'pg-resp-book');
    expect(book?.budget.overBudget).toBe(false);
  });

  it('refuses with no tenant (named choice 10)', () => {
    const structure = seedStandingStructure();
    expect(isRefusal(projectProactivityGraph(undefined, structure))).toBe(true);
    expect(isRefusal(projectProactivityGraph('', structure))).toBe(true);
    expect(isRefusal(projectProactivityGraph('   ', structure))).toBe(true);
    const ok = projectProactivityGraph(FIXTURE_TENANT, structure);
    expect(isRefusal(ok)).toBe(false);
  });

  it('bounded labels never claim completeness', () => {
    const book = nodesOfKind('stake').find((s) => s.id === 'pg-stake-book');
    expect(book?.label.complete).toBe(false);
    expect(book?.label.prunedCount).toBe(2);
  });

  it('all responses are the only nodes carrying contract, permission, budget', () => {
    const graph = projectFixture();
    for (const node of graph.nodes) {
      if (isResponse(node)) {
        expect(node.effectContract).toBeDefined();
        expect(node.budget).toBeDefined();
      } else {
        expect('effectContract' in node).toBe(false);
      }
    }
  });
});
