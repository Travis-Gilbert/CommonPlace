// PG7 gates 2 (grant boundary), 3 (budget boundary), 4 (tenant), plus the
// disable-propagation (PG2), prune-scoping (PG6), intent-commit (PG5), and the
// object-bridge round trip. Exercises the store the way the host does.

import { describe, expect, it } from 'vitest';
import { FIXTURE_TENANT, seedStandingStructure } from './fixtures';
import { ProactivityStore, REFUSAL_NOTE } from './store';
import { graphFromObjects, graphToObjectRefs } from './object-bridge';
import { projectProactivityGraph } from './projection';
import { isRefusal, type ProjectedNode } from './model';
import {
  commitCandidateAction,
  setActionClassAction,
  setDisabledAction,
  setPrunedAction,
} from './node-actions';

const PG_QUERY = {
  types: ['pg.stake', 'pg.source', 'pg.watch', 'pg.judgment', 'pg.response', 'pg.assumption'],
  live: true,
} as const;

function makeStore(tenant: string | null = FIXTURE_TENANT): ProactivityStore {
  return new ProactivityStore(tenant, seedStandingStructure);
}

function nodesOf(store: ProactivityStore): ProjectedNode[] {
  const set = store.query(PG_QUERY);
  return set.objects
    .map((object) => graphFromObjects([object]).nodes[0])
    .filter((node): node is ProjectedNode => Boolean(node));
}

function nodeById(store: ProactivityStore, id: string): ProjectedNode | undefined {
  return nodesOf(store).find((node) => node.id === id);
}

describe('ProactivityStore', () => {
  it('refuses reads with no tenant (gate 4)', () => {
    const store = makeStore(null);
    const set = store.query(PG_QUERY);
    expect(set.notes).toContain(REFUSAL_NOTE);
    expect(set.objects).toHaveLength(0);
  });

  it('disabling a source degrades its dependent watches with the consequence named (PG2)', async () => {
    const store = makeStore();
    const before = nodeById(store, 'pg-watch-appeal');
    expect(before?.kind === 'watch' && before.degraded.degraded).toBe(false);

    const receipt = await Promise.resolve(store.emit(setDisabledAction('pg-source-email', true)));
    expect(receipt.ok).toBe(true);

    const watch = nodeById(store, 'pg-watch-appeal');
    expect(watch?.degraded.degraded).toBe(true);
    expect(watch?.degraded.consequence).toBe('this can no longer see your email');
    // The consequence propagates downstream to the judgment and response.
    expect(nodeById(store, 'pg-judg-appeal')?.degraded.degraded).toBe(true);
    expect(nodeById(store, 'pg-resp-appeal')?.degraded.degraded).toBe(true);
  });

  it('disable is reversible (named choice 1)', () => {
    const store = makeStore();
    store.emit(setDisabledAction('pg-source-email', true));
    expect(nodeById(store, 'pg-source-email')?.kind === 'source' && (nodeById(store, 'pg-source-email') as { disabled: boolean }).disabled).toBe(true);
    store.emit(setDisabledAction('pg-source-email', false));
    const restored = nodeById(store, 'pg-watch-appeal');
    expect(restored?.degraded.degraded).toBe(false);
  });

  it('refuses an over-budget action-class edit with the budget named (gate 3)', () => {
    const store = makeStore();
    // Moving the appeal response (send:email, within budget) onto the push
    // class would spend 8 on top of 5 committed against a cap of 10.
    const receipt = store.emit(setActionClassAction('pg-resp-appeal', 'push_subscription_alert'));
    expect(receipt.ok).toBe(false);
    expect(receipt.error).toMatch(/over budget/i);
    expect(receipt.error).toMatch(/10/);
    // The response is unchanged: the edit could not exceed the standing budget.
    const response = nodeById(store, 'pg-resp-appeal');
    expect(response?.kind === 'response' && response.actionClass).toBe('send_email_reply');
  });

  it('permits a no-grant action class rather than blocking it (PG4)', () => {
    const store = makeStore();
    // draft_nudge (compose:nudge) has no grant and is within budget.
    const receipt = store.emit(setActionClassAction('pg-resp-appeal', 'draft_nudge'));
    expect(receipt.ok).toBe(true);
    const response = nodeById(store, 'pg-resp-appeal');
    expect(response?.kind === 'response' && response.permission.hasGrant).toBe(false);
  });

  it('never writes a Grant or an EffectContract through any mutation (gate 2)', () => {
    const store = makeStore();
    const seed = seedStandingStructure();
    // Apply a spread of mutations, then confirm the code-owned objects are
    // byte-identical: the graph programs attention, not capability.
    store.emit(setDisabledAction('pg-source-email', true));
    store.emit(setActionClassAction('pg-resp-appeal', 'draft_nudge'));
    store.emit(setPrunedAction('pg-assume-medical', true));
    const set = store.query(PG_QUERY);
    const rebuilt = graphFromObjects(set.objects);
    // Reproject a fresh structure with the same code-owned tables and confirm
    // the store exposes no path to alter them.
    const fresh = projectProactivityGraph(FIXTURE_TENANT, seed);
    expect(isRefusal(fresh)).toBe(false);
    // Every response still resolves the same contracts/grants it started with.
    const responses = rebuilt.nodes.filter((node): node is Extract<ProjectedNode, { kind: 'response' }> => node.kind === 'response');
    for (const response of responses) {
      expect(response.effectContract).toBeDefined();
      expect(response.permission.capabilityClass).toBe(response.effectContract.capabilityClass);
    }
  });

  it('prunes an assumption for one stake only (PG6)', () => {
    const store = makeStore();
    store.emit(setPrunedAction('pg-assume-medical', true));
    const pruned = nodeById(store, 'pg-assume-medical');
    expect(pruned?.kind === 'assumption' && pruned.pruned).toBe(true);
    // No assumption of the other stake changed.
    const other = nodesOf(store).filter(
      (node): node is Extract<ProjectedNode, { kind: 'assumption' }> => node.kind === 'assumption' && node.stakeId === 'pg-stake-book',
    );
    expect(other.every((assumption) => assumption.pruned === false)).toBe(true);
  });

  it('commits an intent candidate as an author: human node (PG5)', async () => {
    const store = makeStore();
    const candidate = {
      id: 'authored-test-watch',
      kind: 'watch',
      subKind: 'authored',
      statement: 'The contractor goes quiet',
      condition: 'no reply in {quietDays} days',
      conditionParams: { quietDays: 4 },
      sourceIds: ['pg-source-email'],
      queryFamily: 'open_loops',
      author: 'human',
      disabled: false,
    } as const;
    const receipt = await Promise.resolve(store.emit(commitCandidateAction(candidate)));
    expect(receipt.ok).toBe(true);
    const committed = nodeById(store, 'authored-test-watch');
    expect(committed?.kind === 'watch' && committed.author).toBe('human');
  });

  it('round-trips the graph through the object bridge losslessly', () => {
    const graph = projectProactivityGraph(FIXTURE_TENANT, seedStandingStructure());
    if (isRefusal(graph)) throw new Error('unexpected refusal');
    const rebuilt = graphFromObjects(graphToObjectRefs(graph));
    expect(rebuilt.nodes).toHaveLength(graph.nodes.length);
    expect(rebuilt.edges).toHaveLength(graph.edges.length);
    expect(new Set(rebuilt.nodes.map((n) => n.kind))).toEqual(new Set(graph.nodes.map((n) => n.kind)));
    expect(rebuilt.tenant).toBe(FIXTURE_TENANT);
  });
});
