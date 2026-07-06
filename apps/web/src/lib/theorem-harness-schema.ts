/**
 * Typed mirror of the harness work-graph wire contract — the single place the
 * frontend is allowed to know the shape of `workGraph.tasks`.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Theorem now exposes `workGraph(runId){ tasks { ... } }` as typed GraphQL
 * `TaskNode` objects. Older deployments exposed the same bytes as an opaque
 * `Json` scalar (`rustyred-thg-mcp/src/graphql/coordination.rs`, `WorkGraphView`)
 * by forwarding raw serde `TaskNode` structs:
 *
 *   rustyredcore_THG/crates/rustyred-thg-mcp/src/lib.rs:13230
 *     "tasks": graph.nodes.values().collect::<Vec<_>>()
 *
 * This module remains the compatibility parser until all deployed backends and
 * generated clients have moved to the typed GraphQL object. No surface should
 * re-guess the task-node shape.
 *
 * SOURCE OF TRUTH (keep in sync if the Rust changes):
 *   theorem-harness-core/src/work_graph.rs  — TaskNode, NodeStatus, ClaimLease, Receipt
 *   (serde `rename_all = "snake_case"`; `Millis = u64`, i.e. epoch-ms numbers)
 *
 * Once codegen consumes the typed GraphQL object everywhere, this file can
 * shrink to generated types or disappear. See the harness-console migration
 * plan, "Backend result: typed workGraph.tasks".
 */

/**
 * `NodeStatus` (work_graph.rs). serde snake_case. `accepted` / `rejected` are
 * terminal. This is the vocabulary `tasks[].status` emits — NOT a UI vocabulary.
 */
export const NODE_STATUSES = [
  'open',
  'claimed',
  'patch_proposed',
  'verifying',
  'accepted',
  'rejected',
] as const;

export type NodeStatus = (typeof NODE_STATUSES)[number];

const NODE_STATUS_SET = new Set<string>(NODE_STATUSES);

/** Terminal statuses: a node here is never re-claimable (work_graph.rs). */
export function isTerminalStatus(status: NodeStatus): boolean {
  return status === 'accepted' || status === 'rejected';
}

/** A head's lease on a node. `owner` is the head id; the `*_at` fields are
 *  logical epoch-milliseconds (`Millis = u64`), passed into the pure kernel. */
export interface ClaimLease {
  owner: string;
  epoch: number;
  granted_at: number;
  expires_at: number;
  last_heartbeat: number;
}

/** Completion proof attached to a node (work_graph.rs `Receipt`). */
export interface Receipt {
  kind: string;
  command: string;
  base_commit: string;
  claimed_status: string;
  verified_status: string | null;
  artifact_hash: string;
}

/**
 * A unit of work in a run — the exact serde shape of `TaskNode` on the wire.
 *
 * Deliberately snake_case to match the bytes. It has NO title / lane / priority
 * / checklist / ISO-timestamp fields; UI concepts like those are DERIVED by the
 * consumer, never read off the node. `goal` is the human label; `node_type`
 * keys the skill-pack motor program; `file_scope` is a routing hint, not a lock.
 */
export interface TaskNode {
  id: string;
  run_id: string;
  parent_id: string | null;
  node_type: string;
  goal: string;
  prerequisites: string[];
  file_scope: string[];
  status: NodeStatus;
  claim: ClaimLease | null;
  claim_epoch: number;
  receipts: Receipt[];
  created_by: string;
  review_required_by: string | null;
}

// ---------------------------------------------------------------------------
// Tolerant parsers — the ONLY place `unknown` meets the TaskNode contract.
// Consumers get typed `TaskNode`s and never touch `Record<string, unknown>`.
// ---------------------------------------------------------------------------

/** Coerce a wire status to the `NodeStatus` union, case-insensitively, defaulting
 *  unknown/absent to `open` (the kernel's initial state). */
export function toNodeStatus(value: unknown): NodeStatus {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return NODE_STATUS_SET.has(raw) ? (raw as NodeStatus) : 'open';
}

/**
 * Parse one wire value into a `TaskNode`. Tolerates both the aggregate form
 * (`workGraph.tasks[i]` = a raw TaskNode) and the singular-mutation wrapper
 * (`createTaskNode` returns `{ task: TaskNode }`). Returns `null` only when the
 * value is not an object — every other field is coerced with a serde-faithful
 * default so a partial node never throws downstream.
 */
export function parseTaskNode(value: unknown): TaskNode | null {
  const outer = asRecord(value);
  if (!outer) return null;
  const node = asRecord(outer.task) ?? outer; // unwrap { task: ... } if present

  return {
    id: str(node.id),
    run_id: str(node.run_id ?? node.runId),
    parent_id: strOrNull(node.parent_id ?? node.parentId),
    node_type: str(node.node_type ?? node.nodeType),
    goal: str(node.goal),
    prerequisites: strArray(node.prerequisites),
    file_scope: strArray(node.file_scope ?? node.fileScope),
    status: toNodeStatus(node.status),
    claim: parseClaimLease(node.claim),
    claim_epoch: numOr(node.claim_epoch ?? node.claimEpoch, 0),
    receipts: asArray(node.receipts)
      .map(parseReceipt)
      .filter((r): r is Receipt => r !== null),
    created_by: str(node.created_by ?? node.createdBy),
    review_required_by: strOrNull(node.review_required_by ?? node.reviewRequiredBy),
  };
}

/** Parse the `workGraph.tasks` array into typed nodes, dropping non-objects. */
export function parseWorkGraphTasks(tasks: unknown): TaskNode[] {
  return asArray(tasks)
    .map(parseTaskNode)
    .filter((n): n is TaskNode => n !== null);
}

function parseClaimLease(value: unknown): ClaimLease | null {
  const claim = asRecord(value);
  if (!claim) return null;
  const owner = str(claim.owner ?? claim.head);
  if (!owner) return null; // a lease with no owner is not a hold
  return {
    owner,
    epoch: numOr(claim.epoch, 0),
    granted_at: numOr(claim.granted_at ?? claim.grantedAt, 0),
    expires_at: numOr(claim.expires_at ?? claim.expiresAt, 0),
    last_heartbeat: numOr(claim.last_heartbeat ?? claim.lastHeartbeat, 0),
  };
}

function parseReceipt(value: unknown): Receipt | null {
  const r = asRecord(value);
  if (!r) return null;
  return {
    kind: str(r.kind),
    command: str(r.command),
    base_commit: str(r.base_commit ?? r.baseCommit),
    claimed_status: str(r.claimed_status ?? r.claimedStatus),
    verified_status: strOrNull(r.verified_status ?? r.verifiedStatus),
    artifact_hash: str(r.artifact_hash ?? r.artifactHash),
  };
}

// --- primitive coercions (kept private; the contract is the parsers above) ---

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function strArray(value: unknown): string[] {
  return asArray(value).filter((v): v is string => typeof v === 'string');
}

function numOr(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}
