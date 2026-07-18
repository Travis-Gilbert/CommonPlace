// SOURCING: @commonplace/block-view (ObjectAction/receipt semantics), mirroring
// ConsoleBlockHost's arrangement store. The ProactivityStore owns one tenant's
// standing structure: it projects it on query (a missing tenant refuses via the
// notes channel, named choice 10) and applies every mutation as a receipted,
// reversible edit persisted to localStorage. Its mutation vocabulary is
// disabled / pruned / parameter patches only: there is no code path that writes
// a Grant or an EffectContract (the grant boundary holds structurally, PG7
// gate 2), and an edit that would exceed the standing budget is refused with
// the budget named (the budget boundary, PG7 gate 3). When the kernel lands the
// host routes these reads and writes to the Rust seam instead; this store falls
// away and the view is unchanged.

import type {
  JsonValue,
  ObjectAction,
  ObjectActionReceipt,
  ObjectQuery,
  ObjectRef,
  ObjectSet,
  Predicate,
  Result,
  Unsubscribe,
} from '@commonplace/block-view/types';
import type {
  EffectContract,
  SourceNode,
  StandingBudget,
  StandingNode,
  StandingStructure,
} from './model';
import { projectProactivityGraph } from './projection';
import { isRefusal } from './model';
import { graphToObjectRefs, pgKind } from './object-bridge';

const STORAGE_KEY = 'commonplace.console.proactivity.v1';
export const REFUSAL_NOTE = 'refused:missing_tenant';

function matchesWhere(object: ObjectRef, predicate: Predicate | undefined): boolean {
  if (!predicate) return true;
  switch (predicate.kind) {
    case 'eq':
      return object.properties[predicate.field] === predicate.value;
    case 'not_eq':
      return object.properties[predicate.field] !== predicate.value;
    case 'exists':
      return predicate.field in object.properties;
    case 'and':
      return predicate.all.every((inner) => matchesWhere(object, inner));
    case 'or':
      return predicate.any.some((inner) => matchesWhere(object, inner));
    case 'not':
      return !matchesWhere(object, predicate.predicate);
    default:
      return true;
  }
}

function budgetFor(
  contract: EffectContract,
  budgets: readonly StandingBudget[],
): { cap: number | null; projected: number } {
  const budget = budgets.find((candidate) => candidate.capabilityClass === contract.capabilityClass);
  const committed = budget?.committedSpend ?? 0;
  return { cap: budget ? budget.cap : null, projected: committed + contract.perFiringSpend };
}

export class ProactivityStore {
  private structure: StandingStructure;
  private tenant: string | null;
  private subs = new Set<() => void>();

  constructor(tenant: string | null, seed: () => StandingStructure) {
    this.tenant = tenant;
    this.structure = this.hydrate(seed);
  }

  private hydrate(seed: () => StandingStructure): StandingStructure {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as StandingStructure;
      } catch {
        // fall through to seed
      }
    }
    return seed();
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.structure));
    } catch {
      // storage unavailable: the in-memory structure still works
    }
  }

  private notify(): void {
    for (const callback of this.subs) callback();
  }

  /** Drop the persisted structure and return to the seed. */
  reset(seed: () => StandingStructure): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    this.structure = seed();
    this.notify();
  }

  sources(): readonly SourceNode[] {
    return this.structure.nodes.filter((node): node is SourceNode => node.kind === 'source');
  }

  contracts(): readonly EffectContract[] {
    return this.structure.effectContracts;
  }

  /** Project and serialize the graph, filtered by the query. A missing tenant
   *  refuses via the notes channel rather than returning an empty graph. */
  query(query: ObjectQuery): ObjectSet {
    const result = projectProactivityGraph(this.tenant, this.structure);
    if (isRefusal(result)) {
      return {
        objects: [],
        shape: { types: [...query.types], fields: [], relations: [], axes: {}, cardinality: 'empty' },
        notes: [REFUSAL_NOTE],
        subscribe: (callback) => this.subscribe(() => callback(this.query(query))),
      };
    }
    const all = graphToObjectRefs(result);
    const objects = all
      .filter((object) => query.types.includes(object.type))
      .filter((object) => matchesWhere(object, query.where));
    return {
      objects,
      shape: {
        types: [...query.types],
        fields: [],
        relations: [
          { edge: 'RESTS_ON', dir: 'out' },
          { edge: 'FEEDS', dir: 'out' },
          { edge: 'DECLARES', dir: 'out' },
          { edge: 'GATES', dir: 'out' },
          { edge: 'ACTS', dir: 'out' },
        ],
        axes: {},
        cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
      },
      subscribe: (callback) => this.subscribe(() => callback(this.query(query))),
    };
  }

  private subscribe(callback: () => void): Unsubscribe {
    this.subs.add(callback);
    return () => this.subs.delete(callback);
  }

  /** True when this action targets the proactivity graph (so the host knows to
   *  let the store handle it rather than falling through). */
  owns(action: ObjectAction): boolean {
    switch (action.kind) {
      case 'update':
      case 'delete':
        return this.structure.nodes.some((node) => node.id === action.id);
      case 'create':
        return pgKind(action.type) !== null;
      default:
        return false;
    }
  }

  emit(action: ObjectAction): Result<ObjectActionReceipt> {
    switch (action.kind) {
      case 'update':
        return this.applyUpdate(action.id, action.patch);
      case 'create':
        return this.applyCreate(action.type, action.props);
      case 'delete':
        return this.applyDelete(action.id);
      default:
        return { ok: false, error: `proactivity store cannot handle action: ${action.kind}` };
    }
  }

  private applied(id: string): Result<ObjectActionReceipt> {
    this.persist();
    this.notify();
    return { ok: true, value: { action_kind: 'update', status: 'applied', target_ids: [id] } };
  }

  private applyUpdate(id: string, patch: Record<string, JsonValue>): Result<ObjectActionReceipt> {
    const index = this.structure.nodes.findIndex((node) => node.id === id);
    if (index < 0) return { ok: false, error: `proactivity node missing: ${id}` };
    const node = this.structure.nodes[index];

    // The budget boundary: changing a response's action class to one that would
    // exceed its capability's standing cap is refused with the budget named. A
    // no-grant class is NOT refused (proposals without autonomy are allowed).
    if (node.kind === 'response' && typeof patch.actionClass === 'string' && patch.actionClass !== node.actionClass) {
      const contract = this.structure.effectContracts.find((c) => c.actionClass === patch.actionClass);
      if (!contract) return { ok: false, error: `no effect contract for action class: ${patch.actionClass}` };
      const { cap, projected } = budgetFor(contract, this.structure.budgets);
      if (cap !== null && projected > cap) {
        return {
          ok: false,
          error: `over budget: ${contract.capabilityClass} cap is ${cap}, this action would spend ${projected}`,
        };
      }
    }

    const nodes = [...this.structure.nodes];
    nodes[index] = { ...node, ...patch } as StandingNode;
    this.structure = { ...this.structure, nodes };
    return this.applied(id);
  }

  private applyCreate(type: string, props: Record<string, JsonValue>): Result<ObjectActionReceipt> {
    const kind = pgKind(type);
    if (!kind) return { ok: false, error: `not a proactivity type: ${type}` };
    const id = typeof props.id === 'string' ? props.id : `pg-${kind}-${this.structure.nodes.length + 1}`;
    if (this.structure.nodes.some((node) => node.id === id)) {
      return { ok: false, error: `proactivity node already exists: ${id}` };
    }
    const node = { ...props, id, kind } as unknown as StandingNode;
    this.structure = { ...this.structure, nodes: [...this.structure.nodes, node] };
    this.persist();
    this.notify();
    return { ok: true, value: { action_kind: 'create', status: 'applied', target_ids: [id] } };
  }

  private applyDelete(id: string): Result<ObjectActionReceipt> {
    if (!this.structure.nodes.some((node) => node.id === id)) {
      return { ok: true, value: { action_kind: 'delete', status: 'accepted' } };
    }
    const nodes = this.structure.nodes.filter((node) => node.id !== id);
    this.structure = { ...this.structure, nodes };
    this.persist();
    this.notify();
    return { ok: true, value: { action_kind: 'delete', status: 'applied', target_ids: [id] } };
  }
}
