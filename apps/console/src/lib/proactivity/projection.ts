// SOURCING: none. The standing-graph read model (PG1). A pure projection that
// assembles a tenant's standing structure into a renderable graph: edges
// derived from structural fields (so they cannot drift from the nodes),
// degraded propagation computed from disables, and every response resolved
// against its code-owned EffectContract, Grant, and standing budget. Read-only:
// this module never mutates, and never writes a Grant or an EffectContract
// (the grant boundary, PG7 gate 2).

import type {
  BudgetState,
  DegradedState,
  EffectContract,
  Grant,
  PermissionState,
  PgEdge,
  ProactivityGraph,
  ProjectedNode,
  ProjectionResult,
  StandingBudget,
  StandingNode,
  StandingStructure,
} from './model';

function sourceLabel(kind: string): string {
  switch (kind) {
    case 'life_email':
      return 'email';
    case 'life_event':
      return 'calendar';
    case 'life_sms':
      return 'messages';
    case 'life_call':
      return 'calls';
    default:
      return kind;
  }
}

/** Derive the primary graph edges from the structural fields. The two-sided
 *  convergence is at the watch: `feeds` (source into watch) and `declares`
 *  (stake into its derived watch) both arrive there (named choice 8). */
function deriveEdges(nodes: readonly StandingNode[]): PgEdge[] {
  const edges: PgEdge[] = [];
  for (const node of nodes) {
    switch (node.kind) {
      case 'assumption':
        edges.push({ id: `e-rests-${node.id}`, from: node.id, to: node.stakeId, kind: 'rests_on' });
        break;
      case 'watch':
        for (const sourceId of node.sourceIds) {
          edges.push({ id: `e-feeds-${sourceId}-${node.id}`, from: sourceId, to: node.id, kind: 'feeds' });
        }
        if (node.stakeId) {
          edges.push({ id: `e-declares-${node.stakeId}-${node.id}`, from: node.stakeId, to: node.id, kind: 'declares' });
        }
        break;
      case 'judgment':
        edges.push({ id: `e-gates-${node.watchId}-${node.id}`, from: node.watchId, to: node.id, kind: 'gates' });
        break;
      case 'response':
        edges.push({ id: `e-acts-${node.judgmentId}-${node.id}`, from: node.judgmentId, to: node.id, kind: 'acts' });
        break;
      default:
        break;
    }
  }
  return edges;
}

function resolveContract(
  actionClass: string,
  contracts: readonly EffectContract[],
): EffectContract {
  const contract = contracts.find((candidate) => candidate.actionClass === actionClass);
  if (!contract) {
    // A well-formed standing structure always resolves; a miss is a data bug
    // surfaced loudly rather than a silently unpermitted render.
    throw new Error(`response action class has no EffectContract: ${actionClass}`);
  }
  return contract;
}

function resolvePermission(capabilityClass: string, grants: readonly Grant[]): PermissionState {
  const grant = grants.find((candidate) => candidate.capabilityClass === capabilityClass);
  if (!grant) return { hasGrant: false, capabilityClass };
  return {
    hasGrant: true,
    grantedOn: grant.grantedOn,
    revocable: grant.revocable,
    expiresOn: grant.expiresOn,
    capabilityClass,
  };
}

function resolveBudget(contract: EffectContract, budgets: readonly StandingBudget[]): BudgetState {
  const budget = budgets.find((candidate) => candidate.capabilityClass === contract.capabilityClass);
  const cap = budget ? budget.cap : null;
  const committedSpend = budget?.committedSpend ?? 0;
  const projectedSpend = committedSpend + contract.perFiringSpend;
  return {
    cap,
    committedSpend,
    perFiringSpend: contract.perFiringSpend,
    projectedSpend,
    overBudget: cap !== null && projectedSpend > cap,
  };
}

const NO_DEGRADE: DegradedState = { degraded: false, causeIds: [] };

/**
 * Project a tenant's standing structure into the renderable graph. A missing
 * tenant is a refusal, never an empty graph (named choice 10).
 */
export function projectProactivityGraph(
  tenant: string | null | undefined,
  structure: StandingStructure,
): ProjectionResult {
  if (!tenant || tenant.trim().length === 0) {
    return { refused: true, reason: 'missing_tenant' };
  }

  const byId = new Map<string, StandingNode>(structure.nodes.map((node) => [node.id, node]));
  const disabled = (id: string): boolean => {
    const node = byId.get(id);
    // Assumptions carry no disable switch (they are pruned instead), so the
    // union read stays safe.
    return node !== undefined && node.kind !== 'assumption' && node.disabled;
  };

  // Degraded propagation, computed downstream from disabled sources and stakes.
  const degradedByWatch = new Map<string, DegradedState>();
  for (const node of structure.nodes) {
    if (node.kind !== 'watch') continue;
    const causeIds: string[] = [];
    const lostSources: string[] = [];
    for (const sourceId of node.sourceIds) {
      const source = byId.get(sourceId);
      if (source && source.kind === 'source' && source.disabled) {
        causeIds.push(sourceId);
        lostSources.push(sourceLabel(source.lifeKind));
      }
    }
    if (node.stakeId && disabled(node.stakeId)) causeIds.push(node.stakeId);
    if (causeIds.length === 0) {
      degradedByWatch.set(node.id, NO_DEGRADE);
      continue;
    }
    const consequence = lostSources.length > 0
      ? `this can no longer see your ${lostSources.join(' or ')}`
      : 'the stake it protects is turned off';
    degradedByWatch.set(node.id, { degraded: true, consequence, causeIds });
  }

  const degradedFor = (node: StandingNode): DegradedState => {
    switch (node.kind) {
      case 'watch':
        return degradedByWatch.get(node.id) ?? NO_DEGRADE;
      case 'judgment': {
        const watch = byId.get(node.watchId);
        const watchDeg = degradedByWatch.get(node.watchId);
        if (watch && disabled(node.watchId)) {
          return { degraded: true, consequence: 'the watch it gates is turned off', causeIds: [node.watchId] };
        }
        return watchDeg?.degraded ? watchDeg : NO_DEGRADE;
      }
      case 'response': {
        const judgment = byId.get(node.judgmentId);
        if (judgment && judgment.kind === 'judgment') {
          if (disabled(node.judgmentId)) {
            return { degraded: true, consequence: 'the judgment upstream is turned off', causeIds: [node.judgmentId] };
          }
          const watchDeg = degradedByWatch.get(judgment.watchId);
          if (disabled(judgment.watchId) || watchDeg?.degraded) {
            return {
              degraded: true,
              consequence: watchDeg?.consequence ?? 'the watch upstream is turned off',
              causeIds: watchDeg?.causeIds.length ? watchDeg.causeIds : [judgment.watchId],
            };
          }
        }
        return NO_DEGRADE;
      }
      default:
        return NO_DEGRADE;
    }
  };

  const nodes: ProjectedNode[] = structure.nodes.map((node) => {
    if (node.kind === 'response') {
      const contract = resolveContract(node.actionClass, structure.effectContracts);
      return {
        ...node,
        degraded: degradedFor(node),
        effectContract: contract,
        permission: resolvePermission(contract.capabilityClass, structure.grants),
        budget: resolveBudget(contract, structure.budgets),
      };
    }
    return { ...node, degraded: degradedFor(node) };
  });

  const graph: ProactivityGraph = {
    tenant,
    nodes,
    edges: deriveEdges(structure.nodes),
  };
  return graph;
}
