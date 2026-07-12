/**
 * Live source for the Operator surface (PT-010, harness-console → CommonPlace migration).
 *
 * `loadOperatorStateLive` maps the tenant-bound Harness GraphQL contract onto
 * the Operator DTO. Static shell metadata is assembled here, and every
 * user-data section comes from the live contract, including the honest empty
 * state.
 *
 * Transport: `graphql_query` and `graphql_mutate` over the Harness MCP endpoint.
 * The bearer token resolves the tenant principal; GraphQL intentionally has no
 * tenant argument. `workGraph` is run-scoped and requires
 * `THEOREM_OPERATOR_RUN_ID`.
 *
 * THE TASK SHAPE IS NOT GUESSED HERE. The Harness GraphQL schema exposes typed
 * `TaskNode` objects. The compatibility parser lives ONCE in
 * `./theorem-harness-schema` (pinned to `work_graph.rs`). This module consumes
 * typed `TaskNode`s from `parseWorkGraphTasks` and only DERIVES the Operator
 * view fields (status→lane, claim→head, prerequisites→met/goal). No
 * `Record<string, unknown>` task reads.
 *
 * Missing config or an upstream error is returned explicitly to the route. No
 * user-reachable production path falls back to deterministic fixture state.
 */
import {
  handleOperatorActionForState,
  liveSource,
  type Bay,
  type GateCard,
  type HeadId,
  type OperatorActionResult,
  type OperatorLiveContract,
  type OperatorSource,
  type OperatorState,
  type OperatorTask,
  type Prerequisite,
  type RegisteredHead,
  type RunDrawer,
  type ShiftSummary,
  type TaskLane,
  type TaskStatus,
  type VerifyItem,
} from './theorem-operator';
import { callMcpTool, mcpAuthToken, mcpEndpointUrl } from './theorem-control-center';
import { parseWorkGraphTasks, type ClaimLease, type NodeStatus, type Receipt, type TaskNode } from './theorem-harness-schema';

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

const CLAIM_TASK_MUTATION = `mutation OperatorClaimTask(
  $runId:String!
  $nodeId:String!
  $owner:String!
  $actor:String!
  $expectedEpoch:Int!
){
  claimTaskNode(
    runId:$runId
    nodeId:$nodeId
    owner:$owner
    actor:$actor
    action:"claim"
    expectedEpoch:$expectedEpoch
  )
}`;

const PUBLISH_ROOM_MESSAGE_MUTATION = `mutation OperatorRoomMessage(
  $stream:String!
  $actor:String!
  $payload:JSON!
  $targetActor:String
){
  publishCoordinationEvent(
    stream:$stream
    actor:$actor
    kind:"operator-room-message"
    payload:$payload
    urgency:"info"
    targetActor:$targetActor
  ){
    ok
    stream
    eventId
    orderingToken
    pinged
    createdAt
  }
}`;

const CLAIM_AUDIT_MUTATION = `mutation OperatorClaimAudit(
  $roomId:String!
  $actor:String!
  $summary:String!
  $metadata:JSON!
){
  writeCoordinationRecord(
    roomId:$roomId
    actor:$actor
    recordType:"event"
    summary:$summary
    metadata:$metadata
  )
}`;

const GRAPH_NODE_RECEIPT_QUERY = `query OperatorReceiptNode($nodeId:ID!){
  graphNode(id:$nodeId)
}`;

export type OperatorLiveStateResult =
  | { ok: true; state: OperatorState; contract: OperatorLiveContract }
  | {
      ok: false;
      error: 'operator_live_not_configured' | 'operator_live_upstream_failed' | 'operator_live_invalid_response';
      message: string;
      tenant: string;
      requestId: string;
    };

export async function buildOperatorStateLive(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<OperatorState | null> {
  const result = await loadOperatorStateLive(env, now, fetchImpl, 'operator-live');
  return result.ok ? result.state : null;
}

export async function loadOperatorStateLive(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  fetchImpl: typeof fetch = globalThis.fetch,
  requestId = 'operator-live',
): Promise<OperatorLiveStateResult> {
  const tenant = text(env.THEOREM_TENANT_SLUG) ?? text(env.THEOREM_HARNESS_TENANT_SLUG) ?? 'Travis-Gilbert';
  const runId = text(env.THEOREM_OPERATOR_RUN_ID);
  if (!runId) {
    return {
      ok: false,
      error: 'operator_live_not_configured',
      message: 'THEOREM_OPERATOR_RUN_ID is required for the run-scoped workGraph contract.',
      tenant,
      requestId,
    };
  }

  const endpoint = mcpEndpointUrl(env);
  const token = mcpAuthToken(env);
  if (env.NODE_ENV === 'production' && !token) {
    return {
      ok: false,
      error: 'operator_live_not_configured',
      message: 'A tenant-bound Harness MCP token is required in production.',
      tenant,
      requestId,
    };
  }

  const response = await callMcpTool(fetchImpl, endpoint, 'graphql_query', {
    query: WORK_GRAPH_QUERY,
    variables: { runId },
  }, token);
  if (!response.ok) {
    return {
      ok: false,
      error: 'operator_live_upstream_failed',
      message: response.error ?? `Harness MCP request failed with status ${response.status}.`,
      tenant,
      requestId,
    };
  }

  const graphqlError = graphqlErrorMessage(response.value);
  const view = graphqlError ? null : workGraphView(response.value);
  const contractError = view ? workGraphContractError(view, tenant, runId) : null;
  if (!view || contractError) {
    return {
      ok: false,
      error: 'operator_live_invalid_response',
      message: graphqlError ?? contractError ?? 'Harness MCP returned no usable workGraph.',
      tenant,
      requestId,
    };
  }

  const resolvedTenant = text(view.run.tenant_slug ?? view.run.tenantSlug) as string;
  const contract: OperatorLiveContract = { endpoint, tenant: resolvedTenant, runId, requestId };
  const src = liveSource('Harness MCP workGraph', `${endpoint} · tenant ${resolvedTenant} · run ${runId}`);
  // Nodes without a stable `id` cannot be keyed by drawers/gate/shift lookups
  // downstream, so drop them at the boundary instead of coining a synthetic id
  // that would silently diverge from the harness contract.
  const liveNodes = parseWorkGraphTasks(view.tasks);
  const liveTasks = mapTaskNodes(liveNodes, now.getTime(), src);
  const heads = operatorHeads(env, liveNodes);
  const bays = heads.map((head) => bayFromTasks(head.id, head.label, liveTasks, src));
  const state: OperatorState = {
    generatedAt: now.toISOString(),
    targetSurface: 'app.theoremharness.com',
    contract,
    source: src,
    heads,
    tasks: liveTasks,
    bays,
    gate: gateFromNodes(liveNodes, liveTasks, src),
    shiftSummary: shiftFromTasks(liveNodes, liveTasks, now, src),
    drawers: drawersFromNodes(liveNodes, liveTasks, src),
  };

  return { ok: true, state, contract };
}

export async function handleOperatorActionLive(
  body: unknown,
  state: OperatorState,
  contract: OperatorLiveContract,
  actor: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<OperatorActionResult> {
  const validated = handleOperatorActionForState(body, state);
  if (!validated.ok) return validated;

  switch (validated.action) {
    case 'refresh_drawer':
      return validated;
    case 'send_to_bay':
      return claimTask(body, state, contract, actor, env, now, fetchImpl, validated);
    case 'send_room_message':
      return publishRoomMessage(body, state, contract, actor, env, now, fetchImpl, validated);
    case 'reorder_queue':
    case 'gate_pass':
    case 'gate_bounce':
      return {
        ok: false,
        action: validated.action,
        error: 'mutation_not_implemented',
        message: `${validated.action} has no durable Harness mutation and was not applied.`,
      };
    case 'unknown':
      return validated;
  }
}

async function claimTask(
  body: unknown,
  state: OperatorState,
  contract: OperatorLiveContract,
  actor: string,
  env: NodeJS.ProcessEnv,
  now: Date,
  fetchImpl: typeof fetch,
  validated: OperatorActionResult,
): Promise<OperatorActionResult> {
  const action = asRecord(body);
  const taskId = text(action?.taskId);
  const owner = text(action?.head);
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task || !owner || !task.runId) {
    return mutationFailure('send_to_bay', 'The live task is missing its task id, run id, or owner.');
  }

  const response = await callMcpTool(fetchImpl, contract.endpoint, 'graphql_mutate', {
    query: CLAIM_TASK_MUTATION,
    variables: {
      runId: task.runId,
      nodeId: task.id,
      owner,
      actor,
      expectedEpoch: task.claimEpoch ?? 0,
    },
  }, mcpAuthToken(env));
  if (!response.ok) {
    return mutationFailure('send_to_bay', response.error ?? `Harness mutation failed with status ${response.status}.`);
  }

  const data = asRecord(asRecord(response.value)?.data);
  const claim = asRecord(data?.claimTaskNode);
  const returnedTenant = text(claim?.tenant);
  if (!returnedTenant || !sameTenant(returnedTenant, contract.tenant)) {
    return {
      ok: false,
      action: 'send_to_bay',
      error: 'tenant_mismatch',
      message: `Claim receipt tenant did not match ${contract.tenant}.`,
    };
  }

  const returnedTask = asRecord(claim?.task);
  const returnedClaim = asRecord(returnedTask?.claim);
  const returnedTaskId = text(returnedTask?.id);
  const returnedRunId = text(returnedTask?.run_id ?? returnedTask?.runId);
  const returnedOwner = text(returnedClaim?.owner);
  const epoch = integer(returnedTask?.claim_epoch ?? returnedTask?.claimEpoch);
  if (
    claim?.ok !== true ||
    returnedTaskId !== task.id ||
    returnedRunId !== task.runId ||
    returnedOwner !== owner ||
    epoch === null
  ) {
    return mutationFailure(
      'send_to_bay',
      graphqlErrorMessage(response.value) ?? 'Harness did not acknowledge the requested task claim.',
    );
  }

  const receipt = claimReceipt(contract, task.runId, task.id, epoch, now, false);
  const audit = await writeAndVerifyClaimAudit(
    contract,
    task.id,
    task.runId,
    owner,
    epoch,
    actor,
    env,
    fetchImpl,
  );
  if (!audit.ok) {
    return mutationFailure(
      'send_to_bay',
      `Claim was acknowledged but its caller audit failed: ${audit.message}`,
      receipt,
    );
  }
  receipt.auditId = audit.recordId;

  const verification = await loadOperatorStateLive(env, now, fetchImpl, contract.requestId);
  if (!verification.ok) {
    return mutationFailure(
      'send_to_bay',
      `Claim was acknowledged but query-back failed: ${verification.message}`,
      receipt,
    );
  }
  const verifiedTask = verification.state.tasks.find((candidate) => candidate.id === task.id);
  if (
    !verifiedTask ||
    verifiedTask.runId !== task.runId ||
    verifiedTask.claim?.head !== owner ||
    verifiedTask.claimEpoch !== epoch
  ) {
    return mutationFailure(
      'send_to_bay',
      'Claim was acknowledged but the workGraph query-back did not match it.',
      receipt,
    );
  }

  return {
    ...validated,
    receipt: { ...receipt, verified: true, verifiedAt: now.toISOString() },
  };
}

async function publishRoomMessage(
  body: unknown,
  state: OperatorState,
  contract: OperatorLiveContract,
  actor: string,
  env: NodeJS.ProcessEnv,
  now: Date,
  fetchImpl: typeof fetch,
  validated: OperatorActionResult,
): Promise<OperatorActionResult> {
  const action = asRecord(body);
  const taskId = text(action?.taskId);
  const message = text(action?.text);
  const mention = text(action?.mention);
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (!task || !message) {
    return mutationFailure('send_room_message', 'The live task or room message is missing.');
  }

  const variables: Record<string, unknown> = {
    stream: task.id,
    actor,
    payload: {
      taskId: task.id,
      runId: task.runId,
      message,
    },
  };
  if (mention) variables.targetActor = mention;

  const response = await callMcpTool(fetchImpl, contract.endpoint, 'graphql_mutate', {
    query: PUBLISH_ROOM_MESSAGE_MUTATION,
    variables,
  }, mcpAuthToken(env));
  if (!response.ok) {
    return mutationFailure(
      'send_room_message',
      response.error ?? `Harness mutation failed with status ${response.status}.`,
    );
  }

  const data = asRecord(asRecord(response.value)?.data);
  const published = asRecord(data?.publishCoordinationEvent);
  const eventId = text(published?.eventId);
  const orderingToken = integer(published?.orderingToken);
  if (
    published?.ok !== true ||
    !eventId ||
    orderingToken === null ||
    text(published.stream) !== task.id
  ) {
    return mutationFailure(
      'send_room_message',
      graphqlErrorMessage(response.value) ?? 'Harness did not return a durable stream event id.',
    );
  }

  const receipt = streamReceipt(contract, eventId, now, false);
  const nodeId = coordinationStreamEventNodeId(contract.tenant, task.id, orderingToken);
  const verification = await callMcpTool(fetchImpl, contract.endpoint, 'graphql_query', {
    query: GRAPH_NODE_RECEIPT_QUERY.replace('OperatorReceiptNode', 'OperatorRoomReceipt'),
    variables: { nodeId },
  }, mcpAuthToken(env));
  if (!verification.ok) {
    return mutationFailure(
      'send_room_message',
      `Room event was acknowledged but query-back failed with status ${verification.status}.`,
      receipt,
    );
  }
  if (!roomEventVerified(verification.value, nodeId, eventId, task.id, actor, message, task.runId)) {
    return mutationFailure(
      'send_room_message',
      'Room event was acknowledged but the coordination stream query-back did not match it.',
      receipt,
    );
  }

  return {
    ...validated,
    receipt: { ...receipt, verified: true, verifiedAt: now.toISOString() },
  };
}

function mutationFailure(
  action: OperatorActionResult['action'],
  message: string,
  receipt?: OperatorActionResult['receipt'],
): OperatorActionResult {
  return { ok: false, action, error: 'mutation_failed', message, receipt };
}

function claimReceipt(
  contract: OperatorLiveContract,
  runId: string,
  taskId: string,
  epoch: number,
  now: Date,
  verified: boolean,
): NonNullable<OperatorActionResult['receipt']> {
  return {
    id: `claim:${runId}:${taskId}:${epoch}`,
    mutation: 'claimTaskNode',
    tenant: contract.tenant,
    requestId: contract.requestId,
    acknowledgedAt: now.toISOString(),
    verified,
  };
}

function streamReceipt(
  contract: OperatorLiveContract,
  eventId: string,
  now: Date,
  verified: boolean,
): NonNullable<OperatorActionResult['receipt']> {
  return {
    id: eventId,
    mutation: 'publishCoordinationEvent',
    tenant: contract.tenant,
    requestId: contract.requestId,
    acknowledgedAt: now.toISOString(),
    verified,
  };
}

type ClaimAuditResult =
  | { ok: true; recordId: string }
  | { ok: false; message: string };

async function writeAndVerifyClaimAudit(
  contract: OperatorLiveContract,
  taskId: string,
  runId: string,
  owner: string,
  epoch: number,
  actor: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<ClaimAuditResult> {
  const metadata = {
    action: 'send_to_bay',
    taskId,
    runId,
    owner,
    epoch,
    requestId: contract.requestId,
  };
  const response = await callMcpTool(fetchImpl, contract.endpoint, 'graphql_mutate', {
    query: CLAIM_AUDIT_MUTATION,
    variables: {
      roomId: taskId,
      actor,
      summary: `Operator claimed ${taskId} for ${owner} at epoch ${epoch}.`,
      metadata,
    },
  }, mcpAuthToken(env));
  if (!response.ok) {
    return { ok: false, message: response.error ?? `audit mutation failed with status ${response.status}` };
  }

  const data = asRecord(asRecord(response.value)?.data);
  const payload = asRecord(data?.writeCoordinationRecord);
  const record = asRecord(payload?.record);
  const recordId = text(record?.record_id ?? record?.recordId);
  if (
    !recordId ||
    !record ||
    !sameTenant(text(payload?.tenant) ?? '', contract.tenant) ||
    text(payload?.room_id ?? payload?.roomId) !== taskId ||
    !claimAuditMatches(record, actor, metadata)
  ) {
    return { ok: false, message: 'audit mutation acknowledgement did not match the claim' };
  }

  const nodeId = coordinationRecordNodeId(contract.tenant, taskId, recordId);
  const verification = await callMcpTool(fetchImpl, contract.endpoint, 'graphql_query', {
    query: GRAPH_NODE_RECEIPT_QUERY.replace('OperatorReceiptNode', 'OperatorClaimAuditReceipt'),
    variables: { nodeId },
  }, mcpAuthToken(env));
  if (!verification.ok) {
    return { ok: false, message: `audit query-back failed with status ${verification.status}` };
  }
  const graphNode = asRecord(asRecord(asRecord(verification.value)?.data)?.graphNode);
  const properties = asRecord(graphNode?.properties);
  if (
    text(graphNode?.id) !== nodeId ||
    !properties ||
    !claimAuditMatches(properties, actor, metadata)
  ) {
    return { ok: false, message: 'audit graph-node query-back did not match the claim' };
  }
  return { ok: true, recordId };
}

function claimAuditMatches(
  record: Record<string, unknown>,
  actor: string,
  metadata: Record<string, unknown>,
): boolean {
  const actual = asRecord(record.metadata);
  return (
    text(record.actor_id ?? record.actorId) === actor &&
    text(record.record_type ?? record.recordType) === 'event' &&
    actual?.action === metadata.action &&
    actual?.taskId === metadata.taskId &&
    actual?.runId === metadata.runId &&
    actual?.owner === metadata.owner &&
    actual?.epoch === metadata.epoch &&
    actual?.requestId === metadata.requestId
  );
}

function graphqlErrorMessage(value: unknown): string | undefined {
  const errors = asRecord(value)?.errors;
  if (!Array.isArray(errors)) return undefined;
  return errors
    .map((error) => text(asRecord(error)?.message))
    .filter((message): message is string => Boolean(message))
    .join('; ') || undefined;
}

function sameTenant(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function integer(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  return null;
}

// ---------------------------------------------------------------------------
// WorkGraphView envelope → typed TaskNode[] → OperatorTask[]
// ---------------------------------------------------------------------------

interface WorkGraphView {
  run: Record<string, unknown>;
  tasks: unknown[];
}

function workGraphView(value: unknown): WorkGraphView | null {
  const payload = asRecord(value);
  const data = asRecord(payload?.data) ?? payload;
  const view = asRecord(asRecord(data)?.workGraph);
  const run = asRecord(view?.run);
  if (view?.ok !== true || !run || !Array.isArray(view.tasks)) return null;
  return { run, tasks: view.tasks };
}

function workGraphContractError(
  view: WorkGraphView,
  expectedTenant: string,
  expectedRunId: string,
): string | null {
  const returnedTenant = text(view.run.tenant_slug ?? view.run.tenantSlug);
  const returnedRunId = text(view.run.run_id ?? view.run.runId);
  if (!returnedTenant || !sameTenant(returnedTenant, expectedTenant)) {
    return `workGraph tenant did not match ${expectedTenant}.`;
  }
  if (returnedRunId !== expectedRunId) {
    return `workGraph run did not match ${expectedRunId}.`;
  }

  for (const rawTask of view.tasks) {
    const task = asRecord(rawTask);
    const taskId = text(task?.id);
    const taskRunId = text(task?.run_id ?? task?.runId);
    if (!taskId) return 'workGraph returned a task without a stable id.';
    if (taskRunId !== expectedRunId) {
      return `Task ${taskId} did not belong to run ${expectedRunId}.`;
    }
    const shapeError = task ? taskContractError(task) : 'task was not an object';
    if (shapeError) return `Task ${taskId} contract invalid: ${shapeError}.`;
  }
  return null;
}

const NODE_STATUSES = new Set(['open', 'claimed', 'patch_proposed', 'verifying', 'accepted', 'rejected']);

function taskContractError(task: Record<string, unknown>): string | null {
  const nodeType = task.node_type ?? task.nodeType;
  const fileScope = task.file_scope ?? task.fileScope;
  const claimEpoch = task.claim_epoch ?? task.claimEpoch;
  const createdBy = task.created_by ?? task.createdBy;
  const reviewRequiredBy = task.review_required_by ?? task.reviewRequiredBy;
  if (typeof nodeType !== 'string') return 'nodeType was not a string';
  if (typeof task.goal !== 'string') return 'goal was not a string';
  if (!isStringArray(task.prerequisites)) return 'prerequisites was not a string array';
  if (!isStringArray(fileScope)) return 'fileScope was not a string array';
  if (!NODE_STATUSES.has(text(task.status) ?? '')) return 'status was not a known NodeStatus';
  if (integer(claimEpoch) === null) return 'claimEpoch was not an integer';
  if (!Array.isArray(task.receipts)) return 'receipts was not an array';
  for (const receipt of task.receipts) {
    const receiptError = receiptContractError(receipt);
    if (receiptError) return `receipt ${receiptError}`;
  }
  if (typeof createdBy !== 'string') return 'createdBy was not a string';
  if (reviewRequiredBy !== undefined && reviewRequiredBy !== null && typeof reviewRequiredBy !== 'string') {
    return 'reviewRequiredBy was not nullable string';
  }
  if (task.claim !== null) {
    const claim = asRecord(task.claim);
    if (!claim || !text(claim.owner)) return 'claim owner was missing';
    for (const field of ['epoch', 'granted_at', 'expires_at', 'last_heartbeat'] as const) {
      const camelField = field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
      if (integer(claim[field] ?? claim[camelField]) === null) return `claim ${field} was not an integer`;
    }
  }
  return null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function receiptContractError(value: unknown): string | null {
  const receipt = asRecord(value);
  if (!receipt) return 'was not an object';
  for (const [snakeCase, camelCase] of [
    ['kind', 'kind'],
    ['command', 'command'],
    ['base_commit', 'baseCommit'],
    ['claimed_status', 'claimedStatus'],
    ['artifact_hash', 'artifactHash'],
  ] as const) {
    if (typeof (receipt[snakeCase] ?? receipt[camelCase]) !== 'string') {
      return `${snakeCase} was not a string`;
    }
  }
  const verifiedStatus = receipt.verified_status ?? receipt.verifiedStatus;
  if (verifiedStatus !== undefined && verifiedStatus !== null && typeof verifiedStatus !== 'string') {
    return 'verified_status was not nullable string';
  }
  return null;
}

function operatorHeads(env: NodeJS.ProcessEnv, nodes: TaskNode[]): RegisteredHead[] {
  const configured = [env.THEOREM_OPERATOR_HEADS, env.THEOREM_AGENT_HEADS]
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  const active = nodes
    .map((node) => node.claim?.owner.trim() ?? '')
    .filter(Boolean);
  return Array.from(new Set([...configured, ...active])).map((id) => ({
    id: id as HeadId,
    label: headLabel(id),
  }));
}

function headLabel(id: string): string {
  if (id === 'claude-code') return 'Claude Code';
  if (id === 'claude-ai') return 'Claude.ai';
  if (id === 'codex') return 'Codex';
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function roomEventVerified(
  value: unknown,
  expectedNodeId: string,
  expectedEventId: string,
  expectedTaskId: string,
  expectedActor: string,
  expectedMessage: string,
  expectedRunId: string | undefined,
): boolean {
  const data = asRecord(asRecord(value)?.data);
  const node = asRecord(data?.graphNode);
  const event = asRecord(node?.properties);
  const payload = asRecord(event?.payload);
  return (
    text(node?.id) === expectedNodeId &&
    text(event?.id) === expectedEventId &&
    text(event?.actor) === expectedActor &&
    text(event?.kind) === 'operator-room-message' &&
    text(payload?.taskId ?? payload?.task_id) === expectedTaskId &&
    text(payload?.runId ?? payload?.run_id) === expectedRunId &&
    text(payload?.message) === expectedMessage
  );
}

function coordinationStreamEventNodeId(tenant: string, topic: string, token: number): string {
  return `harness:coordination:stream-event:${tenant.trim()}:${slugRoomPart(topic) || 'ungrouped'}:${token.toString().padStart(20, '0')}`;
}

function coordinationRecordNodeId(tenant: string, roomId: string, recordId: string): string {
  return `harness:coordination:record:${tenant.trim()}:${slugRoomPart(roomId) || 'ungrouped'}:${slugRoomPart(recordId) || 'unknown'}`;
}

function slugRoomPart(value: string): string {
  let slug = '';
  let previousDash = false;
  for (const character of value.trim().toLocaleLowerCase()) {
    if (/^[a-z0-9]$/.test(character)) {
      slug += character;
      previousDash = false;
    } else if (!previousDash) {
      slug += '-';
      previousDash = true;
    }
    if (slug.length >= 80) break;
  }
  return slug.replace(/^-+|-+$/g, '');
}

function mapTaskNodes(nodes: TaskNode[], nowMs: number, source: OperatorSource): OperatorTask[] {
  // A prerequisite is "met" once its referenced node reaches the terminal
  // accepted status. Cross-reference within the same work graph.
  const acceptedIds = new Set(nodes.filter((n) => n.status === 'accepted').map((n) => n.id));
  const goalById = new Map<string, string>();
  for (const n of nodes) {
    goalById.set(n.id, taskGoal(n, n.id));
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
  const id = node.id;
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
    claimEpoch: node.claim_epoch,
    ageMs: claim ? Math.max(0, nowMs - Date.parse(claim.claimedAt)) : 0,
    laneChip: node.node_type || undefined,
    fileScope: node.file_scope,
    runId: node.run_id || undefined,
    source,
    // checklist omitted: TaskNode has no checklist; receipts are proofs, not marks.
  };
}

function drawersFromNodes(nodes: TaskNode[], tasks: OperatorTask[], source: OperatorSource): Record<string, RunDrawer> {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const drawers: Record<string, RunDrawer> = {};
  for (const node of nodes) {
    const task = taskById.get(node.id);
    if (!task || (task.lane !== 'now' && task.lane !== 'done')) continue;
    drawers[task.id] = {
      taskId: task.id,
      goal: task.goal,
      verifyFirst: verifyItemsFromReceipts(node.receipts),
      events: drawerEventsFromNode(node, task),
      live: task.lane === 'now',
      footprint: node.file_scope.length > 0 ? node.file_scope : undefined,
      messages: [],
      source,
    };
  }
  return drawers;
}

function gateFromNodes(nodes: TaskNode[], tasks: OperatorTask[], source: OperatorSource): GateCard[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return nodes
    .filter((node) => node.status === 'patch_proposed' || node.status === 'verifying')
    .map((node) => {
      const task = taskById.get(node.id);
      return {
        taskId: node.id,
        goal: task?.goal ?? taskGoal(node, node.id),
        acceptance:
          node.receipts.length > 0
            ? node.receipts.map((receipt, index) => acceptanceFromReceipt(receipt, index))
            : [{ id: 'receipt_required', label: 'Substrate verification receipt', met: false }],
        crossReview: null,
        changedFiles: [],
        commits: commitsFromReceipts(node.receipts),
        owner: (node.claim?.owner || node.created_by || 'codex') as HeadId,
        source,
      };
    });
}

function shiftFromTasks(nodes: TaskNode[], tasks: OperatorTask[], now: Date, source: OperatorSource): ShiftSummary {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  // Match the fixture rollup window ("Since you last looked" ≈ last 12 hours);
  // pinning `since` to `now` would collapse the window to zero width.
  const since = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  return {
    since,
    completed: tasks
      .filter((task) => task.lane === 'done')
      .map((task) => ({
        taskId: task.id,
        goal: task.goal,
        gateStatus: nodeById.get(task.id)?.status === 'rejected' ? 'bounced' : 'passed',
      })),
    newlyBlocked: tasks
      .filter((task) => task.prerequisites.some((prereq) => !prereq.met))
      .map((task) => ({
        taskId: task.id,
        goal: task.goal,
        blockers: task.prerequisites.filter((prereq) => !prereq.met).map((prereq) => prereq.goal),
      })),
    reviewReadyCount: tasks.filter((task) => task.status === 'review').length,
    // Fixture contract: queue depth is the `next` lane only (see fixtureShiftSummary).
    queueDepth: tasks.filter((task) => task.lane === 'next').length,
    iceboxMovements: tasks.filter((task) => task.lane === 'icebox').map((task) => ({ taskId: task.id, goal: task.goal })),
    urgentMessages: [],
    source,
  };
}

function verifyItemsFromReceipts(receipts: Receipt[]): VerifyItem[] {
  return receipts.map((receipt, index) => ({
    id: `receipt_${index + 1}`,
    label: receipt.command || receipt.kind || `Receipt ${index + 1}`,
    done: receipt.verified_status !== null && receipt.verified_status === receipt.claimed_status,
    evidence: receipt.artifact_hash || receipt.base_commit || receipt.verified_status || undefined,
  }));
}

function drawerEventsFromNode(node: TaskNode, task: OperatorTask): RunDrawer['events'] {
  const events: RunDrawer['events'] = [];
  if (task.claim) {
    events.push({
      id: `${task.id}_claim`,
      at: task.claim.claimedAt,
      actor: task.claim.head,
      kind: 'claim',
      summary: `claimed ${task.id}`,
      payload: node.run_id ? `run ${node.run_id}` : undefined,
    });
  }
  return events;
}

function acceptanceFromReceipt(receipt: Receipt, index: number): GateCard['acceptance'][number] {
  const met = receipt.verified_status !== null && receipt.verified_status === receipt.claimed_status;
  return {
    id: `receipt_${index + 1}`,
    label: receipt.command || receipt.kind || `Receipt ${index + 1}`,
    met,
    evidence: met
      ? {
          label: receipt.artifact_hash || receipt.base_commit || receipt.verified_status || 'verified receipt',
        }
      : undefined,
  };
}

function commitsFromReceipts(receipts: Receipt[]): GateCard['commits'] {
  const seen = new Set<string>();
  const commits: GateCard['commits'] = [];
  for (const receipt of receipts) {
    if (!receipt.base_commit || seen.has(receipt.base_commit)) continue;
    seen.add(receipt.base_commit);
    commits.push({
      sha: receipt.base_commit,
      message: receipt.command || receipt.kind || 'verification receipt',
    });
  }
  return commits;
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
