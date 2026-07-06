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
 * `x-api-key` proxy. The `workGraph(runId)` read is RUN-SCOPED, so v1 renders a
 * single run selected by `THEOREM_OPERATOR_RUN_ID`. The Operator board is a
 * cross-run aggregate; unioning across runs (or a backend cross-run task view)
 * is the documented follow-up. The task-node payload is opaque `JSON!`, so the
 * mapper reads it defensively (house style: `x ?? y ?? …`) and awaits
 * validation against a populated run.
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
  const liveTasks = view.tasks
    .map((node, index) => operatorTaskFromNode(node, index, now.getTime(), src))
    .filter(nonNull);
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
// WorkGraphView → OperatorTask mapping (opaque JSON — read defensively)
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

const TASK_STATUSES: readonly TaskStatus[] = ['queued', 'claimed', 'blocked', 'review', 'done', 'deferred'];
const TASK_LANES: readonly TaskLane[] = ['now', 'next', 'icebox', 'done'];

function operatorTaskFromNode(
  value: unknown,
  index: number,
  nowMs: number,
  source: OperatorSource,
): OperatorTask | null {
  const node = asRecord(value);
  if (!node) return null;

  const id = text(node.id) ?? text(node.node_id) ?? text(node.nodeId) ?? text(node.task_id) ?? `task_${index}`;
  const goal = text(node.goal) ?? text(node.title) ?? text(node.name) ?? text(node.summary) ?? id;
  const status = normalizeStatus(text(node.status) ?? text(node.state));
  const lane = normalizeLane(text(node.lane)) ?? laneFromStatus(status);
  const priority = num(node.priority) ?? num(node.order) ?? index;
  const claimHead = text(node.head) ?? text(node.assignee) ?? text(asRecord(node.claim)?.head);
  const claimedAt = text(asRecord(node.claim)?.claimedAt) ?? text(node.claimed_at) ?? text(node.claimedAt);
  const createdAt = text(node.created_at) ?? text(node.createdAt) ?? text(node.updated_at) ?? text(node.updatedAt);

  const checklist = asRecord(node.checklist);
  const done = num(checklist?.done);
  const totalRaw = num(checklist?.total);

  return {
    id,
    goal,
    lane,
    status,
    priority,
    prerequisites: [], // opaque payload has no verified prereq shape yet → tolerant empty
    claim: claimHead ? { head: claimHead as HeadId, claimedAt: claimedAt ?? new Date(nowMs).toISOString() } : undefined,
    ageMs: ageMsFrom(createdAt, nowMs),
    checklist: done !== undefined && totalRaw !== undefined ? { done, total: totalRaw } : undefined,
    source,
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
// Normalizers + tolerant readers (mirrors theorem-control-center house style)
// ---------------------------------------------------------------------------

function normalizeStatus(value: string | undefined): TaskStatus {
  if (value && (TASK_STATUSES as readonly string[]).includes(value)) return value as TaskStatus;
  switch (value) {
    case 'in_progress':
    case 'active':
    case 'running':
      return 'claimed';
    case 'in_review':
    case 'reviewing':
      return 'review';
    case 'completed':
    case 'merged':
      return 'done';
    case 'icebox':
    case 'parked':
      return 'deferred';
    default:
      return 'queued';
  }
}

function normalizeLane(value: string | undefined): TaskLane | null {
  if (value && (TASK_LANES as readonly string[]).includes(value)) return value as TaskLane;
  return null;
}

function laneFromStatus(status: TaskStatus): TaskLane {
  switch (status) {
    case 'claimed':
      return 'now';
    case 'done':
      return 'done';
    case 'deferred':
      return 'icebox';
    default:
      return 'next';
  }
}

function ageMsFrom(iso: string | undefined, nowMs: number): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.max(0, nowMs - t);
}

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

function nonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
