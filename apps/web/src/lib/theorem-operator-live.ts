/**
 * Live source for the Operator surface (PT-010, harness-console → CommonPlace migration).
 *
 * ADDITIVE to `theorem-operator.ts` (the fixture contract — Codex's lane): this
 * module never edits that file. `buildOperatorStateLive` reuses the exported
 * fixture builder for the parts not yet wired live (gate, shift, drawers), then
 * overrides `tasks` + `bays` + the top-level `source` with live data read from
 * the harness task-node GraphQL. It mirrors `buildTheoremControlCenterStateLive`
 * / `fetchMemorySnapshot`: `callMcpTool('graphql_query')` over the harness MCP.
 *
 * Transport: the harness MCP (`THEOREM_MCP_URL` / token via the shared
 * `mcpEndpointUrl` / `mcpAuthToken` resolvers) — NOT the commonplace-api
 * `x-api-key` proxy. `workGraph(runId)` is RUN-SCOPED, so v1 renders a single
 * run selected by `THEOREM_OPERATOR_RUN_ID`. The Operator board is a cross-run
 * aggregate; unioning across runs (or a backend cross-run task view) is the
 * documented follow-up.
 *
 * The mapper is faithful to the authoritative `TaskNode` shape (source of truth:
 * `theorem-harness-core/src/work_graph.rs`, serialized snake_case). A `TaskNode`
 * carries: `id`, `run_id`, `node_type`, `goal`, `prerequisites: string[]`,
 * `file_scope: string[]`, `status: NodeStatus` (open|claimed|patch_proposed|
 * verifying|accepted|rejected), `claim: { owner, granted_at, ... } | null`,
 * `created_by`, `review_required_by`. It has NO title / lane / priority /
 * checklist / *_ms timestamp fields — those are derived or defaulted here.
 *
 * Fail-open: any missing config, empty read, or error returns `null` so the
 * `/api/theorem/operator` route keeps rendering the fixtures.
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
import { callMcpTool, mcpAuthToken, mcpEndpointUrl } from './theorem-control-center';

const WORK_GRAPH_QUERY = `query OperatorWorkGraph($runId:String!){
  workGraph(runId:$runId){ ok run graph tasks }
}`;

export async function buildOperatorStateLive(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<OperatorState | null> {
  const runId = text(env.THEOREM_OPERATOR_RUN_ID);
  if (!runId) return null; // no run selected → route falls back to fixtures

  const endpoint = mcpEndpointUrl(env);
  const response = await callMcpTool(
    fetchImpl,
    endpoint,
    'graphql_query',
    { query: WORK_GRAPH_QUERY, variables: { runId } },
    mcpAuthToken(env),
  );
  if (!response.ok) return null;

  const view = workGraphView(response.value);
  if (!view || view.ok === false) return null;

  const src = liveSource('harness workGraph', `${endpoint} · run ${runId}`);
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

// ---------------------------------------------------------------------------
// WorkGraphView → OperatorTask[] — faithful to the TaskNode serde shape
// ---------------------------------------------------------------------------

interface WorkGraphView {
  ok: boolean;
  tasks: unknown[];
}

function workGraphView(value: unknown): WorkGraphView | null {
  const payload = asRecord(value);
  const data = asRecord(payload?.data) ?? asRecord(asRecord(payload?.result)?.data) ?? payload;
  const view = asRecord(asRecord(data)?.workGraph);
  if (!view) return null;
  return { ok: view.ok !== false, tasks: asArray(view.tasks) };
}

function mapWorkGraphTasks(rawTasks: unknown[], nowMs: number, source: OperatorSource): OperatorTask[] {
  const nodes = rawTasks.map(unwrapTaskNode).filter(nonNull);
  // A prerequisite is "met" once its referenced node reaches the terminal
  // accepted status. Cross-reference within the same work graph.
  const acceptedIds = new Set(
    nodes.filter((n) => nodeStatus(n) === 'accepted').map((n) => text(n.id)).filter(nonNull),
  );
  const goalById = new Map<string, string>();
  for (const n of nodes) {
    const id = text(n.id);
    if (id) goalById.set(id, taskGoal(n, id));
  }
  return nodes.map((node, index) => operatorTaskFromNode(node, index, nowMs, source, acceptedIds, goalById));
}

/** Aggregate `workGraph.tasks` serializes raw TaskNodes; singular mutation
 *  returns wrap as `{ task: TaskNode }`. Tolerate both. */
function unwrapTaskNode(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record) return null;
  const wrapped = asRecord(record.task);
  return wrapped ?? record;
}

function operatorTaskFromNode(
  node: Record<string, unknown>,
  index: number,
  nowMs: number,
  source: OperatorSource,
  acceptedIds: Set<string>,
  goalById: Map<string, string>,
): OperatorTask {
  const id = text(node.id) ?? `task_${index}`;
  const status = mapStatus(nodeStatus(node));
  const lane = laneFromNodeStatus(nodeStatus(node));
  const claim = claimFrom(node.claim, nowMs);

  const prerequisites: Prerequisite[] = asStringArray(node.prerequisites).map((prereqId) => ({
    taskId: prereqId,
    goal: goalById.get(prereqId) ?? prereqId,
    met: acceptedIds.has(prereqId),
  }));

  return {
    id,
    goal: taskGoal(node, id),
    lane,
    status,
    priority: index, // TaskNode carries no priority; array order is the honest default
    prerequisites,
    claim,
    ageMs: claim ? Math.max(0, nowMs - Date.parse(claim.claimedAt)) : 0,
    laneChip: text(node.node_type) ?? undefined,
    fileScope: asStringArray(node.file_scope),
    runId: text(node.run_id) ?? undefined,
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
// NodeStatus (open|claimed|patch_proposed|verifying|accepted|rejected) mapping
// ---------------------------------------------------------------------------

function nodeStatus(node: Record<string, unknown>): string {
  return (text(node.status) ?? 'open').toLowerCase();
}

/** Map the harness NodeStatus to the Operator card status. `rejected` is a
 *  terminal negative with no OperatorTask analogue; it lands in `done`. */
function mapStatus(raw: string): TaskStatus {
  switch (raw) {
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
function laneFromNodeStatus(raw: string): TaskLane {
  switch (raw) {
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

function taskGoal(node: Record<string, unknown>, fallback: string): string {
  return text(node.goal) ?? text(node.title) ?? text(node.name) ?? text(node.summary) ?? fallback;
}

/** ClaimLease → the Operator claim shape. `owner` is the head; `granted_at` is
 *  epoch-ms (the kernel's logical time). */
function claimFrom(value: unknown, nowMs: number): OperatorTask['claim'] {
  const claim = asRecord(value);
  const owner = text(claim?.owner) ?? text(claim?.head);
  if (!owner) return undefined;
  const grantedAt = num(claim?.granted_at) ?? num(claim?.grantedAt);
  return {
    head: owner as HeadId,
    claimedAt: new Date(grantedAt ?? nowMs).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tolerant readers (mirrors theorem-control-center house style)
// ---------------------------------------------------------------------------

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map((v) => text(v))
    .filter(nonNull);
}

function nonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
