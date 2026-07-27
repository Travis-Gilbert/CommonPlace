// SOURCING: @commonplace/block-view (ObjectAction/receipt semantics), mirroring
// ConsoleBlockHost's arrangement store. The ProactivityStore owns one tenant's
// standing structure: it projects it on query (a missing tenant refuses via the
// notes channel, named choice 10) and applies every mutation as a receipted,
// reversible edit persisted through the authenticated object seam. Its mutation vocabulary is
// disabled / pruned / parameter patches only: there is no code path that writes
// a Grant or an EffectContract (the grant boundary holds structurally, PG7
// gate 2), and an edit that would exceed the standing budget is refused with
// the budget named (the budget boundary, PG7 gate 3). When the kernel lands the
// host routes these reads and writes to the Rust seam instead; this store falls
// away and the view is unchanged.

import type {
  BlockHost,
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
  PgNodeKind,
  SourceNode,
  StandingBudget,
  StandingNode,
  StandingStructure,
} from './model';
import { projectProactivityGraph } from './projection';
import { isRefusal } from './model';
import { graphToObjectRefs, pgKind } from './object-bridge';

const STRUCTURE_TYPE = 'proactivity-structure';
const STRUCTURE_PROPERTY = 'structure';
export const REFUSAL_NOTE = 'refused:missing_tenant';
export const PERSISTENCE_UNAVAILABLE_NOTE = 'refused:proactivity_persistence_unavailable';

// The safe mutation surface (PG4): the only fields an update may patch, keyed by
// node kind, each with a type guard. A patch naming any other field, or a value
// of the wrong shape, is rejected before it can corrupt the stored structure.
// Grant and effect-contract fields are absent by construction: there is no code
// path here that writes a Grant or an EffectContract (PG7 gate 2).
type FieldGuard = (value: JsonValue) => boolean;
const isBoolean: FieldGuard = (value) => typeof value === 'boolean';
const isString: FieldGuard = (value) => typeof value === 'string';
const isStringArray: FieldGuard = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isParamRecord: FieldGuard = (value) =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string' || typeof item === 'number');
const isJudgmentClass: FieldGuard = (value) => value === 'interrupt' || value === 'digest' || value === 'silent';
// The agent-action stack: a list of typed blocks. Attention/plan only, so a
// step can never carry a capability field; the guard admits id and label, plus
// the optional block type (prepare/verify/action/custom) and branch (then/else)
// with validated values, and nothing else that could widen the effect.
const RESPONSE_BLOCK_TYPES = new Set(['prepare', 'verify', 'action', 'custom']);
const STEP_BRANCHES = new Set(['then', 'else']);
const isStepArray: FieldGuard = (value) =>
  Array.isArray(value) &&
  value.every((step) => {
    if (typeof step !== 'object' || step === null) return false;
    const record = step as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.label !== 'string') return false;
    if (record.type !== undefined && !(typeof record.type === 'string' && RESPONSE_BLOCK_TYPES.has(record.type))) return false;
    if (record.branch !== undefined && !(typeof record.branch === 'string' && STEP_BRANCHES.has(record.branch))) return false;
    return true;
  });

const PATCHABLE_FIELDS: Record<PgNodeKind, Readonly<Record<string, FieldGuard>>> = {
  stake: { disabled: isBoolean },
  assumption: { pruned: isBoolean },
  source: { disabled: isBoolean },
  watch: { disabled: isBoolean, sourceIds: isStringArray, conditionParams: isParamRecord },
  judgment: { disabled: isBoolean, judgmentClass: isJudgmentClass, thresholds: isParamRecord },
  response: { disabled: isBoolean, actionClass: isString, steps: isStepArray },
};

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
  private hydrated: Promise<void> | null = null;
  private hydrationReady = false;
  private persisted = false;
  private mutation: Promise<unknown> = Promise.resolve();

  constructor(
    tenant: string | null,
    private readonly seed: () => StandingStructure,
    private readonly host?: Pick<BlockHost, 'query' | 'emit'>,
  ) {
    this.tenant = tenant;
    this.structure = seed();
  }

  /** Persistence is per authenticated tenant (PG7 gate 4). The tenant remains
   * part of the stable object id for defense in depth, while authorization and
   * credential selection belong to the server-side object proxy. */
  private structureId(): string | null {
    return this.tenant ? `proactivity-structure:${this.tenant}` : null;
  }

  private ensureHydrated(): Promise<void> {
    if (!this.hydrated) this.hydrated = this.hydrate();
    return this.hydrated;
  }

  private async hydrate(): Promise<void> {
    const id = this.structureId();
    if (!id || !this.host) {
      this.hydrationReady = true;
      return;
    }
    try {
      const set = await this.host.query({
        types: [STRUCTURE_TYPE],
        where: { kind: 'eq', field: 'id', value: id },
        page: { limit: 1 },
      });
      const object = set.objects.find((candidate) => candidate.id === id);
      const value = object?.properties[STRUCTURE_PROPERTY];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const candidate = value as unknown as Partial<StandingStructure>;
        if (
          Array.isArray(candidate.nodes)
          && Array.isArray(candidate.effectContracts)
          && Array.isArray(candidate.grants)
          && Array.isArray(candidate.budgets)
        ) {
          this.structure = candidate as StandingStructure;
          this.persisted = true;
          this.hydrationReady = true;
          this.notify();
          return;
        }
      }
      const initialized = await this.persist();
      if (initialized.ok && initialized.value?.status === 'applied') {
        this.hydrationReady = true;
        return;
      }
      this.hydrated = null;
    } catch {
      // The seed remains readable, but writes must retry the durable read first.
      this.hydrated = null;
    }
  }

  private async persist(): Promise<Result<ObjectActionReceipt>> {
    const id = this.structureId();
    if (!id || !this.host) {
      return {
        ok: true,
        value: {
          action_kind: this.persisted ? 'update' : 'create',
          status: 'applied',
          target_ids: id ? [id] : [],
          legacy_without_op_range: true,
        },
      };
    }
    const structure = this.structure as unknown as JsonValue;
    const action: ObjectAction = this.persisted
      ? {
          kind: 'update',
          id,
          patch: {
            tenant: this.tenant,
            persistence_kind: 'proactivity-review-v1',
            [STRUCTURE_PROPERTY]: structure,
          },
        }
      : {
          kind: 'create',
          type: STRUCTURE_TYPE,
          props: {
            id,
            title: 'Proactivity review state',
            tenant: this.tenant,
            persistence_kind: 'proactivity-review-v1',
            [STRUCTURE_PROPERTY]: structure,
          },
    };
    const result = await this.host.emit(action);
    if (result.ok && result.value?.status === 'applied') this.persisted = true;
    return result;
  }

  ready(): Promise<void> {
    return this.ensureHydrated();
  }

  private notify(): void {
    for (const callback of this.subs) callback();
  }

  /** Drop the persisted structure and return to the seed. */
  async reset(seed: () => StandingStructure = this.seed): Promise<void> {
    await this.ensureHydrated();
    if (!this.hydrationReady) throw new Error(PERSISTENCE_UNAVAILABLE_NOTE);
    this.structure = seed();
    await this.persist();
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
    void this.ensureHydrated();
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

  emit(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    const run = this.mutation.then(() => this.emitOne(action));
    this.mutation = run.then(() => undefined, () => undefined);
    return run;
  }

  private async emitOne(action: ObjectAction): Promise<Result<ObjectActionReceipt>> {
    await this.ensureHydrated();
    if (!this.hydrationReady) {
      return { ok: false, error: PERSISTENCE_UNAVAILABLE_NOTE };
    }
    const previous = this.structure;
    const local = this.applyLocal(action);
    if (!local.ok) return local;
    const durable = await this.persist();
    if (!durable.ok) {
      this.structure = previous;
      this.notify();
      return durable;
    }
    return {
      ok: true,
      value: {
        ...(durable.value ?? {
          action_kind: action.kind,
          status: 'applied' as const,
        }),
        action_kind: action.kind,
        status: local.value?.status ?? 'applied',
        target_ids: local.value?.target_ids ?? durable.value?.target_ids ?? [],
      },
    };
  }

  private applyLocal(action: ObjectAction): Result<ObjectActionReceipt> {
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
    this.notify();
    return { ok: true, value: { action_kind: 'update', status: 'applied', target_ids: [id] } };
  }

  private applyUpdate(id: string, patch: Record<string, JsonValue>): Result<ObjectActionReceipt> {
    const index = this.structure.nodes.findIndex((node) => node.id === id);
    if (index < 0) return { ok: false, error: `proactivity node missing: ${id}` };
    const node = this.structure.nodes[index];

    // The safe mutation surface (PG4): reject any field outside this node kind's
    // allowlist, or a value of the wrong shape, before it can corrupt the stored
    // structure. This is also where the grant boundary holds: no field here can
    // write a Grant or an EffectContract.
    const allowed = PATCHABLE_FIELDS[node.kind];
    for (const [field, value] of Object.entries(patch)) {
      const guard = allowed[field];
      if (!guard) return { ok: false, error: `field not editable on a ${node.kind}: ${field}` };
      if (!guard(value)) return { ok: false, error: `invalid value for ${field} on a ${node.kind}` };
    }

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
    this.notify();
    return { ok: true, value: { action_kind: 'create', status: 'applied', target_ids: [id] } };
  }

  private applyDelete(id: string): Result<ObjectActionReceipt> {
    if (!this.structure.nodes.some((node) => node.id === id)) {
      return { ok: true, value: { action_kind: 'delete', status: 'accepted' } };
    }
    const nodes = this.structure.nodes.filter((node) => node.id !== id);
    this.structure = { ...this.structure, nodes };
    this.notify();
    return { ok: true, value: { action_kind: 'delete', status: 'applied', target_ids: [id] } };
  }
}
