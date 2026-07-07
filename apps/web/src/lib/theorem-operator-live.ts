/**
 * Live source for the Operator surface (PT-010, harness-console → CommonPlace migration).
 *
 * ADDITIVE to `theorem-operator.ts` (the fixture contract — Codex's lane): this
 * module never edits that file. `buildOperatorStateLive` reuses the exported
 * fixture builder for the parts not yet wired live (gate, shift, drawers), then
 * overrides `tasks` + `bays` + the top-level `source` with live data read from
 * the harness task-node GraphQL.
 *
 * Transport: the CANONICAL commonplace-api HTTP GraphQL — the one store's HTTP
 * door (see docs/architecture/api-topology.md), NOT the harness MCP agent door.
 * `buildOperatorStateLive` runs SERVER-SIDE (the `/api/theorem/operator` route),
 * so it already holds `THEOREM_API_KEY` and posts server-to-server directly to
 * `THEOREM_GRAPHQL_URL` with `x-api-key` — the same endpoint + key the browser
 * proxy `/api/theorem/graphql` forwards to, minus the browser-only proxy hop.
 * `workGraph(runId)` is RUN-SCOPED, so v1 renders a single run selected by
 * `THEOREM_OPERATOR_RUN_ID`. The Operator board is a cross-run aggregate;
 * unioning across runs (or a backend cross-run task view) is the documented
 * follow-up.
 *
 * THE TASK SHAPE IS NOT GUESSED HERE. `commonplace-api` exposes typed `TaskNode`
 * objects (`apps/commonplace-api/schema.graphql` — WorkGraphGql / TaskNodeGql,
 * CI-pinned by the SDL drift gate). The compatibility parser lives ONCE in
 * `./theorem-harness-schema` (pinned to `work_graph.rs`). This module consumes
 * typed `TaskNode`s from `parseWorkGraphTasks` and only DERIVES the Operator
 * view fields (status→lane, claim→head, prerequisites→met/goal). No
 * `Record<string, unknown>` task reads.
 *
 * Fail-open: any missing config, unreachable backend, empty read, or error
 * returns `null` so the `/api/theorem/operator` route keeps rendering fixtures.
 */
import {
  buildOperatorState,
  liveSource,
  type Bay,
  type HeadId,
  type OperatorSource,
  type OperatorState,
  type OperatorTask,
  type Prerequisite,
  type TaskLane,
  type TaskStatus,
} from './theorem-operator';
import { normalizeCommonPlaceGraphqlEndpoint } from './commonplace-instance';
import { parseWorkGraphTasks, type ClaimLease, type NodeStatus, type TaskNode } from './theorem-harness-schema';

const WORK_GRAPH_QUERY = `query OperatorWorkGraph($runId:String!){
  workGraph(runId:$runId){
    ok
    run
    tasks {
      id
      runId
      parentId
      nodeType
      goal
      prerequisites
      fileScope
      status
      claim {
        owner
        epoch
        grantedAt
        expiresAt
        lastHeartbeat
      }
      claimEpoch
      receipts {
        kind
        command
        baseCommit
        claimedStatus
        verifiedStatus
        artifactHash
      }
      createdBy
      reviewRequiredBy
    }
  }
}`;

export async function buildOperatorStateLive(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<OperatorState | null> {
  const runId = text(env.THEOREM_OPERATOR_RUN_ID);
  if (!runId) return null; // no run selected → route falls back to fixtures

  const { endpoint, apiKey } = graphqlTarget(env);
  const payload = await postWorkGraph(fetchImpl, endpoint, apiKey, runId);
  if (!payload) return null; // unreachable / non-2xx / unparseable → fixtures

  const view = workGraphView(payload);
  if (!view || view.ok === false) return null;

  const src = liveSource('commonplace-api workGraph', `${endpoint} · run ${runId}`);
  const liveTasks = mapWorkGraphTasks(view.tasks, now.getTime(), src);
  if (liveTasks.length === 0) return null; // empty live board → fixtures

  const base = buildOperatorState(env, now, fetchImpl);
  const bays = base.heads.map((head) => bayFromTasks(head.id, head.label, liveTasks, src));
  return {
    ...base,
    source: src,
    tasks: liveTasks,
    bays,
    // gate / shiftSummary / drawers stay fixture (honestly labelled) until wired.
  };
}

/** Resolve the commonplace-api GraphQL endpoint + key from the same env the
 *  `/api/theorem/graphql` proxy uses (`THEOREM_GRAPHQL_URL` / `THEOREM_API_KEY`).
 *  Defaults to the local dev instance so a developer running commonplace-api on
 *  :50090 gets live reads with no extra config. */
function graphqlTarget(env: NodeJS.ProcessEnv): { endpoint: string; apiKey: string } {
  const endpoint =
    normalizeCommonPlaceGraphqlEndpoint(text(env.THEOREM_GRAPHQL_URL) ?? 'http://localhost:50090') ??
    'http://localhost:50090/graphql';
  return { endpoint, apiKey: text(env.THEOREM_API_KEY) ?? 'dev-key' };
}

/** Server-to-server GraphQL POST to commonplace-api. Returns the parsed JSON
 *  body, or `null` on any transport / HTTP / parse failure so the caller
 *  fails open to fixtures rather than throwing. */
async function postWorkGraph(
  fetchImpl: typeof fetch,
  endpoint: string,
  apiKey: string,
  runId: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ query: WORK_GRAPH_QUERY, variables: { runId } }),
      cache: 'no-store',
    });
  } catch {
    return null; // backend unreachable
  }
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null; // non-JSON body
  }
}

// ---------------------------------------------------------------------------
// WorkGraphView envelope → typed TaskNode[] → OperatorTask[]
// ---------------------------------------------------------------------------

interface WorkGraphView {
  ok: boolean;
  tasks: unknown; // typed GraphQL selection, with legacy JSON tolerated by parser
}

/** Read `workGraph` out of a standard GraphQL response envelope
 *  (`{ data: { workGraph } }`); tolerate a bare `{ workGraph }` root too. A
 *  GraphQL `errors` payload leaves `data.workGraph` absent → null → fixtures. */
function workGraphView(value: unknown): WorkGraphView | null {
  const payload = asRecord(value);
  const data = asRecord(payload?.data) ?? payload;
  const view = asRecord(asRecord(data)?.workGraph);
  if (!view) return null;
  return { ok: view.ok !== false, tasks: view.tasks };
}

function mapWorkGraphTasks(rawTasks: unknown, nowMs: number, source: OperatorSource): OperatorTask[] {
  const nodes = parseWorkGraphTasks(rawTasks);
  // A prerequisite is "met" once its referenced node reaches the terminal
  // accepted status. Cross-reference within the same work graph.
  const acceptedIds = new Set(nodes.filter((n) => n.status === 'accepted').map((n) => n.id).filter(Boolean));
  const goalById = new Map<string, string>();
  for (const n of nodes) {
    if (n.id) goalById.set(n.id, taskGoal(n, n.id));
  }
  return nodes.map((node, index) => operatorTaskFromNode(node, index, nowMs, source, acceptedIds, goalById));
}

function operatorTaskFromNode(
  node: TaskNode,
  index: number,
  nowMs: number,
  source: OperatorSource,
  acceptedIds: Set<string>,
  goalById: Map<string, string>,
): OperatorTask {
  const id = node.id || `task_${index}`;
  const claim = claimFrom(node.claim, nowMs);

  const prerequisites: Prerequisite[] = node.prerequisites.map((prereqId) => ({
    taskId: prereqId,
    goal: goalById.get(prereqId) ?? prereqId,
    met: acceptedIds.has(prereqId),
  }));

  return {
    id,
    goal: taskGoal(node, id),
    lane: laneFromNodeStatus(node.status),
    status: mapStatus(node.status),
    priority: index, // TaskNode carries no priority; array order is the honest default
    prerequisites,
    claim,
    ageMs: claim ? Math.max(0, nowMs - Date.parse(claim.claimedAt)) : 0,
    laneChip: node.node_type || undefined,
    fileScope: node.file_scope,
    runId: node.run_id || undefined,
    source,
    // checklist omitted: TaskNode has no checklist; receipts are proofs, not marks.
  };
}

function bayFromTasks(head: HeadId, label: string, tasks: OperatorTask[], source: OperatorSource): Bay {
  const claimed = tasks.find((t) => t.lane === 'now' && t.claim?.head === head) ?? null;
  return {
    head,
    label,
    task: claimed,
    streaming: false, // live presence stream not wired yet
    prLight: claimed ? 'open' : 'none',
    source,
  };
}

// ---------------------------------------------------------------------------
// Derivations: NodeStatus → Operator view fields (the node itself is authoritative)
// ---------------------------------------------------------------------------

/** Map the harness NodeStatus to the Operator card status. `rejected` is a
 *  terminal negative with no OperatorTask analogue; it lands in `done`. */
function mapStatus(status: NodeStatus): TaskStatus {
  switch (status) {
    case 'claimed':
      return 'claimed';
    case 'patch_proposed':
    case 'verifying':
      return 'review';
    case 'accepted':
    case 'rejected':
      return 'done';
    case 'open':
    default:
      return 'queued';
  }
}

/** Board lane from NodeStatus: terminal → done, actively owned/in-flight → now,
 *  otherwise queued in next. Blocked-ness is derived separately in the UI from
 *  unmet prerequisites, matching the fixture contract. */
function laneFromNodeStatus(status: NodeStatus): TaskLane {
  switch (status) {
    case 'accepted':
    case 'rejected':
      return 'done';
    case 'claimed':
    case 'patch_proposed':
    case 'verifying':
      return 'now';
    case 'open':
    default:
      return 'next';
  }
}

function taskGoal(node: TaskNode, fallback: string): string {
  return node.goal || fallback;
}

/** ClaimLease → the Operator claim shape. `owner` is the head; `granted_at` is
 *  epoch-ms (the kernel's logical time). */
function claimFrom(lease: ClaimLease | null, nowMs: number): OperatorTask['claim'] {
  if (!lease) return undefined;
  return {
    head: lease.owner as HeadId,
    claimedAt: new Date(lease.granted_at || nowMs).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Envelope readers only (the task contract lives in theorem-harness-schema)
// ---------------------------------------------------------------------------

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
