// SOURCING: none. Server-only GraphQL adapter for the harness's denormalized
// proactivity projection and its named reversible mutations. It is the sole
// module that knows the upstream credential and tenant headers.

import 'server-only';

import type { ProactivityAction } from '@/lib/proactivity/actions';
import type {
  ProactivityGraph,
  ProactivityGraphEdge,
  ProactivityGraphNode,
  ProactivityCompilationCandidate,
  ProactivityReceipt,
} from '@/lib/proactivity/types';
import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

export type { ProactivityGraph, ProactivityGraphEdge, ProactivityGraphNode, ProactivityReceipt };

export type ProactivityRead =
  | { readonly ok: true; readonly tenant: string; readonly graph: ProactivityGraph }
  | { readonly ok: false; readonly status: number; readonly error: string };

export type ProactivityActionResult =
  | { readonly ok: true; readonly tenant: string; readonly receipt: ProactivityReceipt; readonly graph: ProactivityGraph }
  | { readonly ok: false; readonly status: number; readonly error: string };

export type ProactivityCompilationResult =
  | { readonly ok: true; readonly tenant: string; readonly receipt: ProactivityReceipt; readonly graph: ProactivityGraph }
  | { readonly ok: false; readonly status: number; readonly error: string };

const PROACTIVITY_GRAPH_QUERY = `
  query ConsoleProactivityGraph {
    proactivityGraph {
      nodes { id kind author label enabled resolved }
      edges { id from to kind }
    }
  }
`;

/** Test-only stand-in for the v0 fixture seam. Production never reads it. */
function deterministicProactivityGraphFixture(): ProactivityGraph {
  const prefix = 'tenant:Travis-Gilbert:';
  return {
    nodes: [
      {
        id: `${prefix}stake:appeal`, kind: 'stake', author: 'human', enabled: true,
        label: 'Keep the insurance appeal viable.',
        resolved: { assumptions: [{ id: `${prefix}assumption:deadline` }] },
      },
      {
        id: `${prefix}source:appeal-email`, kind: 'source', author: 'human', enabled: true,
        label: 'Appeal office deadline email', resolved: { sourceRefs: ['cas:fixture:appeal-email'] },
      },
      {
        id: `${prefix}assumption:deadline`, kind: 'assumption', author: 'agent', enabled: true,
        label: 'The original filing window remains open.', resolved: {},
      },
      {
        id: `${prefix}watch:deadline`, kind: 'watch', author: 'agent', enabled: true,
        label: 'Watch for appeal deadline changes.',
        resolved: { condition: 'appeal deadline changes', subKind: 'derived' },
      },
      {
        id: `${prefix}judgment:appeal-risk`, kind: 'judgment', author: 'agent', enabled: true,
        label: 'The appeal needs immediate review when its deadline moves.',
        resolved: { class: 'time-sensitive', thresholds: { daysRemaining: 7 } },
      },
      {
        id: `${prefix}response:prepare-draft`, kind: 'response', author: 'human', enabled: true,
        label: 'Prepare an appeal draft for review.',
        resolved: { actionClass: 'email.prepare_draft', permissionState: 'ask-every-time', budgetState: 'within-budget' },
      },
    ],
    edges: [
      { id: 'evidence', from: `${prefix}source:appeal-email`, to: `${prefix}assumption:deadline`, kind: 'evidence' },
      { id: 'supports', from: `${prefix}assumption:deadline`, to: `${prefix}stake:appeal`, kind: 'supports' },
      { id: 'watches', from: `${prefix}stake:appeal`, to: `${prefix}watch:deadline`, kind: 'watches' },
      { id: 'evaluates', from: `${prefix}watch:deadline`, to: `${prefix}judgment:appeal-risk`, kind: 'evaluates' },
      { id: 'responds', from: `${prefix}judgment:appeal-risk`, to: `${prefix}response:prepare-draft`, kind: 'responds' },
    ],
  };
}

function graphqlUrl(): string | null {
  const explicit = process.env.THEOREM_GRAPHQL_URL;
  if (explicit) return explicit;
  const base = process.env.CONSOLE_HARNESS_URL;
  return base ? `${base.replace(/\/$/, '')}/graphql` : null;
}

function actionOperation(action: ProactivityAction): { readonly query: string; readonly variables: Record<string, unknown> } {
  switch (action.kind) {
    case 'set-node-enabled':
      return {
        query: 'mutation SetNodeEnabled($nodeId: String!, $enabled: Boolean!) { setNodeEnabled(nodeId: $nodeId, enabled: $enabled) { receiptId action nodeId reversible } }',
        variables: { nodeId: action.nodeId, enabled: action.enabled },
      };
    case 'set-judgment-class':
      return {
        query: 'mutation SetJudgmentClass($nodeId: String!, $class: String!) { setJudgmentClass(nodeId: $nodeId, class: $class) { receiptId action nodeId reversible } }',
        variables: { nodeId: action.nodeId, class: action.class },
      };
    case 'set-judgment-thresholds':
      return {
        query: 'mutation SetJudgmentThresholds($nodeId: String!, $thresholds: JSON!) { setJudgmentThresholds(nodeId: $nodeId, thresholds: $thresholds) { receiptId action nodeId reversible } }',
        variables: { nodeId: action.nodeId, thresholds: action.thresholds },
      };
    case 'set-watch-sources':
      return {
        query: 'mutation SetWatchSources($nodeId: String!, $sourceIds: [String!]!) { setWatchSources(nodeId: $nodeId, sourceIds: $sourceIds) { receiptId action nodeId reversible } }',
        variables: { nodeId: action.nodeId, sourceIds: action.sourceIds },
      };
    case 'set-watch-condition':
      return {
        query: 'mutation SetWatchCondition($nodeId: String!, $condition: String!) { setWatchCondition(nodeId: $nodeId, condition: $condition) { receiptId action nodeId reversible } }',
        variables: { nodeId: action.nodeId, condition: action.condition },
      };
    case 'set-response-action-class':
      return {
        query: 'mutation SetResponseActionClass($nodeId: String!, $actionClass: String!) { setResponseActionClass(nodeId: $nodeId, actionClass: $actionClass) { receiptId action nodeId reversible } }',
        variables: { nodeId: action.nodeId, actionClass: action.actionClass },
      };
    case 'prune-assumption':
      return {
        query: 'mutation PruneAssumption($stakeId: String!, $assumptionId: String!) { pruneAssumption(stakeId: $stakeId, assumptionId: $assumptionId) { receiptId action nodeId reversible } }',
        variables: { stakeId: action.stakeId, assumptionId: action.assumptionId },
      };
  }
}

async function executeGraphql(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<
  | { readonly ok: true; readonly tenant: string; readonly data: Record<string, unknown> }
  | { readonly ok: false; readonly status: number; readonly error: string }
> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return { ok: false, status: resolution.response.status, error: 'principal_resolution=unauthenticated' };
  }
  const endpoint = graphqlUrl();
  if (!endpoint) return { ok: false, status: 404, error: 'harness_graphql_unconfigured' };
  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY ? { 'x-api-key': process.env.THEOREM_API_KEY } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = await upstream.json().catch(() => null) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message?: unknown }>;
    } | null;
    if (!upstream.ok || payload?.errors || !payload?.data) {
      const detail = payload?.errors?.[0]?.message;
      return {
        ok: false,
        status: upstream.ok ? 502 : upstream.status,
        error: typeof detail === 'string' ? detail : 'harness_graphql_failed',
      };
    }
    return { ok: true, tenant: resolution.principal.tenant, data: payload.data };
  } catch {
    return {
      ok: false,
      status: timeout.didTimeout() ? 504 : 502,
      error: timeout.didTimeout() ? 'harness_graphql_timeout' : 'harness_graphql_unreachable',
    };
  } finally {
    timeout.clear();
  }
}

export async function readProactivityGraph(): Promise<ProactivityRead> {
  if (process.env.NODE_ENV !== 'production' && process.env.CONSOLE_E2E_PROACTIVITY_FIXTURE === '1') {
    const resolution = await resolveHarnessPrincipal();
    if (!resolution.ok) {
      return { ok: false, status: resolution.response.status, error: 'principal_resolution=unauthenticated' };
    }
    return { ok: true, tenant: resolution.principal.tenant, graph: deterministicProactivityGraphFixture() };
  }
  const result = await executeGraphql(PROACTIVITY_GRAPH_QUERY);
  if (!result.ok) return result;
  const graph = result.data.proactivityGraph;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    return { ok: false, status: 502, error: 'harness_graphql_invalid_projection' };
  }
  return { ok: true, tenant: result.tenant, graph: graph as ProactivityGraph };
}

export async function runProactivityAction(action: ProactivityAction): Promise<ProactivityActionResult> {
  const operation = actionOperation(action);
  const mutation = await executeGraphql(operation.query, operation.variables);
  if (!mutation.ok) return mutation;
  const receipt = Object.values(mutation.data)[0];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, status: 502, error: 'harness_graphql_invalid_receipt' };
  }
  const projection = await readProactivityGraph();
  if (!projection.ok) return projection;
  return {
    ok: true,
    tenant: projection.tenant,
    receipt: receipt as ProactivityReceipt,
    graph: projection.graph,
  };
}

function receiptFrom(data: Record<string, unknown>): ProactivityReceipt | null {
  const receipt = Object.values(data)[0];
  return receipt && typeof receipt === 'object' && !Array.isArray(receipt)
    ? receipt as ProactivityReceipt
    : null;
}

/** Stage a validated ACP result under the server-derived principal. The browser
 * never gets this harness mutation or sends the candidate payload back. */
export async function stageProactivityCompilation(
  compilationId: string,
  candidates: readonly ProactivityCompilationCandidate[],
): Promise<ProactivityActionResult> {
  const mutation = await executeGraphql(
    'mutation StageCompilation($compilationId: String!, $candidates: JSON!) { stageCompilation(compilationId: $compilationId, candidates: $candidates) { receiptId action nodeId reversible } }',
    { compilationId, candidates },
  );
  if (!mutation.ok) return mutation;
  const receipt = receiptFrom(mutation.data);
  if (!receipt) return { ok: false, status: 502, error: 'harness_graphql_invalid_receipt' };
  const projection = await readProactivityGraph();
  if (!projection.ok) return projection;
  return { ok: true, tenant: projection.tenant, receipt, graph: projection.graph };
}

export async function commitProactivityCompilation(
  compilationId: string,
): Promise<ProactivityCompilationResult> {
  const mutation = await executeGraphql(
    'mutation CommitCompilation($compilationId: String!) { commitCompilation(compilationId: $compilationId) { receiptId action nodeId reversible } }',
    { compilationId },
  );
  if (!mutation.ok) return mutation;
  const receipt = receiptFrom(mutation.data);
  if (!receipt) return { ok: false, status: 502, error: 'harness_graphql_invalid_receipt' };
  const projection = await readProactivityGraph();
  if (!projection.ok) return projection;
  return { ok: true, tenant: projection.tenant, receipt, graph: projection.graph };
}

export async function discardProactivityCompilation(
  compilationId: string,
): Promise<{ readonly ok: true; readonly tenant: string } | { readonly ok: false; readonly status: number; readonly error: string }> {
  const mutation = await executeGraphql(
    'mutation DiscardCompilation($compilationId: String!) { discardCompilation(compilationId: $compilationId) }',
    { compilationId },
  );
  if (!mutation.ok) return mutation;
  if (Object.values(mutation.data)[0] !== true) {
    return { ok: false, status: 502, error: 'harness_graphql_invalid_discard' };
  }
  return { ok: true, tenant: mutation.tenant };
}
