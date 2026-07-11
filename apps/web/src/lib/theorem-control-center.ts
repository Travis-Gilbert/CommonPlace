export const THEOREM_CONTROL_CENTER_SURFACE = 'app.theoremharness.com';

export type ControlCenterSourceMode = 'live' | 'fixture' | 'unknown' | 'blocked';
export type ControlCenterStatus = 'ready' | 'warning' | 'blocked' | 'unknown' | 'pending';
export type WorkroomState = 'queued' | 'running' | 'blocked' | 'review' | 'done' | 'archived' | 'unknown';
export type ApprovalDecision = 'approve_once' | 'remember' | 'deny';
export type MemoryAction = 'edit' | 'pin' | 'forget' | 'correct';
export type SkillCandidateDecision = 'shadow_eval' | 'approve' | 'reject';
export type IsolationTier = 'trusted_local' | 'sandboxed' | 'denied' | 'unknown';
export type RiskClass = 'read' | 'write' | 'network' | 'install' | 'destructive';

export interface ControlCenterSource {
  mode: ControlCenterSourceMode;
  label: string;
  endpoint?: string;
  message?: string;
}

export interface WorkroomSummary {
  id: string;
  title: string;
  task: string;
  state: WorkroomState;
  actor: string;
  head: string;
  latestReceiptId: string;
  artifactCount: number;
  updatedAt: string;
  actions: Array<'resume' | 'fork' | 'open' | 'export'>;
  fitness: number | null;
  eval: EvalSummary | null;
  source: ControlCenterSource;
}

export interface ApprovalCard {
  id: string;
  workroomId: string;
  status: 'pending' | 'approved' | 'denied' | 'remembered';
  title: string;
  summary: string;
  riskClass: RiskClass;
  isolationTier: IsolationTier;
  requestedBy: string;
  toolName: string;
  target: string;
  diffSummary?: string;
  commandSummary?: string;
  audit: AuditRow[];
  actions: ApprovalDecision[];
  source: ControlCenterSource;
}

export interface Receipt {
  id: string;
  workroomId: string;
  kind:
    | 'command'
    | 'file_diff'
    | 'trace'
    | 'route_check'
    | 'approval'
    | 'memory'
    | 'tool_health'
    | 'skill_candidate'
    | 'reconstruction'
    | 'eval';
  title: string;
  summary: string;
  actor: string;
  head: string;
  happenedAt: string;
  changed: string[];
  inspect: ReceiptInspect;
  recovery: Array<'resume' | 'fork' | 'rollback' | 'export' | 'open'>;
  provenance: string[];
  source: ControlCenterSource;
}

export interface ReceiptInspect {
  label: string;
  href?: string;
  bodyPreview?: string;
}

export interface RouteCard {
  id: string;
  label: string;
  provider: string;
  model: string;
  runtime: string;
  channel: string;
  endpointKind: 'loopback' | 'hosted' | 'browser-proxy' | 'unknown';
  protocol: 'ACP' | 'OpenAI Responses' | 'Anthropic Messages' | 'GraphQL' | 'HTTP JSON' | 'unknown';
  authState: 'configured' | 'missing' | 'not_required' | 'unknown';
  contextWindow: number | null;
  cost: {
    known: boolean;
    source: 'configured' | 'provider_catalog' | 'unknown';
    label: string | null;
  };
  counters: {
    requestsSeen: number | null;
    openaiResponsesSeen: number | null;
    anthropicMessagesSeen: number | null;
  };
  status: ControlCenterStatus;
  source: ControlCenterSource;
}

export interface SetupCheck {
  id: string;
  label: string;
  target: string;
  status: ControlCenterStatus;
  checkOnly: boolean;
  message: string;
  source: ControlCenterSource;
}

export interface CommandCatalogItem {
  id: string;
  label: string;
  locus: 'local' | 'agent' | 'model' | 'admin';
  description: string;
  riskClass: RiskClass;
  routeId?: string;
}

export interface ContextBundle {
  id: string;
  label: string;
  status: ControlCenterStatus;
  tokenEstimate: number | null;
  admittedSources: ContextSource[];
}

export interface ContextSource {
  id: string;
  title: string;
  reason: string;
  provenance: string[];
  hydrateHref?: string;
}

export interface MemoryBlock {
  id: string;
  title: string;
  preview: string;
  status: 'active' | 'pinned' | 'forgotten' | 'corrected';
  visibleLimit: number;
  provenance: string[];
  actions: MemoryAction[];
  updatedAt: string;
  source: ControlCenterSource;
}

export interface ToolConnection {
  id: string;
  label: string;
  kind: 'mcp' | 'skill' | 'connector';
  status: ControlCenterStatus;
  permissionSummary: string;
  envHints: string[];
  oauthRequired: boolean;
  lastCheckedAt: string | null;
  source: ControlCenterSource;
}

export interface SkillCandidate {
  id: string;
  title: string;
  sourceMemoryId: string;
  status: 'candidate' | 'shadow_eval' | 'approved' | 'rejected';
  fitness: number | null;
  gate: 'close_loop_if_allowed' | 'manual_review';
  receipts: string[];
}

export interface ReconstructionPacket {
  id: string;
  target: string;
  status: 'needed' | 'packet_ready' | 'blocked';
  evidence: string[];
  oracle: string;
}

export interface EvalSummary {
  id: string;
  status: 'candidate' | 'running' | 'passed' | 'failed' | 'unknown';
  fitness: number | null;
}

export interface EvalTrace {
  id: string;
  workroomId: string;
  status: EvalSummary['status'];
  fitness: number | null;
  exportHref?: string;
  receipts: string[];
}

export interface AuditRow {
  at: string;
  actor: string;
  action: string;
  receiptId?: string;
}

export interface TheoremControlCenterState {
  targetSurface: typeof THEOREM_CONTROL_CENTER_SURFACE;
  generatedAt: string;
  source: ControlCenterSource;
  health: {
    status: ControlCenterStatus;
    summary: string;
  };
  workrooms: WorkroomSummary[];
  approvals: ApprovalCard[];
  receipts: Receipt[];
  routes: RouteCard[];
  setup: SetupCheck[];
  commands: CommandCatalogItem[];
  memory: {
    contextBundles: ContextBundle[];
    blocks: MemoryBlock[];
  };
  tools: ToolConnection[];
  skillCandidates: SkillCandidate[];
  reconstructionPackets: ReconstructionPacket[];
  evals: EvalTrace[];
}

export type TheoremControlCenterAction =
  | { action: 'approval_decision'; approvalId: string; decision: ApprovalDecision; actor?: string; rememberScope?: string }
  | { action: 'memory_action'; blockId: string; memoryAction: MemoryAction; actor?: string; note?: string }
  | { action: 'setup_check'; checkId?: string }
  | { action: 'route_check'; routeId?: string }
  | { action: 'tool_health_check'; toolId?: string }
  | { action: 'skill_candidate_action'; candidateId: string; decision: SkillCandidateDecision; actor?: string }
  | { action: 'reconstruction_packet_create'; target: 'letta_memory_blocks' | 'openclaw_runtime_contract' | 'hermes_skill_loop' }
  | { action: 'eval_trace_export'; workroomId: string };

export interface TheoremControlCenterActionResult {
  ok: boolean;
  action: TheoremControlCenterAction['action'];
  message: string;
  receipt?: Receipt;
  setup?: SetupCheck[];
  routes?: RouteCard[];
  tools?: ToolConnection[];
  memoryBlock?: MemoryBlock;
  approval?: ApprovalCard;
  skillCandidate?: SkillCandidate;
  reconstructionPacket?: ReconstructionPacket;
  evalTrace?: EvalTrace;
}

const DEFAULT_GENERATED_AT = '2026-07-02T00:00:00.000Z';
const DEFAULT_HOSTED_ORIGIN = 'https://rustyredcore-theorem-production.up.railway.app';
const DEFAULT_LOCAL_HARNESS = 'http://127.0.0.1:50080';
const DEFAULT_LOCAL_PROXY = 'http://127.0.0.1:8788';
const DEFAULT_LOCAL_NODE = 'http://127.0.0.1:8380';
const DEFAULT_LOCAL_ACP = 'ws://127.0.0.1:8380/v1/commonplace/acp/ws';
const DEFAULT_TENANT = 'Travis-Gilbert';

type EnvLike = Record<string, string | undefined>;

export function buildTheoremControlCenterState(
  env: EnvLike = process.env,
  generatedAt = new Date(),
): TheoremControlCenterState {
  const timestamp = generatedAt.toISOString();
  const routes = buildRoutes(env);
  const setup = buildSetupChecks(env);
  const receipts = fixtureReceipts(timestamp);
  const workrooms = fixtureWorkrooms(timestamp);
  const approvals = fixtureApprovals(timestamp);
  const tools = fixtureTools(timestamp, env);
  const memory = fixtureMemory(timestamp);
  const skillCandidates = fixtureSkillCandidates();
  const evals = fixtureEvals();

  return {
    targetSurface: THEOREM_CONTROL_CENTER_SURFACE,
    generatedAt: timestamp,
    source: {
      mode: 'fixture',
      label: 'CommonPlace product backend contract',
      message: 'Fixture-backed until live Theorem endpoints are wired into this route.',
    },
    health: summarizeHealth(routes, setup, approvals),
    workrooms,
    approvals,
    receipts,
    routes,
    setup,
    commands: fixtureCommands(routes),
    memory,
    tools,
    skillCandidates,
    reconstructionPackets: fixtureReconstructionPackets(),
    evals,
  };
}

export async function buildTheoremControlCenterStateLive(
  env: EnvLike = process.env,
  generatedAt = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<TheoremControlCenterState> {
  const baseState = buildTheoremControlCenterState(env, generatedAt);
  const generatedAtIso = generatedAt.toISOString();
  const harnessBase = harnessBaseUrl(env);
  const proxyBase = proxyBaseUrl(env);
  const tenant = env.THEOREM_TENANT_SLUG ?? env.THEOREM_HARNESS_TENANT_SLUG ?? DEFAULT_TENANT;

  const [setup, proxyStatus, harnessSnapshot, connectorSnapshot, memorySnapshot, approvalSnapshot] = await Promise.all([
    runSetupChecks(baseState.setup, undefined, fetchImpl),
    fetchJson(fetchImpl, `${proxyBase}/status`),
    fetchHarnessSnapshot(fetchImpl, harnessBase, generatedAtIso),
    fetchConnectorSnapshot(fetchImpl, harnessBase, tenant, generatedAtIso),
    fetchMemorySnapshot(fetchImpl, env, generatedAtIso),
    fetchDesktopApprovalSnapshot(fetchImpl, env, generatedAtIso),
  ]);

  const routes = applyProxyStatusToRoutes(baseState.routes, proxyStatus, proxyBase);
  const workrooms = harnessSnapshot?.workrooms ?? baseState.workrooms;
  const receipts = harnessSnapshot?.receipts ?? baseState.receipts;
  const tools = connectorSnapshot ?? baseState.tools;
  const memory = memorySnapshot ?? baseState.memory;
  const approvals = approvalSnapshot ?? baseState.approvals;
  const liveSources = [
    proxyStatus.ok,
    harnessSnapshot !== null,
    connectorSnapshot !== null,
    memorySnapshot !== null,
    approvalSnapshot !== null,
    setup.some((check) => check.status === 'ready'),
  ].filter(Boolean).length;

  return {
    ...baseState,
    generatedAt: generatedAtIso,
    source: liveSources
      ? liveSource('CommonPlace product backend contract', '/api/theorem/control-center', `${liveSources} live backend source(s) answered.`)
      : baseState.source,
    health: summarizeHealth(routes, setup, approvals),
    workrooms,
    approvals,
    receipts,
    routes,
    setup,
    commands: fixtureCommands(routes),
    memory,
    tools,
  };
}

export async function handleTheoremControlCenterAction(
  input: unknown,
  env: EnvLike = process.env,
  generatedAt = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<TheoremControlCenterActionResult> {
  const action = normalizeAction(input);
  const state = buildTheoremControlCenterState(env, generatedAt);

  switch (action.action) {
    case 'approval_decision': {
      const liveApproval = await handleDesktopApprovalDecision(action, env, generatedAt, fetchImpl);
      if (liveApproval) return liveApproval;
      const approval = state.approvals.find((item) => item.id === action.approvalId);
      if (!approval) return actionError(action.action, `Unknown approval ${action.approvalId}.`);
      const status = action.decision === 'deny' ? 'denied' : action.decision === 'remember' ? 'remembered' : 'approved';
      const receipt = actionReceipt({
        kind: 'approval',
        title: `Approval ${status}`,
        summary: `${actorLabel(action.actor)} marked ${approval.title} as ${status}.`,
        workroomId: approval.workroomId,
        actor: actorLabel(action.actor),
        generatedAt,
        changed: [approval.id],
        provenance: ['commonplace:approval-inbox', approval.id],
      });
      return {
        ok: true,
        action: action.action,
        message: `Approval ${status}.`,
        receipt,
        approval: {
          ...approval,
          status,
          audit: [...approval.audit, { at: receipt.happenedAt, actor: receipt.actor, action: status, receiptId: receipt.id }],
        },
      };
    }
    case 'memory_action': {
      const block = state.memory.blocks.find((item) => item.id === action.blockId);
      if (!block) return actionError(action.action, `Unknown memory block ${action.blockId}.`);
      const receipt = actionReceipt({
        kind: 'memory',
        title: `Memory ${action.memoryAction}`,
        summary: `${actorLabel(action.actor)} requested ${action.memoryAction} on ${block.title}.`,
        workroomId: 'workroom:memory-context',
        actor: actorLabel(action.actor),
        generatedAt,
        changed: [block.id],
        provenance: ['commonplace:memory-cockpit', block.id],
      });
      return {
        ok: true,
        action: action.action,
        message: `Memory ${action.memoryAction} receipted.`,
        receipt,
        memoryBlock: {
          ...block,
          status: memoryStatusForAction(action.memoryAction),
          provenance: [...block.provenance, receipt.id],
          updatedAt: receipt.happenedAt,
        },
      };
    }
    case 'setup_check': {
      const checks = await runSetupChecks(state.setup, action.checkId, fetchImpl);
      return { ok: true, action: action.action, message: 'Setup check completed.', setup: checks };
    }
    case 'route_check': {
      const liveState = await buildTheoremControlCenterStateLive(env, generatedAt, fetchImpl);
      const routes = action.routeId ? liveState.routes.filter((route) => route.id === action.routeId) : liveState.routes;
      if (!routes.length) return actionError(action.action, `Unknown route ${action.routeId}.`);
      return { ok: true, action: action.action, message: 'Route check completed.', routes };
    }
    case 'tool_health_check': {
      const liveState = await buildTheoremControlCenterStateLive(env, generatedAt, fetchImpl);
      const tools = action.toolId ? liveState.tools.filter((tool) => tool.id === action.toolId) : liveState.tools;
      if (!tools.length) return actionError(action.action, `Unknown tool ${action.toolId}.`);
      return { ok: true, action: action.action, message: 'Tool health check completed.', tools };
    }
    case 'skill_candidate_action': {
      const candidate = state.skillCandidates.find((item) => item.id === action.candidateId);
      if (!candidate) return actionError(action.action, `Unknown skill candidate ${action.candidateId}.`);
      const receipt = actionReceipt({
        kind: 'skill_candidate',
        title: `Skill candidate ${action.decision}`,
        summary: `${actorLabel(action.actor)} requested ${action.decision} for ${candidate.title}.`,
        workroomId: 'workroom:skill-loop',
        actor: actorLabel(action.actor),
        generatedAt,
        changed: [candidate.id],
        provenance: ['commonplace:skill-candidates', candidate.id, candidate.gate],
      });
      return {
        ok: true,
        action: action.action,
        message: `Skill candidate ${action.decision} receipted.`,
        receipt,
        skillCandidate: {
          ...candidate,
          status: action.decision === 'approve' ? 'approved' : action.decision === 'reject' ? 'rejected' : 'shadow_eval',
          receipts: [...candidate.receipts, receipt.id],
        },
      };
    }
    case 'reconstruction_packet_create': {
      const packet = reconstructionPacketForTarget(action.target);
      return {
        ok: true,
        action: action.action,
        message: 'Reconstruction packet selected.',
        reconstructionPacket: { ...packet, status: 'packet_ready' },
      };
    }
    case 'eval_trace_export': {
      const workroom = state.workrooms.find((item) => item.id === action.workroomId);
      if (!workroom) return actionError(action.action, `Unknown workroom ${action.workroomId}.`);
      const evalTrace: EvalTrace = {
        id: `eval:${workroom.id}:export`,
        workroomId: workroom.id,
        status: 'candidate',
        fitness: workroom.fitness,
        exportHref: `/api/theorem/control-center?artifact=eval&workroom=${encodeURIComponent(workroom.id)}`,
        receipts: [workroom.latestReceiptId],
      };
      return { ok: true, action: action.action, message: 'Eval trace export prepared.', evalTrace };
    }
  }
}

export function normalizeAction(input: unknown): TheoremControlCenterAction {
  const record = asRecord(input);
  const action = text(record?.action);
  switch (action) {
    case 'approval_decision': {
      const decision = text(record?.decision);
      if (!isApprovalDecision(decision)) throw new Error('approval_decision requires decision approve_once, remember, or deny.');
      return {
        action,
        approvalId: requiredText(record?.approvalId, 'approval_decision requires approvalId.'),
        decision,
        actor: text(record?.actor),
        rememberScope: text(record?.rememberScope),
      };
    }
    case 'memory_action': {
      const memoryAction = text(record?.memoryAction);
      if (!isMemoryAction(memoryAction)) throw new Error('memory_action requires memoryAction edit, pin, forget, or correct.');
      return {
        action,
        blockId: requiredText(record?.blockId, 'memory_action requires blockId.'),
        memoryAction,
        actor: text(record?.actor),
        note: text(record?.note),
      };
    }
    case 'setup_check':
      return { action, checkId: text(record?.checkId) };
    case 'route_check':
      return { action, routeId: text(record?.routeId) };
    case 'tool_health_check':
      return { action, toolId: text(record?.toolId) };
    case 'skill_candidate_action': {
      const decision = text(record?.decision);
      if (!isSkillCandidateDecision(decision)) throw new Error('skill_candidate_action requires decision shadow_eval, approve, or reject.');
      return {
        action,
        candidateId: requiredText(record?.candidateId, 'skill_candidate_action requires candidateId.'),
        decision,
        actor: text(record?.actor),
      };
    }
    case 'reconstruction_packet_create': {
      const target = text(record?.target);
      if (!isReconstructionTarget(target)) {
        throw new Error('reconstruction_packet_create requires target letta_memory_blocks, openclaw_runtime_contract, or hermes_skill_loop.');
      }
      return { action, target };
    }
    case 'eval_trace_export':
      return {
        action,
        workroomId: requiredText(record?.workroomId, 'eval_trace_export requires workroomId.'),
      };
    default:
      throw new Error('Unknown control center action.');
  }
}

function buildRoutes(env: EnvLike): RouteCard[] {
  const provider = env.THEOREM_AGENT_HEAD_DEEPSEEK_PROVIDER ?? 'deepseek';
  const model = env.DEEPSEEK_MODEL ?? env.THEOREM_AGENT_HEAD_DEEPSEEK_MODEL ?? 'deepseek-v4-pro';
  const hosted = normalizeEndpoint(env.THEOREM_HARNESS_URL ?? env.THEOREM_PRODUCT_API_URL ?? env.THEOREM_API_URL) ?? DEFAULT_HOSTED_ORIGIN;
  const localProxy = normalizeEndpoint(env.THEOREM_PROXY_URL ?? env.NEXT_PUBLIC_THEOREM_PROXY_URL) ?? DEFAULT_LOCAL_PROXY;
  const acp = env.NEXT_PUBLIC_COMMONPLACE_ACP_WS_URL ?? DEFAULT_LOCAL_ACP;
  const graph = normalizeEndpoint(env.THEOREM_GRAPHQL_URL ?? env.COMMONPLACE_GRAPHQL_URL) ?? `${hosted}/graphql`;

  return [
    {
      id: 'route:acp:deepseek',
      label: 'DeepSeek ACP',
      provider,
      model,
      runtime: 'CommonPlace ACP host',
      channel: 'ACP websocket',
      endpointKind: endpointKind(acp),
      protocol: 'ACP',
      authState: env.DEEPSEEK_API_KEY || env.THEOREM_AGENT_HEAD_DEEPSEEK_CREDENTIAL_REF ? 'configured' : 'unknown',
      contextWindow: numericEnv(env.DEEPSEEK_CONTEXT_WINDOW) ?? null,
      cost: configuredCost(env.DEEPSEEK_COST_LABEL),
      counters: emptyCounters(),
      status: 'unknown',
      source: fixtureSource('ACP route contract'),
    },
    {
      id: 'route:proxy:codex',
      label: 'Codex through Theorem proxy',
      provider: 'openai-compatible',
      model: env.OPENAI_MODEL ?? env.CODEX_MODEL ?? 'unknown',
      runtime: 'theorem-proxy',
      channel: 'OpenAI Responses',
      endpointKind: endpointKind(localProxy),
      protocol: 'OpenAI Responses',
      authState: env.OPENAI_API_KEY || env.THEOREM_PROXY_UPSTREAM_API_KEY ? 'configured' : 'unknown',
      contextWindow: numericEnv(env.OPENAI_CONTEXT_WINDOW) ?? null,
      cost: configuredCost(env.OPENAI_COST_LABEL),
      counters: emptyCounters(),
      status: 'unknown',
      source: fixtureSource('Proxy status route pending live probe'),
    },
    {
      id: 'route:graphql:commonplace',
      label: 'CommonPlace GraphQL',
      provider: 'theorem-commonplace-api',
      model: 'n/a',
      runtime: 'CommonPlace API proxy',
      channel: 'GraphQL',
      endpointKind: endpointKind(graph),
      protocol: 'GraphQL',
      authState: env.THEOREM_API_KEY || env.COMMONPLACE_API_KEY ? 'configured' : graph.includes('localhost') ? 'not_required' : 'unknown',
      contextWindow: null,
      cost: { known: false, source: 'unknown', label: null },
      counters: emptyCounters(),
      status: 'unknown',
      source: { mode: 'unknown', label: 'GraphQL proxy', endpoint: publicEndpointLabel(graph) },
    },
  ];
}

function buildSetupChecks(env: EnvLike): SetupCheck[] {
  const hosted = normalizeEndpoint(env.THEOREM_HARNESS_URL ?? env.THEOREM_PRODUCT_API_URL ?? env.THEOREM_API_URL) ?? DEFAULT_HOSTED_ORIGIN;
  const localHarness = normalizeEndpoint(env.THEOREM_HARNESS_LOCAL_URL ?? env.THEOREM_LOCAL_HARNESS_URL) ?? DEFAULT_LOCAL_HARNESS;
  const localProxy = normalizeEndpoint(env.THEOREM_PROXY_URL ?? env.NEXT_PUBLIC_THEOREM_PROXY_URL) ?? DEFAULT_LOCAL_PROXY;
  return [
    setupCheck('setup:local-harness', 'Local harness HTTP server', `${localHarness}/healthz`, 'Local node check is non-mutating.'),
    setupCheck('setup:hosted-harness', 'Hosted Theorem backend', `${hosted}/healthz`, 'Hosted backend health check is non-mutating.'),
    setupCheck('setup:proxy-status', 'Theorem proxy', `${localProxy}/status`, 'Proxy status confirms route counters without model execution.'),
    setupCheck('setup:graphql', 'CommonPlace GraphQL', normalizeGraphqlEndpoint(env.THEOREM_GRAPHQL_URL ?? env.COMMONPLACE_GRAPHQL_URL ?? `${hosted}/graphql`), 'GraphQL readiness should use introspection or a cheap query.'),
    {
      id: 'setup:acp',
      label: 'CommonPlace ACP websocket',
      target: env.NEXT_PUBLIC_COMMONPLACE_ACP_WS_URL ?? DEFAULT_LOCAL_ACP,
      status: 'unknown',
      checkOnly: true,
      message: 'Browser websocket connectivity is checked by the client; server marks endpoint only.',
      source: { mode: 'unknown', label: 'ACP endpoint declaration' },
    },
  ];
}

async function fetchHarnessSnapshot(
  fetchImpl: typeof fetch,
  harnessBase: string,
  generatedAt: string,
): Promise<{ workrooms: WorkroomSummary[]; receipts: Receipt[] } | null> {
  const [runsResponse, jobsResponse] = await Promise.all([
    fetchJson(fetchImpl, `${harnessBase}/harness/runs`),
    fetchJson(fetchImpl, `${harnessBase}/harness/jobs/counts`),
  ]);
  if (!runsResponse.ok) return null;

  const runs = asArray(asRecord(runsResponse.value)?.runs).map(asRecord).filter(nonNullable);
  const details = await Promise.all(
    runs.slice(0, 5).map(async (run) => {
      const runId = text(run.run_id) ?? text(run.runId);
      if (!runId) return null;
      const detail = await fetchJson(fetchImpl, `${harnessBase}/harness/runs/${encodeURIComponent(runId)}`);
      return detail.ok ? asRecord(detail.value) : null;
    }),
  );
  const detailByRun = new Map<string, Record<string, unknown>>();
  for (const detail of details) {
    const run = asRecord(detail?.run);
    const runId = text(run?.run_id) ?? text(run?.runId);
    if (runId && detail) detailByRun.set(runId, detail);
  }

  const workrooms = runs.map((run) => workroomFromRun(run, detailByRun.get(text(run.run_id) ?? text(run.runId) ?? ''), generatedAt, harnessBase));
  const receipts = runs.flatMap((run) => receiptsFromRun(run, detailByRun.get(text(run.run_id) ?? text(run.runId) ?? ''), generatedAt, harnessBase));
  const jobReceipt = jobsResponse.ok ? receiptFromJobCounts(jobsResponse.value, generatedAt, harnessBase) : null;
  const jobWorkroom = jobReceipt ? workroomFromJobCounts(jobsResponse.value, jobReceipt, generatedAt, harnessBase) : null;
  if (jobWorkroom) workrooms.push(jobWorkroom);
  if (jobReceipt) receipts.push(jobReceipt);
  return { workrooms, receipts };
}

async function fetchConnectorSnapshot(
  fetchImpl: typeof fetch,
  harnessBase: string,
  tenant: string,
  generatedAt: string,
): Promise<ToolConnection[] | null> {
  const target = `${harnessBase}/connectors?tenant_slug=${encodeURIComponent(tenant)}`;
  const response = await fetchJson(fetchImpl, target);
  if (!response.ok) return null;
  return toolsFromConnectorListing(response.value, generatedAt, target);
}

async function fetchMemorySnapshot(
  fetchImpl: typeof fetch,
  env: EnvLike,
  generatedAt: string,
): Promise<TheoremControlCenterState['memory'] | null> {
  const endpoint = mcpEndpointUrl(env);
  const response = await callMcpTool(fetchImpl, endpoint, 'graphql_query', {
    query: `query ControlCenterMemory($query:String,$limit:Int!){
      memory(query:$query, limit:$limit, contentPreviewChars:240){
        id
        kind
        title
        gist
        summary
        contentPreview
        status
        fitness
        updatedAt
        tags
      }
    }`,
    variables: {
      query: 'CommonPlace app surface boundary Workrooms Approvals Receipts route visibility',
      limit: 5,
    },
  }, mcpAuthToken(env));
  if (!response.ok) return null;

  const docs = memoryDocsFromGraphql(response.value);
  const source = liveSource('MCP GraphQL memory recall', endpoint);
  const admittedSources: ContextSource[] = docs.map((doc, index) => {
    const id = text(doc.id) ?? `memory:${index}`;
    return {
      id: `source:${slug(id) || index.toString()}`,
      title: text(doc.title) ?? text(doc.gist) ?? text(doc.summary) ?? id,
      reason: 'Matched the Workrooms, Approvals, Receipts, and route-visibility control-center query.',
      provenance: [id, text(doc.kind) ?? 'memory'],
      hydrateHref: publicEndpointLabel(endpoint),
    };
  });

  return {
    contextBundles: [
      {
        id: 'context:live-memory-preview',
        label: 'Live memory preview',
        status: 'ready',
        tokenEstimate: estimateTokens(docs.map(memoryDocPreview).join('\n')),
        admittedSources,
      },
    ],
    blocks: docs.map((doc, index) => memoryBlockFromDoc(doc, index, generatedAt, source)),
  };
}

async function fetchDesktopApprovalSnapshot(
  fetchImpl: typeof fetch,
  env: EnvLike,
  generatedAt: string,
): Promise<ApprovalCard[] | null> {
  const base = desktopRuntimeBaseUrl(env);
  const token = desktopRuntimeToken(env);
  if (!base || !token) return null;

  const target = `${base}/v1/runs`;
  const response = await fetchJsonWithHeaders(fetchImpl, target, {
    Authorization: `Bearer ${token}`,
  });
  if (!response.ok) return null;

  const runs = asArray(asRecord(response.value)?.runs).map(asRecord).filter(nonNullable);
  return runs
    .filter((run) => text(runStateValue(run)) === 'awaiting_authorization')
    .map((run) => approvalFromDesktopRun(run, generatedAt, target));
}

async function runSetupChecks(
  checks: SetupCheck[],
  checkId: string | undefined,
  fetchImpl: typeof fetch,
): Promise<SetupCheck[]> {
  const selected = checkId ? checks.filter((check) => check.id === checkId) : checks;
  const resolved = await Promise.all(
    selected.map(async (check) => {
      if (check.target.startsWith('ws:') || check.target.startsWith('wss:')) {
        return { ...check, status: 'unknown' as const, message: 'Websocket endpoint declared; browser client performs the live check.' };
      }
      try {
        const res = await fetchWithTimeout(fetchImpl, check.target, 2_500);
        return {
          ...check,
          status: res.ok ? 'ready' as const : 'warning' as const,
          message: res.ok ? `${check.label} reachable.` : `${check.label} returned ${res.status}.`,
        };
      } catch (error) {
        return {
          ...check,
          status: 'blocked' as const,
          message: `${check.label} unreachable: ${errorMessage(error)}`,
        };
      }
    }),
  );
  return checkId && !resolved.length ? checks : resolved;
}

async function fetchWithTimeout(fetchImpl: typeof fetch, target: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(target, { method: 'GET', cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(fetchImpl: typeof fetch, target: string, timeoutMs = 2_500): Promise<{
  ok: boolean;
  status: number;
  value: unknown;
  error?: string;
}> {
  try {
    const response = await fetchWithTimeout(fetchImpl, target, timeoutMs);
    const value = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, value };
  } catch (error) {
    return { ok: false, status: 0, value: null, error: errorMessage(error) };
  }
}

async function fetchJsonWithHeaders(
  fetchImpl: typeof fetch,
  target: string,
  headers: Record<string, string>,
  timeoutMs = 2_500,
): Promise<{
  ok: boolean;
  status: number;
  value: unknown;
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(target, {
      method: 'GET',
      cache: 'no-store',
      headers,
      signal: controller.signal,
    });
    const value = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, value };
  } catch (error) {
    return { ok: false, status: 0, value: null, error: errorMessage(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(
  fetchImpl: typeof fetch,
  target: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 2_500,
): Promise<{
  ok: boolean;
  status: number;
  value: unknown;
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(target, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const value = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, value };
  } catch (error) {
    return { ok: false, status: 0, value: null, error: errorMessage(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function callMcpTool(
  fetchImpl: typeof fetch,
  endpoint: string,
  name: string,
  args: Record<string, unknown>,
  token: string | undefined,
): Promise<{
  ok: boolean;
  status: number;
  value: unknown;
  error?: string;
}> {
  const response = await postJson(
    fetchImpl,
    endpoint,
    {
      jsonrpc: '2.0',
      id: `commonplace-control-center:${name}`,
      method: 'tools/call',
      params: { name, arguments: args },
    },
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  if (!response.ok) return response;

  const rpc = asRecord(response.value);
  const rpcError = asRecord(rpc?.error);
  if (rpcError) {
    return {
      ok: false,
      status: response.status,
      value: null,
      error: text(rpcError.message) ?? `MCP ${name} returned an error.`,
    };
  }

  return {
    ...response,
    value: structuredMcpContent(rpc?.result),
  };
}

async function handleDesktopApprovalDecision(
  action: Extract<TheoremControlCenterAction, { action: 'approval_decision' }>,
  env: EnvLike,
  generatedAt: Date,
  fetchImpl: typeof fetch,
): Promise<TheoremControlCenterActionResult | null> {
  const runId = desktopRunIdFromApproval(action.approvalId);
  if (!runId) return null;
  const base = desktopRuntimeBaseUrl(env);
  const token = desktopRuntimeToken(env);
  if (!base || !token) {
    return actionError(action.action, 'Desktop runtime approval route is not configured.');
  }
  if (action.decision === 'remember') {
    return actionError(action.action, 'Remembered desktop approvals require a policy scope and are not enabled for live run approvals yet.');
  }

  const targetAction = action.decision === 'deny' ? 'stop' : 'approve';
  const response = await postJson(
    fetchImpl,
    `${base}/v1/runs/${encodeURIComponent(runId)}/${targetAction}`,
    {},
    { Authorization: `Bearer ${token}` },
  );
  if (!response.ok) {
    return actionError(action.action, response.error ?? `Desktop runtime returned ${response.status}.`);
  }

  const run = asRecord(asRecord(response.value)?.run);
  const approval = approvalFromDesktopRun(run ?? { run_id: runId, state: action.decision === 'deny' ? 'stopped' : 'running' }, generatedAt.toISOString(), `${base}/v1/runs`);
  const status = action.decision === 'deny' ? 'denied' : 'approved';
  const receipt = actionReceipt({
    kind: 'approval',
    title: `Desktop run ${status}`,
    summary: `${actorLabel(action.actor)} ${status} ${runId} through the local desktop runtime.`,
    workroomId: approval.workroomId,
    actor: actorLabel(action.actor),
    generatedAt,
    changed: [approval.id, runId],
    provenance: ['commonplace-desktop-runtime', runId],
  });
  return {
    ok: true,
    action: action.action,
    message: `Desktop runtime approval ${status}.`,
    approval: {
      ...approval,
      status,
      audit: [...approval.audit, { at: receipt.happenedAt, actor: receipt.actor, action: status, receiptId: receipt.id }],
    },
    receipt,
  };
}

function applyProxyStatusToRoutes(routes: RouteCard[], status: { ok: boolean; status: number; value: unknown; error?: string }, proxyBase: string): RouteCard[] {
  const payload = asRecord(status.value);
  return routes.map((route) => {
    if (route.id !== 'route:proxy:codex') return route;
    if (!status.ok) {
      return {
        ...route,
        status: 'blocked',
        source: {
          mode: 'blocked',
          label: 'Proxy status route',
          endpoint: publicEndpointLabel(`${proxyBase}/status`),
          message: status.error ?? `Proxy status returned ${status.status}.`,
        },
      };
    }
    return {
      ...route,
      counters: {
        requestsSeen: numberValue(payload?.total_requests_seen),
        openaiResponsesSeen: numberValue(payload?.openai_responses_seen),
        anthropicMessagesSeen: numberValue(payload?.anthropic_messages_seen),
      },
      status: 'ready',
      source: liveSource('Proxy status route', `${proxyBase}/status`),
    };
  });
}

function workroomFromRun(
  run: Record<string, unknown>,
  detail: Record<string, unknown> | undefined,
  generatedAt: string,
  harnessBase: string,
): WorkroomSummary {
  const runId = text(run.run_id) ?? text(run.runId) ?? `unknown-${slug(text(run.task) ?? generatedAt)}`;
  const events = asArray(detail?.events).map(asRecord).filter(nonNullable);
  const latestEvent = events[events.length - 1];
  const latestReceiptId = latestEvent ? receiptIdForRunEvent(runId, latestEvent) : `receipt:run:${slug(runId)}:latest`;
  const task = text(run.task) ?? 'Harness run';
  const status = text(run.status);
  const actor = text(run.actor) ?? 'theorem';
  const head = text(run.agent_host) ?? text(run.agent_model) ?? text(asRecord(run.profile)?.head) ?? 'harness';
  return {
    id: `workroom:${runId}`,
    title: task.length > 72 ? `${task.slice(0, 69)}...` : task,
    task,
    state: workroomStateFromRunStatus(status),
    actor,
    head,
    latestReceiptId,
    artifactCount: runArtifactCount(run, events),
    updatedAt: text(run.updated_at) ?? text(run.updatedAt) ?? generatedAt,
    actions: recoveryActionsForRunStatus(status),
    fitness: numberValue(asRecord(run.outcome)?.fitness),
    eval: {
      id: `eval:${runId}`,
      status: 'unknown',
      fitness: numberValue(asRecord(run.outcome)?.fitness),
    },
    source: liveSource('Harness run ledger', `${harnessBase}/harness/runs/${encodeURIComponent(runId)}`),
  };
}

function receiptsFromRun(
  run: Record<string, unknown>,
  detail: Record<string, unknown> | undefined,
  generatedAt: string,
  harnessBase: string,
): Receipt[] {
  const runId = text(run.run_id) ?? text(run.runId);
  if (!runId) return [];
  return asArray(detail?.events)
    .map(asRecord)
    .filter(nonNullable)
    .map((event) => receiptFromRunEvent(run, event, generatedAt, harnessBase));
}

function receiptFromRunEvent(
  run: Record<string, unknown>,
  event: Record<string, unknown>,
  generatedAt: string,
  harnessBase: string,
): Receipt {
  const runId = text(run.run_id) ?? text(run.runId) ?? 'unknown-run';
  const eventType = text(event.type) ?? text(event.event_type) ?? 'HARNESS.EVENT';
  const payload = asRecord(event.payload);
  const title = eventType.replace(/[._-]+/g, ' ').toLowerCase();
  return {
    id: receiptIdForRunEvent(runId, event),
    workroomId: `workroom:${runId}`,
    kind: receiptKindForEvent(eventType),
    title: title.charAt(0).toUpperCase() + title.slice(1),
    summary: text(payload?.summary) ?? text(payload?.message) ?? text(payload?.text) ?? `Harness event ${eventType}.`,
    actor: text(event.agent_host) ?? text(run.actor) ?? 'theorem',
    head: text(event.agent_model) ?? text(run.agent_model) ?? text(run.agent_host) ?? 'harness',
    happenedAt: text(event.created_at) ?? text(event.createdAt) ?? generatedAt,
    changed: [eventType],
    inspect: {
      label: eventType,
      href: `${harnessBase}/harness/runs/${encodeURIComponent(runId)}`,
      bodyPreview: JSON.stringify(payload ?? {}).slice(0, 280),
    },
    recovery: ['open', 'export'],
    provenance: [runId, text(event.event_id) ?? text(event.eventId) ?? `seq:${numberValue(event.seq) ?? 0}`],
    source: liveSource('Harness run event', `${harnessBase}/harness/runs/${encodeURIComponent(runId)}`),
  };
}

function toolsFromConnectorListing(value: unknown, generatedAt: string, endpoint: string): ToolConnection[] {
  const payload = asRecord(value);
  const connectors = stringArray(payload?.connectors);
  const affordances = asArray(payload?.affordances).map(asRecord).filter(nonNullable);
  if (!connectors.length && !affordances.length) {
    return [
      {
        id: 'tool:mcp-hub',
        label: 'MCP Hub',
        kind: 'mcp',
        status: 'unknown',
        permissionSummary: 'Connector endpoint answered but has no registered tools for this tenant.',
        envHints: ['THEOREM_MCP_URL', 'THEOREM_API_TOKEN'],
        oauthRequired: false,
        lastCheckedAt: generatedAt,
        source: liveSource('Harness connector listing', endpoint, 'No registered connectors returned.'),
      },
    ];
  }

  const byServer = new Map<string, Record<string, unknown>[]>();
  for (const affordance of affordances) {
    const serverId = text(affordance.server_id) ?? 'unknown';
    byServer.set(serverId, [...(byServer.get(serverId) ?? []), affordance]);
  }
  const serverIds = connectors.length ? connectors : [...byServer.keys()];

  return serverIds.map((serverId) => {
    const tools = byServer.get(serverId) ?? [];
    const first = tools[0];
    return {
      id: `tool:${slug(serverId)}`,
      label: text(first?.label) ?? serverId,
      kind: 'connector',
      status: 'ready',
      permissionSummary: tools.length
        ? `${tools.length} registered affordance(s): ${tools.map((tool) => text(tool.tool_name) ?? 'unknown').join(', ')}.`
        : 'Connector registered; no tool affordances returned.',
      envHints: [],
      oauthRequired: false,
      lastCheckedAt: generatedAt,
      source: liveSource('Harness connector listing', endpoint),
    };
  });
}

function receiptFromJobCounts(value: unknown, generatedAt: string, harnessBase: string): Receipt {
  const payload = asRecord(value);
  const counts = dispatchCounts(value);
  const configured = payload?.dispatch_configured === true;
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const summary = configured
    ? total
      ? `Dispatch queue has ${total} job(s): ${counts.map((item) => `${item.state} ${item.count}`).join(', ')}.`
      : 'Dispatch queue is configured with no queued jobs.'
    : 'Dispatch queue is not configured on this harness server.';
  return {
    id: 'receipt:dispatch-jobs:counts',
    workroomId: 'workroom:dispatch-jobs',
    kind: 'trace',
    title: 'Dispatch job counts',
    summary,
    actor: 'theorem-harness-server',
    head: 'dispatch',
    happenedAt: generatedAt,
    changed: counts.map((item) => `dispatch:${item.state}`),
    inspect: {
      label: 'Dispatch counts',
      href: `${harnessBase}/harness/jobs/counts`,
      bodyPreview: JSON.stringify({ dispatch_configured: configured, counts }).slice(0, 280),
    },
    recovery: ['open', 'export'],
    provenance: ['harness/jobs/counts'],
    source: liveSource('Harness dispatch job counts', `${harnessBase}/harness/jobs/counts`),
  };
}

function workroomFromJobCounts(
  value: unknown,
  receipt: Receipt,
  generatedAt: string,
  harnessBase: string,
): WorkroomSummary | null {
  const counts = dispatchCounts(value);
  const configured = asRecord(value)?.dispatch_configured === true;
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  if (!configured && total === 0) return null;
  const pending = countForState(counts, 'pending');
  const running = countForState(counts, 'running') + countForState(counts, 'claimed');
  const failed = countForState(counts, 'failed') + countForState(counts, 'dead');
  return {
    id: 'workroom:dispatch-jobs',
    title: 'Dispatch job queue',
    task: 'Track hot execution state mirrored from Theorem Dispatch v2 into the Postgres dispatch queue.',
    state: failed ? 'blocked' : running ? 'running' : pending ? 'queued' : total ? 'done' : 'unknown',
    actor: 'theorem-harness-server',
    head: 'dispatch',
    latestReceiptId: receipt.id,
    artifactCount: total,
    updatedAt: generatedAt,
    actions: ['open', 'export'],
    fitness: null,
    eval: null,
    source: liveSource('Harness dispatch job counts', `${harnessBase}/harness/jobs/counts`),
  };
}

function dispatchCounts(value: unknown): Array<{ state: string; count: number }> {
  const counts = asRecord(value)?.counts;
  if (Array.isArray(counts)) {
    return counts
      .map(asRecord)
      .filter(nonNullable)
      .map((item) => ({
        state: text(item.state) ?? text(item.dispatch_state) ?? text(item.status) ?? 'unknown',
        count: numberValue(item.count) ?? numberValue(item.total) ?? 0,
      }))
      .filter((item) => item.count > 0 || item.state !== 'unknown');
  }
  const record = asRecord(counts);
  if (!record) return [];
  return Object.entries(record)
    .map(([state, count]) => ({ state, count: numberValue(count) ?? 0 }))
    .filter((item) => item.count > 0);
}

function countForState(counts: Array<{ state: string; count: number }>, state: string): number {
  return counts
    .filter((item) => item.state.toLowerCase() === state)
    .reduce((sum, item) => sum + item.count, 0);
}

function memoryDocsFromGraphql(value: unknown): Record<string, unknown>[] {
  const payload = asRecord(value);
  const data = asRecord(payload?.data) ?? asRecord(asRecord(payload?.result)?.data) ?? payload;
  return asArray(asRecord(data)?.memory).map(asRecord).filter(nonNullable);
}

function memoryBlockFromDoc(
  doc: Record<string, unknown>,
  index: number,
  generatedAt: string,
  source: ControlCenterSource,
): MemoryBlock {
  const id = text(doc.id) ?? `memory:${index}`;
  const preview = memoryDocPreview(doc);
  const status = text(doc.status);
  return {
    id: `memory:block:${slug(id) || index.toString()}`,
    title: text(doc.title) ?? text(doc.gist) ?? text(doc.summary) ?? id,
    preview,
    status: status === 'forgotten' || status === 'corrected' || status === 'pinned' ? status : 'active',
    visibleLimit: Math.max(preview.length, 1_200),
    provenance: [id, text(doc.kind) ?? 'memory'],
    actions: ['edit', 'pin', 'forget', 'correct'],
    updatedAt: text(doc.updatedAt) ?? text(doc.updated_at) ?? generatedAt,
    source,
  };
}

function memoryDocPreview(doc: Record<string, unknown>): string {
  return text(doc.contentPreview) ?? text(doc.content_preview) ?? text(doc.summary) ?? text(doc.gist) ?? text(doc.title) ?? '';
}

function approvalFromDesktopRun(
  run: Record<string, unknown>,
  generatedAt: string,
  endpoint: string,
): ApprovalCard {
  const runId = text(run.run_id) ?? text(run.runId) ?? text(run.id) ?? `run-${slug(generatedAt)}`;
  const spec = asRecord(run.spec);
  const authorization = asRecord(run.authorization);
  const intent = text(spec?.intent) ?? text(run.intent) ?? 'Desktop run approval';
  const tier = text(spec?.action_tier) ?? text(authorization?.tier) ?? 'unknown';
  return {
    id: `approval:desktop-run:${encodeURIComponent(runId)}`,
    workroomId: `workroom:desktop-run:${slug(runId)}`,
    status: 'pending',
    title: `Approve ${intent.length > 56 ? `${intent.slice(0, 53)}...` : intent}`,
    summary: `Local desktop runtime is holding run ${runId} at action tier ${tier}.`,
    riskClass: tier.includes('3') ? 'destructive' : 'write',
    isolationTier: 'trusted_local',
    requestedBy: 'commonplace-desktop-runtime',
    toolName: 'desktop_run_approval',
    target: runId,
    commandSummary: intent,
    audit: [{ at: generatedAt, actor: 'commonplace-desktop-runtime', action: 'awaiting_authorization' }],
    actions: ['approve_once', 'deny'],
    source: liveSource('Desktop runtime held runs', endpoint),
  };
}

function structuredMcpContent(value: unknown): unknown {
  const result = asRecord(value);
  if (!result) return value;
  if (result.structuredContent !== undefined) return result.structuredContent;
  const content = asArray(result.content);
  for (const entry of content) {
    const record = asRecord(entry);
    const body = text(record?.text);
    if (!body) continue;
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return { text: body };
    }
  }
  return result;
}

function fixtureWorkrooms(generatedAt: string): WorkroomSummary[] {
  return [
    {
      id: 'workroom:agent-control-center',
      title: 'Agent Workroom Control Center',
      task: 'Build the app.theoremharness.com product control room around Workrooms, Approvals, and Receipts.',
      state: 'running',
      actor: 'codex',
      head: 'backend',
      latestReceiptId: 'receipt:route-contract',
      artifactCount: 3,
      updatedAt: generatedAt,
      actions: ['open', 'export'],
      fitness: null,
      eval: { id: 'eval:agent-control-center', status: 'candidate', fitness: null },
      source: fixtureSource('Planning checklist PT-003'),
    },
    {
      id: 'workroom:memory-context',
      title: 'Memory and Context Cockpit',
      task: 'Expose admitted context, provenance, hydration, and read-write memory block actions.',
      state: 'queued',
      actor: 'theorem',
      head: 'memory',
      latestReceiptId: 'receipt:memory-contract',
      artifactCount: 1,
      updatedAt: generatedAt,
      actions: ['open'],
      fitness: null,
      eval: null,
      source: fixtureSource('Planning checklist PT-009'),
    },
  ];
}

function fixtureApprovals(generatedAt: string): ApprovalCard[] {
  return [
    {
      id: 'approval:file-write-review',
      workroomId: 'workroom:agent-control-center',
      status: 'pending',
      title: 'Review staged file write',
      summary: 'ACP staged a file write review for the code-agent route contract.',
      riskClass: 'write',
      isolationTier: 'trusted_local',
      requestedBy: 'acp:deepseek',
      toolName: 'file_write_review',
      target: 'apps/web/src/lib/theorem-control-center.ts',
      diffSummary: 'Adds backend DTOs and action receipts.',
      audit: [{ at: generatedAt, actor: 'acp:deepseek', action: 'requested' }],
      actions: ['approve_once', 'remember', 'deny'],
      source: fixtureSource('ACP file_write_review event'),
    },
    {
      id: 'approval:command-health-check',
      workroomId: 'workroom:agent-control-center',
      status: 'pending',
      title: 'Run check-only doctor',
      summary: 'Setup wizard wants to run non-mutating readiness checks.',
      riskClass: 'network',
      isolationTier: 'sandboxed',
      requestedBy: 'commonplace:setup',
      toolName: 'setup_check',
      target: '/api/theorem/control-center',
      commandSummary: 'GET health/status endpoints only; no model/tool execution.',
      audit: [{ at: generatedAt, actor: 'commonplace:setup', action: 'requested' }],
      actions: ['approve_once', 'remember', 'deny'],
      source: fixtureSource('Setup wizard check-only flow'),
    },
  ];
}

function fixtureReceipts(generatedAt: string): Receipt[] {
  return [
    {
      id: 'receipt:route-contract',
      workroomId: 'workroom:agent-control-center',
      kind: 'route_check',
      title: 'Route taxonomy established',
      summary: 'Provider, model, runtime, and channel are represented separately.',
      actor: 'codex',
      head: 'backend',
      happenedAt: generatedAt,
      changed: ['RouteCard'],
      inspect: { label: 'Route contract', bodyPreview: 'provider / model / runtime / channel / endpointKind / protocol' },
      recovery: ['open', 'export'],
      provenance: ['FEATURE-HANDOFF-GHIDRA-v2', 'PT-006'],
      source: fixtureSource('Backend contract fixture'),
    },
    {
      id: 'receipt:memory-contract',
      workroomId: 'workroom:memory-context',
      kind: 'memory',
      title: 'Memory block actions defined',
      summary: 'Edit, pin, forget, and correct are represented as receipted actions.',
      actor: 'codex',
      head: 'backend',
      happenedAt: generatedAt,
      changed: ['MemoryBlock'],
      inspect: { label: 'Memory action contract', bodyPreview: 'Retain provenance and receipt every memory mutation.' },
      recovery: ['open', 'export'],
      provenance: ['Letta parity target', 'PT-009'],
      source: fixtureSource('Backend contract fixture'),
    },
  ];
}

function fixtureCommands(routes: RouteCard[]): CommandCatalogItem[] {
  return [
    {
      id: 'command:open-workroom',
      label: 'Open workroom',
      locus: 'local',
      description: 'Open a durable workroom row and receipt drawer.',
      riskClass: 'read',
    },
    {
      id: 'command:run-agent',
      label: 'Run agent',
      locus: 'agent',
      description: 'Start the selected ACP or API-backed agent route.',
      riskClass: 'write',
      routeId: routes[0]?.id,
    },
    {
      id: 'command:check-route',
      label: 'Check route',
      locus: 'admin',
      description: 'Run non-mutating provider/model/runtime/channel readiness checks.',
      riskClass: 'network',
      routeId: routes[1]?.id,
    },
  ];
}

function fixtureMemory(generatedAt: string): TheoremControlCenterState['memory'] {
  return {
    contextBundles: [
      {
        id: 'context:first-turn-preview',
        label: 'First-turn context preview',
        status: 'unknown',
        tokenEstimate: null,
        admittedSources: [
          {
            id: 'source:agent-handoff',
            title: 'Agent Workroom Control Center handoff',
            reason: 'Defines product primitives and parity targets.',
            provenance: ['FEATURE-HANDOFF-GHIDRA-v2'],
          },
          {
            id: 'source:commonplace-boundary',
            title: 'CommonPlace product boundary',
            reason: 'Prevents implementation in the wrong surface.',
            provenance: ['CommonPlace/docs/harness-console-absorption.md'],
          },
        ],
      },
    ],
    blocks: [
      {
        id: 'memory:block:product-boundary',
        title: 'CommonPlace app surface boundary',
        preview: 'app.theoremharness.com is the CommonPlace app surface; Theorem remains substrate.',
        status: 'pinned',
        visibleLimit: 1_200,
        provenance: ['Surface Clarification', 'CommonPlace absorption doc'],
        actions: ['edit', 'pin', 'forget', 'correct'],
        updatedAt: generatedAt,
        source: fixtureSource('Memory Cockpit fixture'),
      },
    ],
  };
}

function fixtureTools(generatedAt: string, env: EnvLike): ToolConnection[] {
  return [
    {
      id: 'tool:mcp-hub',
      label: 'MCP Hub',
      kind: 'mcp',
      status: 'unknown',
      permissionSummary: 'Lists, validates, and connects MCP servers through server-side config.',
      envHints: ['THEOREM_MCP_URL', 'THEOREM_API_TOKEN'],
      oauthRequired: false,
      lastCheckedAt: null,
      source: fixtureSource('Harness Console MCP-Hub'),
    },
    {
      id: 'tool:github',
      label: 'GitHub connector',
      kind: 'connector',
      status: env.GITHUB_TOKEN || env.GITHUB_APP_INSTALLATION_ID ? 'ready' : 'unknown',
      permissionSummary: 'Reads repository metadata and may create PR artifacts when explicitly invoked.',
      envHints: ['GITHUB_TOKEN', 'GITHUB_APP_INSTALLATION_ID'],
      oauthRequired: true,
      lastCheckedAt: generatedAt,
      source: fixtureSource('Connector manifest'),
    },
    {
      id: 'skill:self-improvement',
      label: 'Skill self-improvement',
      kind: 'skill',
      status: 'pending',
      permissionSummary: 'Promotes high-fitness memories into skill-pack candidates gated by close_loop_if_allowed.',
      envHints: [],
      oauthRequired: false,
      lastCheckedAt: null,
      source: fixtureSource('Hermes skill-loop parity target'),
    },
  ];
}

function harnessBaseUrl(env: EnvLike): string {
  return normalizeEndpoint(
    env.THEOREM_HARNESS_URL ??
      env.THEOREM_PRODUCT_API_URL ??
      env.THEOREM_API_URL ??
      env.THEOREM_HARNESS_LOCAL_URL ??
      env.THEOREM_LOCAL_HARNESS_URL,
  ) ?? DEFAULT_LOCAL_HARNESS;
}

function proxyBaseUrl(env: EnvLike): string {
  return normalizeEndpoint(env.THEOREM_PROXY_URL ?? env.NEXT_PUBLIC_THEOREM_PROXY_URL) ?? DEFAULT_LOCAL_PROXY;
}

export function mcpEndpointUrl(env: EnvLike): string {
  const explicit = normalizeEndpoint(
    env.THEOREM_MEMORY_MCP_URL ??
      env.THEOREM_MCP_URL ??
      env.THEOREM_LOCAL_NODE_MCP_URL ??
      env.NEXT_PUBLIC_THEOREM_MCP_URL,
  );
  if (explicit) return explicit.endsWith('/mcp') ? explicit : `${explicit}/mcp`;
  const node = normalizeEndpoint(env.THEOREM_LOCAL_NODE_URL ?? env.NEXT_PUBLIC_THEOREM_LOCAL_NODE_URL) ?? DEFAULT_LOCAL_NODE;
  return `${node}/mcp`;
}

export function mcpAuthToken(env: EnvLike): string | undefined {
  return text(env.THEOREM_MCP_AUTH_TOKEN) ?? text(env.THEOREM_API_TOKEN) ?? text(env.HARNESS_API_KEY);
}

function desktopRuntimeBaseUrl(env: EnvLike): string | undefined {
  return normalizeEndpoint(
    env.THEOREM_DESKTOP_RUNTIME_URL ??
      env.THEOREM_LOCAL_CONTROL_URL ??
      env.COMMONPLACE_DESKTOP_RUNTIME_URL,
  );
}

function desktopRuntimeToken(env: EnvLike): string | undefined {
  return text(env.THEOREM_DESKTOP_RUNTIME_TOKEN) ?? text(env.THEOREM_LOCAL_CONTROL_TOKEN) ?? text(env.COMMONPLACE_DESKTOP_RUNTIME_TOKEN);
}

function desktopRunIdFromApproval(approvalId: string): string | null {
  const prefix = 'approval:desktop-run:';
  if (!approvalId.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(approvalId.slice(prefix.length));
  } catch {
    return approvalId.slice(prefix.length);
  }
}

function runStateValue(run: Record<string, unknown>): unknown {
  return run.state ?? run.run_state ?? run.runState;
}

function liveSource(label: string, endpoint: string, message?: string): ControlCenterSource {
  return {
    mode: 'live',
    label,
    endpoint: publicEndpointLabel(endpoint),
    message,
  };
}

function workroomStateFromRunStatus(status: string | undefined): WorkroomState {
  const normalized = status?.toLowerCase().replace(/[^a-z0-9]+/g, '_') ?? '';
  if (['queued', 'created', 'pending', 'planned'].includes(normalized)) return 'queued';
  if (['running', 'agent_acting', 'validating', 'in_progress', 'working'].includes(normalized)) return 'running';
  if (['blocked', 'failed', 'errored', 'error'].includes(normalized)) return 'blocked';
  if (['review', 'needs_review', 'approval', 'pending_approval'].includes(normalized)) return 'review';
  if (['done', 'closed', 'complete', 'completed', 'outcome_recorded'].includes(normalized)) return 'done';
  if (['archived', 'cancelled', 'canceled'].includes(normalized)) return 'archived';
  return 'unknown';
}

function recoveryActionsForRunStatus(status: string | undefined): WorkroomSummary['actions'] {
  const state = workroomStateFromRunStatus(status);
  if (state === 'running' || state === 'queued') return ['open', 'export'];
  if (state === 'done' || state === 'archived') return ['fork', 'open', 'export'];
  if (state === 'blocked' || state === 'review') return ['resume', 'fork', 'open', 'export'];
  return ['open'];
}

function runArtifactCount(run: Record<string, unknown>, events: Record<string, unknown>[]): number {
  return (
    asArray(run.cache_events).length +
    asArray(run.validators).length +
    asArray(run.learning_patches).length +
    events.length
  );
}

function receiptKindForEvent(eventType: string): Receipt['kind'] {
  const normalized = eventType.toLowerCase();
  if (normalized.includes('approval') || normalized.includes('policy')) return 'approval';
  if (normalized.includes('memory')) return 'memory';
  if (normalized.includes('trace') || normalized.includes('run')) return 'trace';
  if (normalized.includes('tool')) return 'tool_health';
  if (normalized.includes('command') || normalized.includes('host')) return 'command';
  if (normalized.includes('file') || normalized.includes('patch') || normalized.includes('diff')) return 'file_diff';
  return 'trace';
}

function receiptIdForRunEvent(runId: string, event: Record<string, unknown>): string {
  const eventId = text(event.event_id) ?? text(event.eventId);
  if (eventId) return `receipt:${slug(runId)}:${slug(eventId)}`;
  const seq = numberValue(event.seq) ?? 0;
  const eventType = text(event.type) ?? text(event.event_type) ?? 'event';
  return `receipt:${slug(runId)}:${slug(eventType)}:${seq}`;
}

function fixtureSkillCandidates(): SkillCandidate[] {
  return [
    {
      id: 'skill-candidate:memory-to-skill',
      title: 'Promote high-fitness memory into skill pack',
      sourceMemoryId: 'memory:block:product-boundary',
      status: 'candidate',
      fitness: null,
      gate: 'close_loop_if_allowed',
      receipts: [],
    },
  ];
}

function fixtureReconstructionPackets(): ReconstructionPacket[] {
  return [
    reconstructionPacketForTarget('letta_memory_blocks'),
    reconstructionPacketForTarget('openclaw_runtime_contract'),
    reconstructionPacketForTarget('hermes_skill_loop'),
  ];
}

function fixtureEvals(): EvalTrace[] {
  return [
    {
      id: 'eval:agent-control-center',
      workroomId: 'workroom:agent-control-center',
      status: 'candidate',
      fitness: null,
      receipts: ['receipt:route-contract'],
    },
  ];
}

function reconstructionPacketForTarget(target: ReconstructionPacketTarget): ReconstructionPacket {
  switch (target) {
    case 'letta_memory_blocks':
      return {
        id: 'reconstruction:letta-memory-blocks',
        target: 'Letta memory blocks',
        status: 'needed',
        evidence: ['docs.letta.com ADE and core-memory pages', 'letta-ai/letta source'],
        oracle: 'Memory block edit/pin/forget/correct lifecycle with provenance and visible limits.',
      };
    case 'openclaw_runtime_contract':
      return {
        id: 'reconstruction:openclaw-runtime-contract',
        target: 'OpenClaw agent runtime contract',
        status: 'needed',
        evidence: ['docs.openclaw.ai plugin SDK', 'docs.openclaw.ai agent runtime'],
        oracle: 'Provider/model/runtime/channel route resolves without conflating layers.',
      };
    case 'hermes_skill_loop':
      return {
        id: 'reconstruction:hermes-skill-loop',
        target: 'Hermes skill self-improvement loop',
        status: 'needed',
        evidence: ['Hermes Agent repo and docs'],
        oracle: 'Memory-to-skill candidate cannot activate before gate and shadow eval receipt.',
      };
  }
}

type ReconstructionPacketTarget = 'letta_memory_blocks' | 'openclaw_runtime_contract' | 'hermes_skill_loop';

function summarizeHealth(routes: RouteCard[], checks: SetupCheck[], approvals: ApprovalCard[]): TheoremControlCenterState['health'] {
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length;
  const configuredRoutes = routes.filter((route) => route.authState === 'configured' || route.authState === 'not_required').length;
  const blockedChecks = checks.filter((check) => check.status === 'blocked').length;
  if (blockedChecks) {
    return { status: 'blocked', summary: `${blockedChecks} setup check(s) are blocked.` };
  }
  return {
    status: pendingApprovals ? 'warning' : configuredRoutes ? 'ready' : 'unknown',
    summary: `${pendingApprovals} pending approval(s), ${configuredRoutes} configured route(s).`,
  };
}

function actionReceipt(input: {
  kind: Receipt['kind'];
  title: string;
  summary: string;
  workroomId: string;
  actor: string;
  generatedAt: Date;
  changed: string[];
  provenance: string[];
}): Receipt {
  const happenedAt = input.generatedAt.toISOString();
  return {
    id: `receipt:${slug(input.kind)}:${slug(input.title)}:${input.generatedAt.getTime().toString(36)}`,
    workroomId: input.workroomId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    actor: input.actor,
    head: 'backend',
    happenedAt,
    changed: input.changed,
    inspect: { label: input.title, bodyPreview: input.summary },
    recovery: ['open', 'export'],
    provenance: input.provenance,
    source: fixtureSource('CommonPlace action receipt'),
  };
}

function actionError(action: TheoremControlCenterAction['action'], message: string): TheoremControlCenterActionResult {
  return { ok: false, action, message };
}

function setupCheck(id: string, label: string, target: string, message: string): SetupCheck {
  return {
    id,
    label,
    target: publicEndpointLabel(target),
    status: 'unknown',
    checkOnly: true,
    message,
    source: { mode: 'unknown', label: 'Declared setup endpoint', endpoint: publicEndpointLabel(target) },
  };
}

function configuredCost(value: string | undefined): RouteCard['cost'] {
  return value?.trim()
    ? { known: true, source: 'configured', label: value.trim() }
    : { known: false, source: 'unknown', label: null };
}

function emptyCounters(): RouteCard['counters'] {
  return {
    requestsSeen: null,
    openaiResponsesSeen: null,
    anthropicMessagesSeen: null,
  };
}

function memoryStatusForAction(action: MemoryAction): MemoryBlock['status'] {
  switch (action) {
    case 'pin':
      return 'pinned';
    case 'forget':
      return 'forgotten';
    case 'correct':
      return 'corrected';
    case 'edit':
      return 'active';
  }
}

function fixtureSource(label: string): ControlCenterSource {
  return { mode: 'fixture', label };
}

function normalizeEndpoint(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).toString().replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function normalizeGraphqlEndpoint(value: string): string {
  const normalized = normalizeEndpoint(value) ?? `${DEFAULT_HOSTED_ORIGIN}/graphql`;
  try {
    const url = new URL(normalized);
    if (!url.pathname.endsWith('/graphql')) {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/graphql`.replace(/\/{2,}/g, '/');
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return normalized;
  }
}

function endpointKind(value: string): RouteCard['endpointKind'] {
  if (value.includes('127.0.0.1') || value.includes('localhost')) return 'loopback';
  if (value.startsWith('/')) return 'browser-proxy';
  if (value.startsWith('https://') || value.startsWith('http://')) return 'hosted';
  return 'unknown';
}

function publicEndpointLabel(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return value.split('?')[0].replace(/\/+$/, '');
  }
}

function numericEnv(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function estimateTokens(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Math.ceil(trimmed.length / 4) : null;
}

function stringArray(value: unknown): string[] {
  return asArray(value).map(text).filter(nonNullable);
}

function actorLabel(actor: string | undefined): string {
  return actor?.trim() || 'commonplace:user';
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredText(value: unknown, message: string): string {
  const normalized = text(value);
  if (!normalized) throw new Error(message);
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isApprovalDecision(value: unknown): value is ApprovalDecision {
  return value === 'approve_once' || value === 'remember' || value === 'deny';
}

function isMemoryAction(value: unknown): value is MemoryAction {
  return value === 'edit' || value === 'pin' || value === 'forget' || value === 'correct';
}

function isSkillCandidateDecision(value: unknown): value is SkillCandidateDecision {
  return value === 'shadow_eval' || value === 'approve' || value === 'reject';
}

function isReconstructionTarget(value: unknown): value is ReconstructionPacketTarget {
  return value === 'letta_memory_blocks' || value === 'openclaw_runtime_contract' || value === 'hermes_skill_loop';
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
