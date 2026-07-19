/**
 * Versioned, framework-free projection used by the CommonPlace Plan Canvas.
 *
 * The canonical plan remains the Harness Plan substrate. This module only
 * normalizes `plan inspect`/`plan what_changed` payloads and folds live events
 * so web, console, and desktop shells can share one projection contract.
 */

export const PLAN_CANVAS_SCHEMA = 'commonplace.plan-canvas/1' as const;

export type PlanTaskKind = 'regular' | 'compact' | 'review' | 'verify';
export type PlanTaskStatus =
  | 'pending'
  | 'claimed'
  | 'running'
  | 'patch_proposed'
  | 'verifying'
  | 'verified'
  | 'blocked'
  | 'failed'
  | 'superseded';

export type PlanCriterion = {
  id: string;
  statement: string;
};

export type AffordanceAnnotations = {
  readOnly: boolean;
  destructive: boolean;
};

export type PlanCapability = {
  id: string;
  title: string;
  description: string;
  serverOrigin: string;
  toolName: string;
  annotations: AffordanceAnnotations;
};

export type QueuedAffordance = {
  ref: string;
  config: unknown;
  annotations: AffordanceAnnotations;
};

export type PlanChangedEvent = {
  path: string;
  generation: number | null;
  at: string | null;
};

export type PlanTask = {
  id: string;
  alias: string;
  title: string;
  description: string;
  kind: PlanTaskKind;
  status: PlanTaskStatus;
  dependencies: string[];
  serves: string[];
  acceptanceCriteria: string[];
  queuedAffordances: QueuedAffordance[];
  admissionRequirement: 'admitted' | 'require_approval';
  approvalReceipt: string | null;
  claimHolder: string | null;
  generationAtStart: number | null;
  generationAtEnd: number | null;
  supersedes: string[];
  supersededBy: string[];
  changedEvents: PlanChangedEvent[];
  proofStatus: string | null;
};

export type PlanCanvasSnapshot = {
  schema: typeof PLAN_CANVAS_SCHEMA;
  planId: string;
  title: string;
  objective: string;
  status: string;
  projectId: string | null;
  criteria: PlanCriterion[];
  tasks: PlanTask[];
  progress: { done: number; total: number };
  streamCursor: number;
  events: PlanCanvasEvent[];
};

export type PlanCanvasEvent = {
  id: string;
  transition: string;
  nodeIds: string[];
  actor: string | null;
  graphVersion: number;
  at: string | null;
  detail: Record<string, unknown>;
};

export type PlanPollPayload = {
  snapshot: unknown;
  events?: unknown;
  capabilities?: unknown;
  cursor?: unknown;
  degraded?: unknown;
};

export type PlanPollResult = {
  snapshot: PlanCanvasSnapshot;
  capabilities: PlanCapability[];
};

export type PlanSubscriptionStatus = 'connecting' | 'live' | 'reconnecting' | 'stopped';

export type PlanSubscriptionOptions = {
  intervalMs?: number;
  load: (cursor: number, signal: AbortSignal) => Promise<PlanPollPayload>;
  onState: (result: PlanPollResult) => void;
  onStatus?: (status: PlanSubscriptionStatus) => void;
  onError?: (error: Error) => void;
};

/**
 * Poll the plan stream without overlapping requests. The Plan substrate's
 * graph-version cursor makes polling replay-safe: a delayed response cannot
 * silently skip the transitions written while it was in flight.
 */
export function subscribePlanState(options: PlanSubscriptionOptions): () => void {
  const intervalMs = Math.max(250, options.intervalMs ?? 1_500);
  const controller = new AbortController();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cursor = 0;
  let current: PlanCanvasSnapshot | null = null;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => void poll(), intervalMs);
  };

  const poll = async () => {
    options.onStatus?.(current ? 'live' : 'connecting');
    try {
      const payload = await options.load(cursor, controller.signal);
      if (stopped) return;
      const next = normalizePlanPoll(payload, current);
      current = next.snapshot;
      cursor = Math.max(cursor, next.snapshot.streamCursor);
      options.onState(next);
      options.onStatus?.('live');
    } catch (error) {
      if (stopped || controller.signal.aborted) return;
      options.onStatus?.('reconnecting');
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      schedule();
    }
  };

  void poll();
  return () => {
    stopped = true;
    controller.abort();
    if (timer) clearTimeout(timer);
    options.onStatus?.('stopped');
  };
}

export function normalizePlanPoll(
  payload: PlanPollPayload,
  previous: PlanCanvasSnapshot | null = null,
): PlanPollResult {
  const events = normalizePlanEvents(payload.events);
  const inspected = normalizePlanSnapshot(payload.snapshot);
  const folded = previous ? events.reduce(applyPlanEvent, previous) : null;
  const snapshot = inspected ?? folded;
  if (!snapshot) throw new Error('Plan stream response did not contain a usable snapshot.');

  const cursor = Math.max(
    snapshot.streamCursor,
    number(payload.cursor) ?? 0,
    ...events.map((event) => event.graphVersion),
  );
  return {
    snapshot: {
      ...snapshot,
      streamCursor: cursor,
      events: mergeEvents(snapshot.events, events),
    },
    capabilities: normalizeCapabilities(payload.capabilities),
  };
}

export function normalizePlanSnapshot(value: unknown): PlanCanvasSnapshot | null {
  const root = record(value);
  if (!root) return null;
  const plan = record(root.plan) ?? record(record(root.data)?.plan);
  const planId = text(root.plan_id) ?? text(root.planId) ?? text(plan?.id);
  if (!planId || !plan) return null;
  const tasks = array(root.tasks ?? record(root.data)?.tasks)
    .map(normalizeTask)
    .filter(nonNullable);
  const rawProgress = record(root.progress);
  const criteria = array(plan.acceptance_criteria ?? plan.acceptanceCriteria)
    .map((criterion, index) => normalizeCriterion(criterion, index))
    .filter(nonNullable);
  const done = number(rawProgress?.done) ?? tasks.filter((task) => task.status === 'verified').length;
  const total = number(rawProgress?.total) ?? tasks.filter((task) => task.status !== 'superseded').length;
  const streamCursor = Math.max(
    number(root.graph_version) ?? 0,
    number(root.graphVersion) ?? 0,
    ...array(root.events).map((event) => number(record(event)?.graph_version) ?? 0),
  );

  return {
    schema: PLAN_CANVAS_SCHEMA,
    planId,
    title: text(plan.title) ?? planId,
    objective: text(plan.objective) ?? '',
    status: text(plan.status) ?? (done === total && total > 0 ? 'completed' : 'active'),
    projectId: text(plan.project_id) ?? text(plan.projectId) ?? null,
    criteria,
    tasks,
    progress: { done, total },
    streamCursor,
    events: normalizePlanEvents(root.events),
  };
}

export function normalizeCapabilities(value: unknown): PlanCapability[] {
  const root = record(value);
  const values = array(root?.results ?? root?.capabilities ?? value);
  const seen = new Set<string>();
  const capabilities: PlanCapability[] = [];
  for (const raw of values) {
    const item = record(raw);
    if (!item) continue;
    const id = text(item.id) ?? text(item.affordance_id) ?? text(item.affordanceId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const annotations = normalizeAnnotations(item.annotations ?? item.permissions, item.writeback_policy ?? item.writebackPolicy);
    capabilities.push({
      id,
      title: text(item.title) ?? text(item.name) ?? text(item.tool_name) ?? id,
      description: text(item.description) ?? text(item.one_line_description) ?? '',
      serverOrigin: text(item.server_origin) ?? text(item.server_id) ?? 'Theorem',
      toolName: text(item.tool_name) ?? id.split(':').at(-1) ?? id,
      annotations,
    });
  }
  return capabilities;
}

export function normalizePlanEvents(value: unknown): PlanCanvasEvent[] {
  const root = record(value);
  return array(root?.rows ?? root?.events ?? value)
    .map((raw, index) => {
      const item = record(raw);
      if (!item) return null;
      const detail = record(item.detail) ?? record(item.payload) ?? {};
      const graphVersion = number(item.graph_version) ?? number(item.graphVersion) ?? 0;
      const transition = text(item.transition) ?? text(item.type) ?? 'plan_changed';
      return {
        id: text(item.event_id) ?? text(item.eventId) ?? `${transition}:${graphVersion}:${index}`,
        transition,
        nodeIds: strings(item.node_ids ?? item.nodeIds ?? item.task_ids ?? item.taskIds),
        actor: text(item.actor) ?? text(item.head) ?? null,
        graphVersion,
        at: text(item.created_at) ?? text(item.createdAt) ?? text(item.at) ?? null,
        detail,
      } satisfies PlanCanvasEvent;
    })
    .filter(nonNullable)
    .sort((left, right) => left.graphVersion - right.graphVersion || left.id.localeCompare(right.id));
}

export function applyPlanEvent(snapshot: PlanCanvasSnapshot, event: PlanCanvasEvent): PlanCanvasSnapshot {
  const status = statusForTransition(event.transition, event.detail);
  const changed = changedEvents(event.detail, event.at);
  const affected = new Set(event.nodeIds);
  const tasks = snapshot.tasks.map((task) => {
    if (!affected.has(task.id) && !affected.has(task.alias)) return task;
    return {
      ...task,
      ...(status ? { status } : {}),
      ...(event.actor && status === 'claimed' ? { claimHolder: event.actor } : {}),
      ...(changed.length ? { changedEvents: mergeChangedEvents(task.changedEvents, changed) } : {}),
    };
  });
  const done = tasks.filter((task) => task.status === 'verified').length;
  const total = tasks.filter((task) => task.status !== 'superseded').length;
  return {
    ...snapshot,
    tasks,
    progress: { done, total },
    streamCursor: Math.max(snapshot.streamCursor, event.graphVersion),
    events: mergeEvents(snapshot.events, [event]),
  };
}

export function planIsComplete(snapshot: PlanCanvasSnapshot): boolean {
  const current = snapshot.tasks.filter((task) => task.status !== 'superseded');
  return current.length > 0 && current.every((task) => task.status === 'verified');
}

function normalizeTask(value: unknown): PlanTask | null {
  const item = record(value);
  if (!item) return null;
  const id = text(item.id) ?? text(item.task_id) ?? text(item.taskId);
  if (!id) return null;
  const queuedAffordances = array(item.queued_affordances ?? item.queuedAffordances)
    .map((raw) => {
      const affordance = record(raw);
      const ref = text(affordance?.ref) ?? text(affordance?.affordance_ref) ?? text(affordance?.affordanceRef);
      if (!ref) return null;
      return {
        ref,
        config: affordance?.config ?? {},
        annotations: normalizeAnnotations(affordance?.annotations),
      } satisfies QueuedAffordance;
    })
    .filter(nonNullable);
  const claim = record(item.claim);
  const admission = snake(text(item.admission_requirement) ?? text(item.admissionRequirement) ?? 'admitted');
  return {
    id,
    alias: text(item.alias) ?? id,
    title: text(item.title) ?? text(item.goal) ?? id,
    description: text(item.description) ?? text(item.goal) ?? '',
    kind: normalizeKind(item.kind ?? item.task_kind ?? item.taskKind),
    status: normalizeStatus(item.lifecycle_status ?? item.lifecycleStatus ?? item.status),
    dependencies: strings(item.dependencies ?? item.depends_on ?? item.dependsOn),
    serves: strings(item.serves ?? item.criterion_ids ?? item.criterionIds),
    acceptanceCriteria: strings(item.acceptance_criteria ?? item.acceptanceCriteria),
    queuedAffordances,
    admissionRequirement: admission === 'require_approval' ? 'require_approval' : 'admitted',
    approvalReceipt: text(item.approval_receipt) ?? text(item.approvalReceipt) ?? null,
    claimHolder: text(item.claim_holder) ?? text(item.claimHolder) ?? text(claim?.owner) ?? null,
    generationAtStart: number(item.generation_at_start ?? item.generationAtStart),
    generationAtEnd: number(item.generation_at_end ?? item.generationAtEnd),
    supersedes: strings(item.supersedes),
    supersededBy: strings(item.superseded_by ?? item.supersededBy),
    changedEvents: changedEvents(
      item.changed_events ?? item.changedEvents ?? item.changed_paths ?? item.changedPaths,
      null,
    ),
    proofStatus: text(item.proof_status) ?? text(item.proofStatus) ?? null,
  };
}

function normalizeCriterion(value: unknown, index: number): PlanCriterion | null {
  if (typeof value === 'string') return { id: `criterion-${index + 1}`, statement: value };
  const item = record(value);
  if (!item) return null;
  const id = text(item.id) ?? text(item.criterion_id) ?? text(item.criterionId) ?? `criterion-${index + 1}`;
  const statement = text(item.text) ?? text(item.statement);
  return statement ? { id, statement } : null;
}

function normalizeKind(value: unknown): PlanTaskKind {
  const kind = snake(text(value) ?? 'regular');
  return kind === 'compact' || kind === 'review' || kind === 'verify' ? kind : 'regular';
}

function normalizeStatus(value: unknown): PlanTaskStatus {
  switch (snake(text(value) ?? 'pending')) {
    case 'working':
    case 'in_progress':
    case 'running':
      return 'running';
    case 'claimed':
      return 'claimed';
    case 'patch_proposed':
      return 'patch_proposed';
    case 'verifying':
      return 'verifying';
    case 'done':
    case 'accepted':
    case 'complete':
    case 'completed':
    case 'verified':
      return 'verified';
    case 'failed':
    case 'rejected':
      return 'failed';
    case 'blocked':
      return 'blocked';
    case 'superseded':
      return 'superseded';
    default:
      return 'pending';
  }
}

function statusForTransition(transition: string, detail: Record<string, unknown>): PlanTaskStatus | null {
  const explicit = text(detail.status) ?? text(detail.state);
  if (explicit) return normalizeStatus(explicit);
  const value = snake(transition);
  if (value.includes('supersed')) return 'superseded';
  if (value.includes('task_started') || value.includes('turn_started') || value.includes('in_progress')) return 'running';
  if (value.includes('claim')) return 'claimed';
  if (value.includes('patch_proposed')) return 'patch_proposed';
  if (value.includes('verify') && !value.includes('verified')) return 'verifying';
  if (value.includes('completed') || value === 'done' || value.includes('verified')) return 'verified';
  if (value.includes('failed') || value.includes('aborted')) return 'failed';
  if (value.includes('pending') || value.includes('lease_expired')) return 'pending';
  return null;
}

function normalizeAnnotations(value: unknown, writebackPolicy?: unknown): AffordanceAnnotations {
  const item = record(value);
  const tokens = strings(value).map(snake);
  const writeback = snake(text(writebackPolicy) ?? '');
  return {
    readOnly: item?.read_only === true
      || item?.readOnly === true
      || tokens.includes('read_only')
      || writeback === 'none'
      || writeback === 'read_only',
    destructive: item?.destructive === true
      || tokens.includes('destructive')
      || writeback === 'destructive',
  };
}

function changedEvents(value: unknown, fallbackAt: string | null): PlanChangedEvent[] {
  const root = record(value);
  return array(root?.changed_events ?? root?.changedEvents ?? root?.paths ?? value)
    .flatMap((raw) => {
      if (typeof raw === 'string') return [{ path: raw, generation: null, at: fallbackAt }];
      const item = record(raw);
      const event = record(item?.event) ?? item;
      const paths = [text(event?.path), text(event?.from), text(event?.to)].filter(nonNullable);
      const generation = number(item?.generation) ?? number(event?.generation);
      const at = text(item?.at) ?? text(item?.created_at) ?? text(event?.at) ?? fallbackAt;
      return [...new Set(paths)].map((path) => ({ path, generation, at } satisfies PlanChangedEvent));
    })
    .filter(nonNullable);
}

function mergeChangedEvents(current: PlanChangedEvent[], incoming: PlanChangedEvent[]): PlanChangedEvent[] {
  const byKey = new Map(current.map((event) => [`${event.path}:${event.generation ?? ''}`, event]));
  for (const event of incoming) byKey.set(`${event.path}:${event.generation ?? ''}`, event);
  return [...byKey.values()];
}

function mergeEvents(current: PlanCanvasEvent[], incoming: PlanCanvasEvent[]): PlanCanvasEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()]
    .sort((left, right) => left.graphVersion - right.graphVersion || left.id.localeCompare(right.id))
    .slice(-100);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: unknown): string[] {
  return array(value).map(text).filter(nonNullable);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function snake(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
