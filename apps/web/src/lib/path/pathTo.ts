// SOURCING: none — pure logic, no upstream component applies
/**
 * PL1 / PL3 Path adapter (HANDOFF-CANON).
 *
 * One adapter, per-scope resolvers. Composes existing substrate tools with no
 * new backend: why_derivation_trace, fold_semiring (tropical), plan blocked_set /
 * next_actionable, memory support chains, and code-graph reachability.
 */

export type PathScope = 'derivation' | 'plan' | 'memory' | 'code';

export type PathStatus = 'ready' | 'blocked' | 'done';

export interface PathNodeRef {
  readonly id: string;
  readonly label?: string;
  readonly type?: string;
}

export interface PathResult {
  readonly chain: readonly PathNodeRef[];
  readonly depth: number;
  readonly distance: number | null;
  readonly status: PathStatus;
  readonly blockedBy: readonly PathNodeRef[];
  readonly scope: PathScope;
  /** Readout wording comes from the scope label, never from renderer branches. */
  readonly label: string;
}

export interface PathScopeDef {
  readonly id: PathScope;
  readonly label: string;
}

/** Four launch scopes. Curriculum (`topic` + PREREQUISITE) is optional fifth. */
export const PATH_SCOPES: Readonly<Record<PathScope, PathScopeDef>> = {
  derivation: { id: 'derivation', label: 'why this is believed' },
  plan: { id: 'plan', label: 'what blocks this' },
  memory: { id: 'memory', label: 'what supports this claim' },
  code: { id: 'code', label: 'what reaches this symbol' },
};

export interface WhyTraceNode {
  readonly id: string;
  readonly label?: string;
  readonly type?: string;
  readonly children?: readonly WhyTraceNode[];
}

export interface WhyTraceResult {
  readonly root?: WhyTraceNode;
  readonly chain?: readonly PathNodeRef[];
}

export interface FoldSemiringResult {
  readonly score?: number;
  readonly distance?: number;
  readonly value?: number;
}

export interface PlanBlockedResult {
  readonly blockedBy?: readonly PathNodeRef[];
  readonly blocked_set?: readonly PathNodeRef[] | readonly string[];
  readonly status?: PathStatus | string;
  readonly chain?: readonly PathNodeRef[];
  readonly next_actionable?: readonly PathNodeRef[] | readonly string[];
}

export interface MemorySupportResult {
  readonly chain?: readonly PathNodeRef[];
  readonly support?: readonly PathNodeRef[];
}

export interface CodeReachResult {
  readonly chain?: readonly PathNodeRef[];
  readonly reaches?: readonly PathNodeRef[];
}

/** Injectable substrate clients so unit tests do not need a live MCP. */
export interface PathClients {
  whyDerivationTrace(nodeId: string): Promise<WhyTraceResult>;
  foldSemiringTropical(nodeId: string): Promise<FoldSemiringResult>;
  planBlocked(nodeId: string): Promise<PlanBlockedResult>;
  memorySupport(nodeId: string): Promise<MemorySupportResult>;
  codeReach(nodeId: string): Promise<CodeReachResult>;
}

export type PathResolver = (nodeId: string, clients: PathClients) => Promise<PathResult>;

function flattenWhyTrace(node: WhyTraceNode | undefined, out: PathNodeRef[] = []): PathNodeRef[] {
  if (!node) return out;
  out.push({ id: node.id, label: node.label, type: node.type });
  for (const child of node.children ?? []) {
    flattenWhyTrace(child, out);
  }
  return out;
}

function asNodeRefs(
  values: readonly PathNodeRef[] | readonly string[] | undefined,
): PathNodeRef[] {
  if (!values) return [];
  return values.map((v) => (typeof v === 'string' ? { id: v } : v));
}

function tropicalDistance(fold: FoldSemiringResult): number | null {
  if (typeof fold.distance === 'number') return fold.distance;
  if (typeof fold.score === 'number') return fold.score;
  if (typeof fold.value === 'number') return fold.value;
  return null;
}

function withScope(scope: PathScope, partial: Omit<PathResult, 'scope' | 'label'>): PathResult {
  return {
    ...partial,
    scope,
    label: PATH_SCOPES[scope].label,
  };
}

export const derivationResolver: PathResolver = async (nodeId, clients) => {
  const [trace, fold] = await Promise.all([
    clients.whyDerivationTrace(nodeId),
    clients.foldSemiringTropical(nodeId),
  ]);
  const chain =
    trace.chain && trace.chain.length > 0
      ? [...trace.chain]
      : flattenWhyTrace(trace.root);
  if (!chain.some((n) => n.id === nodeId)) {
    chain.push({ id: nodeId });
  }
  const distance = tropicalDistance(fold);
  return withScope('derivation', {
    chain,
    depth: Math.max(0, chain.length - 1),
    distance,
    status: 'ready',
    blockedBy: [],
  });
};

export const planResolver: PathResolver = async (nodeId, clients) => {
  const plan = await clients.planBlocked(nodeId);
  const blockedBy = asNodeRefs(plan.blockedBy ?? plan.blocked_set);
  const chain =
    plan.chain && plan.chain.length > 0
      ? [...plan.chain]
      : [{ id: nodeId }, ...blockedBy];
  const rawStatus = plan.status;
  let status: PathStatus = 'ready';
  if (rawStatus === 'done' || rawStatus === 'blocked' || rawStatus === 'ready') {
    status = rawStatus;
  } else if (blockedBy.length > 0) {
    status = 'blocked';
  }
  return withScope('plan', {
    chain,
    depth: Math.max(0, chain.length - 1),
    distance: blockedBy.length > 0 ? blockedBy.length : 0,
    status,
    blockedBy,
  });
};

export const memoryResolver: PathResolver = async (nodeId, clients) => {
  const memory = await clients.memorySupport(nodeId);
  const support = asNodeRefs(memory.chain ?? memory.support);
  const chain = support.length > 0 ? [...support] : [{ id: nodeId }];
  if (!chain.some((n) => n.id === nodeId)) chain.push({ id: nodeId });
  return withScope('memory', {
    chain,
    depth: Math.max(0, chain.length - 1),
    distance: Math.max(0, chain.length - 1),
    status: 'ready',
    blockedBy: [],
  });
};

export const codeResolver: PathResolver = async (nodeId, clients) => {
  const code = await clients.codeReach(nodeId);
  const reaches = asNodeRefs(code.chain ?? code.reaches);
  const chain = reaches.length > 0 ? [...reaches] : [{ id: nodeId }];
  if (!chain.some((n) => n.id === nodeId)) chain.push({ id: nodeId });
  return withScope('code', {
    chain,
    depth: Math.max(0, chain.length - 1),
    distance: Math.max(0, chain.length - 1),
    status: 'ready',
    blockedBy: [],
  });
};

/** Registry: adding a scope means adding a resolver, not a new tool. */
export const PATH_RESOLVERS: Readonly<Record<PathScope, PathResolver>> = {
  derivation: derivationResolver,
  plan: planResolver,
  memory: memoryResolver,
  code: codeResolver,
};

export function isPathScope(value: string): value is PathScope {
  return value in PATH_SCOPES;
}

/**
 * Resolve the Path lens payload for a node within a named scope.
 * Acceptance: derivation chain matches why_derivation_trace with tropical
 * distance attached; plan scope returns blocked_set as blockedBy.
 */
export async function pathTo(
  nodeId: string,
  scope: PathScope,
  clients: PathClients,
): Promise<PathResult> {
  if (!nodeId.trim()) {
    throw new Error('pathTo requires a non-empty nodeId');
  }
  const resolver = PATH_RESOLVERS[scope];
  if (!resolver) {
    throw new Error(`pathTo: unknown scope ${scope}; register a resolver`);
  }
  return resolver(nodeId, clients);
}

/** Format the lens readout line from a PathResult (scope label, not renderer branch). */
export function formatPathReadout(result: PathResult): string {
  const distance =
    result.distance === null || Number.isNaN(result.distance)
      ? '—'
      : String(result.distance);
  return `${result.scope} · depth ${result.depth} · distance ${distance} · blocked by ${result.blockedBy.length} · ${result.label}`;
}
