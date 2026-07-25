// SOURCING: none. Pure contract normalization and fetch helpers.

export type StatusScope =
  | { kind: 'all' }
  | { kind: 'run'; runId: string }
  | { kind: 'room'; roomId: string };

export type StatusReport = {
  runs: Array<{
    id: string;
    planRef: string | null;
    fraction: { done: number; total: number };
    lastEvent: string | null;
    headPresence: string | null;
  }>;
  waitingOnYou: Array<{
    kind: string;
    id: string;
    summary: string;
    href?: string | null;
  }>;
  coordination: {
    roomId: string | null;
    intents: unknown[];
    unreadStreamDeltas: number;
  };
  cost: {
    visible: boolean;
    today: { tokens: number; cost: number; currency: string } | null;
    perRun: Array<{ runId: string; tokens: number; cost: number }>;
    priceTableVersion: string | null;
  };
  degradation: { degraded: boolean; missing: string[] };
  generation: number;
};

export type WhyTarget = {
  kind: 'node' | 'plan' | 'run' | 'receipt' | 'refusal' | 'context_generation' | 'entity' | 'source';
  id: string;
};

export type Remedy = {
  explanation: string;
  missing?: { kind: string; value?: string } | null;
  nextCall?: { surface: string; arguments: Record<string, unknown> } | null;
};

export type WhyReport = {
  target: WhyTarget;
  kind: string;
  trace: unknown;
  refs: Array<{ id: string; label?: string }>;
  degradation: { degraded: boolean; missing: string[] };
  refusal?: { code: string; message: string; remedy: Remedy } | null;
};

export type BootPayload = {
  brief: string | null;
  markdown?: string | null;
  status?: StatusReport | null;
  context?: unknown;
  degradation: { degraded: boolean; missing: string[] };
  generation: number;
};

export function serializeStatusScope(scope: StatusScope): Record<string, string> {
  if (scope.kind === 'all') return { kind: 'all' };
  if (scope.kind === 'run') return { kind: 'run', runId: scope.runId };
  return { kind: 'room', roomId: scope.roomId };
}

export function readStatusScope(value: unknown): StatusScope | null {
  const item = record(value);
  if (!item) return null;
  if (item.kind === 'all') return { kind: 'all' };
  if (item.kind === 'run' && validId(item.runId)) return { kind: 'run', runId: item.runId };
  if (item.kind === 'room' && validId(item.roomId)) return { kind: 'room', roomId: item.roomId };
  return null;
}

export function readWhyTarget(value: unknown): WhyTarget | null {
  const item = record(value);
  if (!item || !validId(item.id) || !validWhyKind(item.kind)) return null;
  return { kind: item.kind, id: item.id };
}

export function isStatusReport(value: unknown): value is StatusReport {
  return normalizeStatusReport(value) !== null;
}

export function normalizeStatusReport(value: unknown): StatusReport | null {
  const item = record(value);
  const coordination = record(item?.coordination);
  const cost = record(item?.cost);
  const degradation = readDegradation(item?.degradation);
  if (!item || !coordination || !cost || !degradation) return null;
  const runs = arrayOf(item.runs, readStatusRun);
  const waitingOnYou = arrayOf(item.waitingOnYou ?? item.waiting_on_you, readWaitingItem);
  const today = record(cost.today);
  return {
    runs,
    waitingOnYou,
    coordination: {
      roomId: nullableString(coordination.roomId ?? coordination.room_id),
      intents: Array.isArray(coordination.intents) ? coordination.intents : [],
      unreadStreamDeltas: safeNumber(coordination.unreadStreamDeltas ?? coordination.unread_stream_deltas),
    },
    cost: {
      visible: cost.visible === true,
      today: today
        ? {
            tokens: safeNumber(today.tokens),
            cost: safeNumber(today.cost),
            currency: stringOr(today.currency, 'USD'),
          }
        : null,
      perRun: arrayOf(cost.perRun ?? cost.per_run, readCostRun),
      priceTableVersion: nullableString(cost.priceTableVersion ?? cost.price_table_version),
    },
    degradation,
    generation: safeNumber(item.generation),
  };
}

export function normalizeWhyReport(value: unknown): WhyReport | null {
  const item = record(value);
  const target = readWhyTarget(item?.target);
  const degradation = readDegradation(item?.degradation);
  if (!item || !target || !degradation || typeof item.kind !== 'string') return null;
  return {
    target,
    kind: item.kind,
    trace: item.trace ?? null,
    refs: arrayOf(item.refs, readRef),
    degradation,
    refusal: readRefusal(item.refusal),
  };
}

export async function fetchStatus(scope: StatusScope = { kind: 'all' }): Promise<StatusReport> {
  const response = await fetch('/api/harness/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: serializeStatusScope(scope) }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(body, `Status request failed with ${response.status}.`));
  const report = normalizeStatusReport(body);
  if (!report) throw new Error('Status response did not match the console contract.');
  return report;
}

export async function fetchWhy(target: WhyTarget): Promise<WhyReport> {
  const response = await fetch('/api/harness/why', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(body, `Why request failed with ${response.status}.`));
  const report = normalizeWhyReport(body);
  if (!report) throw new Error('Why response did not match the console contract.');
  return report;
}

export async function fetchBoot(): Promise<BootPayload> {
  const response = await fetch('/api/harness/boot', { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(body, `Boot request failed with ${response.status}.`));
  const boot = normalizeBootPayload(body);
  if (!boot) throw new Error('Boot response did not match the console contract.');
  return boot;
}

export function normalizeBootPayload(value: unknown): BootPayload | null {
  const item = record(value);
  if (!item) return null;
  const markdown = nullableString(item.markdown);
  const brief = nullableString(item.brief);
  if (!markdown && !brief && !item.status && !item.status_digest && !item.statusDigest) {
    return null;
  }
  const statusValue = item.status ?? item.status_digest ?? item.statusDigest;
  const status = statusValue === null || statusValue === undefined
    ? null
    : normalizeStatusReport(statusValue);
  const explicit = readDegradation(item.degradation);
  const missing = [
    ...(explicit?.missing ?? []),
    ...(item.truncated === true ? ['boot_truncated'] : []),
    ...(statusValue && !status ? ['status_digest_projection'] : []),
  ];
  return {
    brief,
    markdown,
    status,
    context: item.context ?? item.stream_cursor ?? item.streamCursor ?? null,
    degradation: {
      degraded: explicit?.degraded === true || missing.length > 0,
      missing,
    },
    generation: safeNumber(item.generation),
  };
}

function readStatusRun(value: unknown): StatusReport['runs'][number] | null {
  const item = record(value);
  const fraction = record(item?.fraction);
  if (!item || typeof item.id !== 'string' || !fraction) return null;
  return {
    id: item.id,
    planRef: nullableString(item.planRef ?? item.plan_ref),
    fraction: {
      done: safeNumber(fraction.done),
      total: safeNumber(fraction.total),
    },
    lastEvent: nullableString(item.lastEvent ?? item.last_event),
    headPresence: nullableString(item.headPresence ?? item.head_presence),
  };
}

function readWaitingItem(value: unknown): StatusReport['waitingOnYou'][number] | null {
  const item = record(value);
  if (!item || typeof item.kind !== 'string' || typeof item.id !== 'string' || typeof item.summary !== 'string') {
    return null;
  }
  return {
    kind: item.kind,
    id: item.id,
    summary: item.summary,
    href: nullableString(item.href),
  };
}

function readCostRun(value: unknown): StatusReport['cost']['perRun'][number] | null {
  const item = record(value);
  const runId = nullableString(item?.runId ?? item?.run_id);
  if (!item || !runId) return null;
  return {
    runId,
    tokens: safeNumber(item.tokens),
    cost: safeNumber(item.cost),
  };
}

function readRef(value: unknown): WhyReport['refs'][number] | null {
  const item = record(value);
  if (!item || typeof item.id !== 'string') return null;
  return {
    id: item.id,
    ...(typeof item.label === 'string' ? { label: item.label } : {}),
  };
}

function readRefusal(value: unknown): WhyReport['refusal'] {
  if (value === null || value === undefined) return null;
  const item = record(value);
  const remedy = readRemedy(item?.remedy);
  if (!item || typeof item.code !== 'string' || typeof item.message !== 'string' || !remedy) return null;
  return { code: item.code, message: item.message, remedy };
}

function readRemedy(value: unknown): Remedy | null {
  const item = record(value);
  if (!item || typeof item.explanation !== 'string') return null;
  const missing = record(item.missing);
  const nextCall = record(item.nextCall ?? item.next_call);
  const nextArguments = record(nextCall?.arguments);
  return {
    explanation: item.explanation,
    missing: missing && typeof missing.kind === 'string'
      ? { kind: missing.kind, ...(typeof missing.value === 'string' ? { value: missing.value } : {}) }
      : null,
    nextCall: nextCall && typeof nextCall.surface === 'string' && nextArguments
      ? { surface: nextCall.surface, arguments: nextArguments }
      : null,
  };
}

function readDegradation(value: unknown): StatusReport['degradation'] | null {
  const item = record(value);
  if (!item) return null;
  return {
    degraded: item.degraded === true,
    missing: Array.isArray(item.missing) ? item.missing.filter((entry): entry is string => typeof entry === 'string') : [],
  };
}

function validWhyKind(value: unknown): value is WhyTarget['kind'] {
  return value === 'node'
    || value === 'plan'
    || value === 'run'
    || value === 'receipt'
    || value === 'refusal'
    || value === 'context_generation'
    || value === 'entity'
    || value === 'source';
}

function arrayOf<T>(value: unknown, read: (entry: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(read).filter((entry): entry is T => entry !== null) : [];
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function errorMessage(body: unknown, fallback: string): string {
  const item = record(body);
  return typeof item?.message === 'string'
    ? item.message
    : typeof item?.error === 'string'
      ? item.error
      : fallback;
}
