/**
 * Operator surface contract — the held-not-clobbered seam between the frontend
 * (Claude Code lane) and the Theorem substrate (Codex lane).
 *
 * HANDOFF-OPERATOR-SURFACE OP2-OP6. The Operator surface is the front-end of the
 * operating protocol: the queue, the bays, the run drawer, the gate, and the
 * shift summary — a porcelain sibling to the Workroom Control Center.
 *
 * The frontend imports these DTO types and calls GET/POST /api/theorem/operator.
 * Every fixture builder below is swapped for a live Theorem source by the backend
 * lane WITHOUT changing a type, flipping `source.mode` from `fixture` to `live`
 * only when a real endpoint answered. This mirrors theorem-control-center.ts.
 *
 * Live-wiring map (fixture builder -> live source):
 *   fixtureBays / fixtureTasks  -> workGraph, nextTaskNode, taskRef (GraphQL reads)
 *   send_to_bay action          -> claimTaskNode (claim on behalf) + coordinate mention
 *   reorder_queue action        -> task-node priority write
 *   fixtureDrawer               -> coordinationStream / relatedEvents / harnessRun (cursor-tailed)
 *   fixtureGate                 -> task review-state + peer-review records + acceptance marks
 *   gate_pass / gate_bounce     -> gate record write + task-node state advance + mention
 *   fixtureShiftSummary         -> roomDigest / openPings rollup
 *
 * Invariants (HANDOFF-OPERATOR-SURFACE):
 *   1. Queue renders substrate state only — no UI-local task store.
 *   2. WIP is structural: assignment to an occupied bay is impossible in the UI
 *      AND refused by the mutation (handleOperatorAction below).
 *   4. The gate never passes without rendered evidence: gate_pass is refused
 *      unless every acceptance mark is met AND a cross-review verdict exists.
 *   6. Game vocabulary stays out; this is the enterprise skin.
 */

// ---------------------------------------------------------------------------
// Source honesty
// ---------------------------------------------------------------------------

export type OperatorSourceMode = 'live' | 'fixture' | 'unknown' | 'blocked';

export interface OperatorSource {
  mode: OperatorSourceMode;
  label: string;
  endpoint?: string;
  message?: string;
}

export function fixtureSource(label: string, endpoint?: string): OperatorSource {
  return {
    mode: 'fixture',
    label,
    endpoint,
    message: 'Deterministic fixture. Swapped for live Theorem substrate behind the same DTO type.',
  };
}
export function liveSource(label: string, endpoint?: string): OperatorSource {
  return { mode: 'live', label, endpoint };
}
export function unknownSource(label: string, message?: string): OperatorSource {
  return { mode: 'unknown', label, message: message ?? 'Source not verified.' };
}
export function blockedSource(label: string, message: string): OperatorSource {
  return { mode: 'blocked', label, message };
}

// ---------------------------------------------------------------------------
// Heads, tasks, bays (OP2)
// ---------------------------------------------------------------------------

/** Registered heads occupy bays; WIP == head count. */
export type HeadId = 'claude-code' | 'codex' | 'claude-ai' | (string & {});

export interface RegisteredHead {
  id: HeadId;
  label: string;
}

/** Legend marks from the Build Table convention: `[-]` open, `[x]` verified, `[~]` deferred. */
export type TaskStatus = 'queued' | 'claimed' | 'blocked' | 'review' | 'done' | 'deferred';

/** Board lanes. `now` == claimed (also surfaced in the bays). */
export type TaskLane = 'now' | 'next' | 'icebox' | 'done';

export interface Prerequisite {
  taskId: string;
  goal: string;
  /** A blocked row is one where at least one prerequisite is unmet. */
  met: boolean;
}

export interface TaskClaim {
  head: HeadId;
  claimedAt: string; // ISO
}

export interface SourceDocRef {
  id: string;
  label: string;
  href?: string;
}

/** Checklist completion of a task's Build Table ([x] over total ChecklistItems). */
export interface ChecklistProgress {
  done: number;
  total: number;
}

export interface OperatorTask {
  id: string; // task node id
  goal: string;
  lane: TaskLane;
  status: TaskStatus;
  /** Ordering within Next. Drag-to-reorder writes this. Lower is higher priority. */
  priority: number;
  /** Back-link edge to the source handoff document. */
  sourceDoc?: SourceDocRef;
  /** Lane chip: which lane owns it (frontend / backend / substrate / etc). */
  laneChip?: string;
  prerequisites: Prerequisite[];
  /** Present when claimed -> occupies a bay. */
  claim?: TaskClaim;
  /** Optimistic-concurrency epoch from the durable TaskNode. */
  claimEpoch?: number;
  /** Age in ms, for age display and the 7-day icebox sweep. */
  ageMs: number;
  fileScope?: string[];
  /** Link to the run drawer history. */
  runId?: string;
  /** Build Table completion; drives the bay progress bar. The substrate stores
      ChecklistItems — the live source binds this directly. */
  checklist?: ChecklistProgress;
  source: OperatorSource;
}

/** PR state light for a bay's tri-segment footer, deterministic from repo state. */
export type PrLight = 'none' | 'open' | 'merged';

export interface Bay {
  head: HeadId;
  label: string;
  /** The claimed task card, or null for an empty bay. */
  task: OperatorTask | null;
  /** True only while the head is actively streaming output; the live dot pulses. */
  streaming: boolean;
  /** Tri-segment footer, cell 1. */
  prLight: PrLight;
  /** Tri-segment footer, cell 2: the last completed step's label. */
  lastStep?: string;
  source: OperatorSource;
}

/** Three discrete urgency stops for the bay's left rail. Never a spectrum. */
export type BayUrgency = 'calm' | 'waiting' | 'blocked';

/** Rail color for a bay: blocked task -> blocked; an urgent message from this
    head awaiting the human -> waiting; otherwise calm. */
export function bayUrgency(bay: Bay, urgentFromHeads: Set<string>): BayUrgency {
  if (bay.task && isBlocked(bay.task)) return 'blocked';
  if (urgentFromHeads.has(bay.head)) return 'waiting';
  return 'calm';
}

/** True when a task cannot be assigned (has an unmet prerequisite). */
export function isBlocked(task: OperatorTask): boolean {
  return task.prerequisites.some((p) => !p.met);
}

/** The named unmet prerequisites, for the gated-assignment refusal message. */
export function unmetPrerequisites(task: OperatorTask): Prerequisite[] {
  return task.prerequisites.filter((p) => !p.met);
}

// The 7-day icebox sweep threshold (operating protocol rule 3).
export const ICEBOX_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Run drawer (OP4)
// ---------------------------------------------------------------------------

export type DrawerEventKind =
  | 'claim'
  | 'intent'
  | 'record'
  | 'contribution'
  | 'checklist'
  | 'stream'
  | 'release'
  | 'outcome'
  | 'mention';

export interface DrawerEvent {
  id: string;
  at: string; // ISO
  actor: string;
  kind: DrawerEventKind;
  summary: string;
  /** Expandable payload detail. */
  payload?: string;
}

export interface VerifyItem {
  id: string;
  label: string;
  done: boolean;
  /** Cited evidence recorded by the head when the item is checked. */
  evidence?: string;
}

/** A message in the task's room (the Chat section of the Room Panel). */
export interface RoomMessage {
  id: string;
  at: string; // ISO
  from: string;
  text: string;
}

export interface RunDrawer {
  taskId: string;
  goal: string;
  /** Verify First checklist, rendered at the top of the drawer (OP4). */
  verifyFirst: VerifyItem[];
  /** Deploy-log event stream, chronological. */
  events: DrawerEvent[];
  /** Stream cursor for the live tail (Invariant 5: cursor-based, degrade to poll). */
  cursor?: string;
  /** Active tasks cursor-tail live; done tasks reconstruct cold from the substrate. */
  live: boolean;
  /** The claimed task's spec markdown, rendered in the Room Panel's Spec section.
      Live source: the handoff document body with Build Table states bound. */
  specMarkdown?: string;
  /** Footprint file list (coordination_intent.footprint + presence.changed_files). */
  footprint?: string[];
  /** Room chat tail for the panel's Chat section. */
  messages?: RoomMessage[];
  source: OperatorSource;
}

// ---------------------------------------------------------------------------
// The gate (OP5)
// ---------------------------------------------------------------------------

export interface CitedEvidence {
  label: string;
  /** Linked, not pasted (Invariant 4). */
  href?: string;
}

export interface AcceptanceMark {
  id: string;
  label: string;
  met: boolean;
  evidence?: CitedEvidence;
}

export type CrossReviewVerdict = 'pass' | 'concerns' | 'fail' | 'pending';

export interface CrossReview {
  reviewer: HeadId;
  verdict: CrossReviewVerdict;
  /** What the reviewer tried to break. */
  triedToBreak: string;
  at: string;
}

export interface ChangedFile {
  path: string;
  added: number;
  removed: number;
}

export interface CommitLink {
  sha: string;
  message: string;
  href?: string;
}

export interface GateCard {
  taskId: string;
  goal: string;
  acceptance: AcceptanceMark[];
  /** null -> Pass is disabled and the missing item is named (Invariant 4). */
  crossReview: CrossReview | null;
  changedFiles: ChangedFile[];
  commits: CommitLink[];
  /** Bounce returns the task to this head with a mention. */
  owner: HeadId;
  source: OperatorSource;
}

/** Invariant 4 predicate: the gate may only Pass with full evidence + a cross-review. */
export function gateReady(card: GateCard): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  const unmet = card.acceptance.filter((a) => !a.met);
  if (unmet.length > 0) missing.push(`${unmet.length} acceptance mark(s) unmet`);
  const uncited = card.acceptance.filter((a) => a.met && !a.evidence);
  if (uncited.length > 0) missing.push(`${uncited.length} acceptance mark(s) missing cited evidence`);
  if (!card.crossReview || card.crossReview.verdict === 'pending') missing.push('cross-review verdict');
  return { ready: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Shift summary (OP6)
// ---------------------------------------------------------------------------

export type GateStatus = 'passed' | 'merge-ready' | 'bounced' | 'pending';

export interface ShiftCompleted {
  taskId: string;
  goal: string;
  gateStatus: GateStatus;
}
export interface ShiftBlocked {
  taskId: string;
  goal: string;
  blockers: string[];
}
export interface ShiftIceboxMove {
  taskId: string;
  goal: string;
}
export interface ShiftUrgentMessage {
  id: string;
  from: string;
  text: string;
}

export interface ShiftSummary {
  /** "Since you last looked" — the rollup window. */
  since: string;
  completed: ShiftCompleted[];
  newlyBlocked: ShiftBlocked[];
  reviewReadyCount: number;
  queueDepth: number;
  iceboxMovements: ShiftIceboxMove[];
  /** `block`-urgency messages awaiting the human. */
  urgentMessages: ShiftUrgentMessage[];
  source: OperatorSource;
}

// ---------------------------------------------------------------------------
// Session bootstrap (OP3) — dispatch-as-spawner is out of scope; v1 assigns +
// renders a copy-ready bootstrap block. Graduates to true dispatch with no UI
// change when the receiver lands.
// ---------------------------------------------------------------------------

export interface SessionBootstrap {
  taskId: string;
  head: HeadId;
  handoffPath: string;
  /** The one-line session opener that invokes the AGENTS.md protocol. */
  opener: string;
  /** The full copy-ready block. */
  block: string;
}

export function buildSessionBootstrap(task: OperatorTask, head: HeadId): SessionBootstrap {
  const handoffPath = task.sourceDoc?.label ?? task.sourceDoc?.id ?? 'the governing handoff';
  const opener = `claim task ${task.id}, run Verify First, footprint before code`;
  const block = [
    `# Session bootstrap — ${head}`,
    `Task: ${task.id} — ${task.goal}`,
    `Handoff: ${handoffPath}`,
    task.fileScope && task.fileScope.length ? `Scope: ${task.fileScope.join(', ')}` : null,
    ``,
    `Opener: ${opener}. Follow AGENTS.md: read the room and drain mentions first,`,
    `announce your footprint, execute the handoff's Verify First items before writing code.`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
  return { taskId: task.id, head, handoffPath, opener, block };
}

// ---------------------------------------------------------------------------
// Top-level state + actions
// ---------------------------------------------------------------------------

export interface OperatorState {
  generatedAt: string;
  targetSurface: string;
  source: OperatorSource;
  heads: RegisteredHead[];
  bays: Bay[];
  tasks: OperatorTask[];
  gate: GateCard[];
  shiftSummary: ShiftSummary;
  /** Run drawers keyed by taskId, for claimed/done tasks. Live mode may lazy-fetch. */
  drawers: Record<string, RunDrawer>;
  /** Present only when the state came from the tenant-bound live contract. */
  contract?: OperatorLiveContract;
}

export interface OperatorLiveContract {
  endpoint: string;
  tenant: string;
  runId: string;
  requestId: string;
}

export type OperatorAction =
  | { action: 'send_to_bay'; taskId: string; head: HeadId }
  | { action: 'reorder_queue'; taskId: string; priority: number }
  | { action: 'gate_pass'; taskId: string; note?: string }
  | { action: 'gate_bounce'; taskId: string; requiredChanges: string }
  | { action: 'refresh_drawer'; taskId: string }
  /** Task Dial submit: posts to the room bound to the open panel. An optional
      mention (/claude, /codex) delivers via coordinate to that head. */
  | { action: 'send_room_message'; taskId: string; text: string; mention?: HeadId };

/** Structured refusal codes (Invariants 2 + 4). */
export type OperatorErrorCode =
  | 'bay_occupied'
  | 'prerequisite_unmet'
  | 'task_not_found'
  | 'bay_not_found'
  | 'evidence_missing'
  | 'not_in_review'
  | 'invalid_action'
  | 'missing_required_changes'
  | 'empty_message'
  | 'mutation_not_implemented'
  | 'mutation_failed'
  | 'tenant_mismatch';

export interface OperatorMutationReceipt {
  id: string;
  mutation: 'claimTaskNode' | 'publishCoordinationEvent';
  tenant: string;
  requestId: string;
  acknowledgedAt: string;
  verified: boolean;
  verifiedAt?: string;
  auditId?: string;
}

export interface OperatorActionResult {
  ok: boolean;
  action: OperatorAction['action'] | 'unknown';
  message: string;
  error?: OperatorErrorCode;
  /** Returned by send_to_bay. */
  bootstrap?: SessionBootstrap;
  /** Returned by gate_pass / gate_bounce. */
  gateRecordId?: string;
  /** Returned by gate_bounce — the head the task returns to. */
  bouncedTo?: HeadId;
  /** Durable backend acknowledgement for live writes. */
  receipt?: OperatorMutationReceipt;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const REGISTERED_HEADS: RegisteredHead[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
];

function iso(now: number, agoMs: number): string {
  return new Date(now - agoMs).toISOString();
}

function fixtureTasks(now: number): OperatorTask[] {
  const opDoc: SourceDocRef = {
    id: 'HANDOFF-OPERATOR-SURFACE',
    label: 'HANDOFF-OPERATOR-SURFACE.md',
    href: '/files?doc=HANDOFF-OPERATOR-SURFACE',
  };
  const glDoc: SourceDocRef = {
    id: 'HANDOFF-GROWTH-LAYER-V1',
    label: 'HANDOFF-GROWTH-LAYER-V1.md',
    href: '/files?doc=HANDOFF-GROWTH-LAYER-V1',
  };
  const hcDoc: SourceDocRef = {
    id: 'HANDOFF-HEAD-CALLS',
    label: 'HANDOFF-HEAD-CALLS.md',
    href: '/files?doc=HANDOFF-HEAD-CALLS',
  };

  return [
    // NOW — claimed, occupies the Claude Code bay.
    {
      id: 'task_op4_drawer',
      goal: 'OP4 run drawer: receipts inside CommonPlace',
      lane: 'now',
      status: 'claimed',
      priority: 0,
      sourceDoc: opDoc,
      laneChip: 'frontend',
      prerequisites: [{ taskId: 'task_op2_queue', goal: 'OP2 queue + bays', met: true }],
      claim: { head: 'claude-code', claimedAt: iso(now, 42 * 60 * 1000) },
      ageMs: 3 * HOUR,
      fileScope: ['apps/web/src/app/(console)/operator/RunDrawer.tsx'],
      runId: 'run_op4',
      checklist: { done: 4, total: 6 },
      source: fixtureSource('workGraph claim'),
    },
    // NEXT — priority-ordered, draggable.
    {
      id: 'task_op5_gate',
      goal: 'OP5 the gate: review view with evidence',
      lane: 'next',
      status: 'queued',
      priority: 1,
      sourceDoc: opDoc,
      laneChip: 'frontend',
      prerequisites: [{ taskId: 'task_op4_drawer', goal: 'OP4 run drawer', met: false }],
      ageMs: 2 * HOUR,
      fileScope: ['apps/web/src/app/(console)/operator/Gate.tsx'],
      checklist: { done: 0, total: 5 },
      source: fixtureSource('nextTaskNode'),
    },
    {
      id: 'task_op6_shift',
      goal: 'OP6 the shift summary: fifteen-minute screen',
      lane: 'next',
      status: 'queued',
      priority: 2,
      sourceDoc: opDoc,
      laneChip: 'frontend',
      prerequisites: [
        { taskId: 'task_op2_queue', goal: 'OP2 queue + bays', met: true },
        { taskId: 'task_op4_drawer', goal: 'OP4 run drawer', met: false },
      ],
      ageMs: 90 * 60 * 1000,
      source: fixtureSource('nextTaskNode'),
    },
    {
      id: 'task_gl1_ledger',
      goal: 'GL1 XP ledger: append-only outcome records',
      lane: 'next',
      status: 'queued',
      priority: 3,
      sourceDoc: glDoc,
      laneChip: 'backend',
      prerequisites: [],
      ageMs: 5 * HOUR,
      source: fixtureSource('nextTaskNode'),
    },
    {
      id: 'task_gl2_dial',
      goal: 'GL2 growth dial: level curve + thresholds',
      lane: 'next',
      status: 'queued',
      priority: 4,
      sourceDoc: glDoc,
      laneChip: 'backend',
      prerequisites: [],
      ageMs: 6 * HOUR,
      source: fixtureSource('nextTaskNode'),
    },
    // ICEBOX — spec not decomposed within seven days (rule 3).
    {
      id: 'task_hc_switchboard',
      goal: 'HEAD-CALLS switchboard: multi-head routing table',
      lane: 'icebox',
      status: 'queued',
      priority: 9,
      sourceDoc: hcDoc,
      laneChip: 'substrate',
      prerequisites: [],
      ageMs: 9 * DAY,
      source: fixtureSource('workGraph stale sweep'),
    },
    // DONE — for lineage.
    {
      id: 'task_op2_queue',
      goal: 'OP2 the queue and the bays',
      lane: 'done',
      status: 'done',
      priority: 0,
      sourceDoc: opDoc,
      laneChip: 'frontend',
      prerequisites: [],
      claim: { head: 'claude-code', claimedAt: iso(now, 6 * HOUR) },
      ageMs: 6 * HOUR,
      runId: 'run_op2',
      source: fixtureSource('workGraph done'),
    },
    {
      id: 'task_op1_intake',
      goal: 'OP1 intake parser: specs materialize as tasks',
      lane: 'done',
      status: 'done',
      priority: 0,
      sourceDoc: opDoc,
      laneChip: 'backend',
      prerequisites: [],
      claim: { head: 'codex', claimedAt: iso(now, 5 * HOUR) },
      ageMs: 5 * HOUR,
      runId: 'run_op1',
      source: fixtureSource('workGraph done'),
    },
  ];
}

function fixtureBays(tasks: OperatorTask[]): Bay[] {
  return REGISTERED_HEADS.map((head) => {
    const claimed = tasks.find((t) => t.lane === 'now' && t.claim?.head === head.id) ?? null;
    return {
      head: head.id,
      label: head.label,
      task: claimed,
      // Live source: presence stream (streaming), repo PR state (prLight),
      // last checklist transition (lastStep).
      streaming: head.id === 'claude-code' && claimed !== null,
      prLight: claimed ? ('open' as const) : ('none' as const),
      lastStep: claimed ? 'Verify First v1–v4 checked' : undefined,
      source: fixtureSource('workGraph claim'),
    };
  });
}

function fixtureDrawers(now: number): Record<string, RunDrawer> {
  const op4: RunDrawer = {
    taskId: 'task_op4_drawer',
    goal: 'OP4 run drawer: receipts inside CommonPlace',
    live: true,
    cursor: 'stream:op4:42',
    source: fixtureSource('coordinationStream'),
    specMarkdown: [
      '## OP4 — the run drawer',
      '',
      'Receipts inside CommonPlace: the deploy-log event stream and the Verify First',
      'checklist for the claimed task, assembled from coordination records,',
      'contributions, stream events, and checklist transitions.',
      '',
      '### Build Table',
      '',
      '| mark | step |',
      '| --- | --- |',
      '| [x] | introspect task-node + stream shapes |',
      '| [x] | read harness-console fixtures |',
      '| [x] | read .harness/checklists schema |',
      '| [x] | confirm workroom mount point |',
      '| [-] | porcelain accent decision |',
      '| [-] | cursor-tail degrade-to-poll pass |',
      '',
      'Scope: `apps/web/src/app/(console)/operator/**`. The drawer must reconstruct cold',
      'from the substrate when the stream is quiet.',
    ].join('\n'),
    footprint: [
      'apps/web/src/app/(console)/operator/RunDrawer.tsx',
      'apps/web/src/lib/theorem-operator.ts',
      'apps/web/src/app/api/theorem/operator/route.ts',
    ],
    messages: [
      { id: 'm1', at: iso(now, 38 * 60 * 1000), from: 'claude-code', text: 'Footprint announced; starting on the drawer contract.' },
      { id: 'm2', at: iso(now, 16 * 60 * 1000), from: 'codex', text: 'workGraph read is wired behind fixtureBays — flip lands after endpoint verification.' },
    ],
    verifyFirst: [
      { id: 'v1', label: 'graphql_introspect task-node + stream shapes', done: true, evidence: 'schema probe: workGraph, coordinationStream present; mutations in write server' },
      { id: 'v2', label: 'read harness-console fixtures for task/queue shapes', done: true, evidence: 'apps/harness-console/src/lib/harness/fixtures.ts' },
      { id: 'v3', label: 'read .harness/checklists schema for acceptance marks', done: true, evidence: 'agent-workroom-control-center-parity.json' },
      { id: 'v4', label: 'confirm CommonPlace workroom mount point', done: true, evidence: 'apps/web/src/app/(console)/workrooms' },
      { id: 'v5', label: 'porcelain accent decision (oxblood vs amber)', done: false },
    ],
    events: [
      { id: 'e1', at: iso(now, 42 * 60 * 1000), actor: 'claude-code', kind: 'claim', summary: 'claimed task_op4_drawer', payload: 'multihead_claim lease acquired; bay: claude-code' },
      { id: 'e2', at: iso(now, 40 * 60 * 1000), actor: 'claude-code', kind: 'intent', summary: 'announced footprint: RunDrawer.tsx + contract', payload: 'coordination_intent status=working footprint=[apps/web/src/app/(console)/operator/**]' },
      { id: 'e3', at: iso(now, 33 * 60 * 1000), actor: 'claude-code', kind: 'record', summary: 'decision: single-GET + force-dynamic, fixtures server-side only', payload: 'coordination_decision: no hydration drift; drawers keyed by taskId in state' },
      { id: 'e4', at: iso(now, 22 * 60 * 1000), actor: 'claude-code', kind: 'checklist', summary: 'Verify First v1-v4 checked with evidence', payload: '4/5 verify-first items resolved' },
      { id: 'e5', at: iso(now, 14 * 60 * 1000), actor: 'codex', kind: 'contribution', summary: 'wired workGraph read behind fixtureBays', payload: 'source.mode flip fixture->live pending endpoint verification' },
      { id: 'e6', at: iso(now, 4 * 60 * 1000), actor: 'claude-code', kind: 'stream', summary: 'drawer cursor-tail live at stream:op4:42', payload: 'degrade-to-poll after 30s idle' },
    ],
  };
  const op2: RunDrawer = {
    taskId: 'task_op2_queue',
    goal: 'OP2 the queue and the bays',
    live: false,
    source: fixtureSource('harnessRun replay'),
    verifyFirst: [
      { id: 'v1', label: 'fixtures reuse from harness-console', done: true, evidence: 'Task/Run contracts reused' },
      { id: 'v2', label: 'porcelain tokens only, zero hex', done: true, evidence: 'operator.module.css token-driven' },
    ],
    events: [
      { id: 'e1', at: iso(now, 6 * HOUR), actor: 'claude-code', kind: 'claim', summary: 'claimed task_op2_queue' },
      { id: 'e2', at: iso(now, 5.5 * HOUR), actor: 'claude-code', kind: 'record', summary: 'bays render from workGraph claims' },
      { id: 'e3', at: iso(now, 5 * HOUR), actor: 'claude-code', kind: 'contribution', summary: 'drag-to-reorder writes priority' },
      { id: 'e4', at: iso(now, 4.6 * HOUR), actor: 'codex', kind: 'record', summary: 'peer-review: aligned, WIP refusal verified' },
      { id: 'e5', at: iso(now, 4.5 * HOUR), actor: 'claude-code', kind: 'release', summary: 'released claim; task done' },
    ],
  };
  return { task_op4_drawer: op4, task_op2_queue: op2 };
}

function fixtureGate(now: number): GateCard[] {
  return [
    // A card WITH cross-review -> Pass enabled.
    {
      taskId: 'task_op2_queue',
      goal: 'OP2 the queue and the bays',
      owner: 'claude-code',
      source: fixtureSource('peer-review record'),
      acceptance: [
        { id: 'a1', label: 'bays render live claims from the work graph', met: true, evidence: { label: 'run_op2 receipt', href: '#run_op2' } },
        { id: 'a2', label: 'dragging reorders Next and persists', met: true, evidence: { label: 'reorder_queue receipt', href: '#reorder' } },
        { id: 'a3', label: 'blocked task refuses assignment with the unmet prerequisite named', met: true, evidence: { label: 'prerequisite_unmet test', href: '#prereq' } },
        { id: 'a4', label: 'seven-day icebox sweep moves and labels stale spec tasks', met: true, evidence: { label: 'icebox sweep receipt', href: '#icebox' } },
      ],
      crossReview: {
        reviewer: 'codex',
        verdict: 'pass',
        triedToBreak: 'Sent to an occupied bay and to a blocked task; both refused with structured errors. Reordered across lanes; priority persisted.',
        at: iso(now, 4.6 * HOUR),
      },
      changedFiles: [
        { path: 'apps/web/src/app/(console)/operator/page.tsx', added: 210, removed: 0 },
        { path: 'apps/web/src/app/(console)/operator/Queue.tsx', added: 180, removed: 0 },
        { path: 'apps/web/src/components/v2/Rail.tsx', added: 4, removed: 0 },
      ],
      commits: [{ sha: 'a1b2c3d', message: 'feat(operator): OP2 queue + bays', href: '#a1b2c3d' }],
    },
    // A card WITHOUT cross-review -> Pass disabled, missing item named (Invariant 4).
    {
      taskId: 'task_op1_intake',
      goal: 'OP1 intake parser: specs materialize as tasks',
      owner: 'codex',
      source: fixtureSource('task review-state'),
      acceptance: [
        { id: 'a1', label: 'ingesting HANDOFF-GROWTH-LAYER-V1 yields exactly eight task nodes', met: true, evidence: { label: 'createTaskNode receipts', href: '#gl-nodes' } },
        { id: 'a2', label: 're-ingesting after editing one row updates without duplicating', met: true, evidence: { label: 'idempotency test', href: '#idem' } },
        { id: 'a3', label: 'a doc with no Build Table creates nothing and logs why', met: false },
      ],
      crossReview: null,
      changedFiles: [
        { path: 'crates/commonplace/src/intake.rs', added: 320, removed: 0 },
        { path: 'apps/commonplace-api/src/serve.rs', added: 44, removed: 2 },
      ],
      commits: [{ sha: 'e4f5g6h', message: 'feat(intake): Build Table -> createTaskNode', href: '#e4f5g6h' }],
    },
  ];
}

function fixtureShiftSummary(now: number, tasks: OperatorTask[]): ShiftSummary {
  const queueDepth = tasks.filter((t) => t.lane === 'next').length;
  return {
    since: iso(now, 12 * HOUR),
    completed: [{ taskId: 'task_op2_queue', goal: 'OP2 the queue and the bays', gateStatus: 'merge-ready' }],
    newlyBlocked: [
      { taskId: 'task_op5_gate', goal: 'OP5 the gate', blockers: ['OP4 run drawer not yet done'] },
    ],
    reviewReadyCount: 2,
    queueDepth,
    iceboxMovements: [{ taskId: 'task_hc_switchboard', goal: 'HEAD-CALLS switchboard' }],
    urgentMessages: [
      { id: 'm1', from: 'codex', text: 'OP1 intake needs the empty-Build-Table log path reviewed before I can flip a3 to done.' },
    ],
    source: fixtureSource('roomDigest rollup'),
  };
}

/**
 * Build the whole Operator state. Currently all-fixture; the backend lane swaps
 * each builder for a live source behind these same types, flipping source.mode.
 * Signature mirrors buildTheoremControlCenterStateLive(env, now, fetch).
 */
export function buildOperatorState(
  _env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  _fetchImpl: typeof fetch = globalThis.fetch,
): OperatorState {
  const t = now.getTime();
  const tasks = fixtureTasks(t);
  return {
    generatedAt: now.toISOString(),
    targetSurface: 'app.theoremharness.com',
    source: fixtureSource('operator fixture'),
    heads: REGISTERED_HEADS,
    bays: fixtureBays(tasks),
    tasks,
    gate: fixtureGate(t),
    shiftSummary: fixtureShiftSummary(t, tasks),
    drawers: fixtureDrawers(t),
  };
}

// ---------------------------------------------------------------------------
// Action handler — refusal semantics live here so the invariants hold in
// fixture mode and the backend keeps the same guards when wiring live writes.
// ---------------------------------------------------------------------------

function isOperatorAction(body: unknown): body is OperatorAction {
  if (!body || typeof body !== 'object') return false;
  const action = body as Record<string, unknown>;
  switch (action.action) {
    case 'send_to_bay':
      return isString(action.taskId) && isString(action.head);
    case 'reorder_queue':
      return isString(action.taskId) && typeof action.priority === 'number' && Number.isFinite(action.priority);
    case 'gate_pass':
      return isString(action.taskId) && isOptionalString(action.note);
    case 'gate_bounce':
      return isString(action.taskId) && isString(action.requiredChanges);
    case 'refresh_drawer':
      return isString(action.taskId);
    case 'send_room_message':
      return isString(action.taskId) && isString(action.text) && isOptionalString(action.mention);
    default:
      return false;
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

export function handleOperatorAction(
  body: unknown,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
  fetchImpl: typeof fetch = globalThis.fetch,
): OperatorActionResult {
  return handleOperatorActionForState(body, buildOperatorState(env, now, fetchImpl));
}

export function handleOperatorActionForState(
  body: unknown,
  state: OperatorState,
): OperatorActionResult {
  if (!isOperatorAction(body)) {
    return { ok: false, action: 'unknown', error: 'invalid_action', message: 'Unrecognized operator action.' };
  }
  const action = body;

  switch (action.action) {
    case 'send_to_bay': {
      const task = state.tasks.find((x) => x.id === action.taskId);
      if (!task) return { ok: false, action: action.action, error: 'task_not_found', message: `No task ${action.taskId}.` };
      const bay = state.bays.find((b) => b.head === action.head);
      if (!bay) return { ok: false, action: action.action, error: 'bay_not_found', message: `No bay for head ${action.head}.` };
      // Invariant 2: WIP is structural — an occupied bay refuses.
      if (bay.task) {
        return {
          ok: false,
          action: action.action,
          error: 'bay_occupied',
          message: `${bay.label} is occupied by "${bay.task.goal}". Free the bay before assigning.`,
        };
      }
      // Blocked task refuses with the unmet prerequisite named.
      const unmet = unmetPrerequisites(task);
      if (unmet.length > 0) {
        return {
          ok: false,
          action: action.action,
          error: 'prerequisite_unmet',
          message: `Blocked: unmet prerequisite ${unmet.map((p) => `"${p.goal}"`).join(', ')}.`,
        };
      }
      const bootstrap = buildSessionBootstrap(task, action.head);
      return {
        ok: true,
        action: action.action,
        message: `Assigned "${task.goal}" to ${bay.label}. Mention published; paste the bootstrap block into a fresh ${bay.label} session.`,
        bootstrap,
      };
    }
    case 'reorder_queue': {
      const task = state.tasks.find((x) => x.id === action.taskId);
      if (!task) return { ok: false, action: action.action, error: 'task_not_found', message: `No task ${action.taskId}.` };
      return {
        ok: true,
        action: action.action,
        message: `Priority of "${task.goal}" written to ${action.priority}.`,
      };
    }
    case 'gate_pass': {
      const card = state.gate.find((g) => g.taskId === action.taskId);
      if (!card) return { ok: false, action: action.action, error: 'not_in_review', message: `Task ${action.taskId} is not in review.` };
      // Invariant 4: never pass without full evidence + a cross-review.
      const { ready, missing } = gateReady(card);
      if (!ready) {
        return {
          ok: false,
          action: action.action,
          error: 'evidence_missing',
          message: `Pass refused. Missing: ${missing.join('; ')}.`,
        };
      }
      return {
        ok: true,
        action: action.action,
        message: `Gate passed for "${card.goal}". Task advanced to merge-ready.`,
        gateRecordId: `gate_${card.taskId}_pass`,
      };
    }
    case 'gate_bounce': {
      const card = state.gate.find((g) => g.taskId === action.taskId);
      if (!card) return { ok: false, action: action.action, error: 'not_in_review', message: `Task ${action.taskId} is not in review.` };
      if (!action.requiredChanges || !action.requiredChanges.trim()) {
        return { ok: false, action: action.action, error: 'missing_required_changes', message: 'A bounce must state the required changes.' };
      }
      return {
        ok: true,
        action: action.action,
        message: `Bounced "${card.goal}" back to ${card.owner} with required changes.`,
        gateRecordId: `gate_${card.taskId}_bounce`,
        bouncedTo: card.owner,
      };
    }
    case 'refresh_drawer': {
      const drawer = state.drawers[action.taskId];
      if (!drawer) return { ok: false, action: action.action, error: 'task_not_found', message: `No drawer for ${action.taskId}.` };
      return { ok: true, action: action.action, message: `Drawer for "${drawer.goal}" refreshed.` };
    }
    case 'send_room_message': {
      const task = state.tasks.find((x) => x.id === action.taskId);
      if (!task) return { ok: false, action: action.action, error: 'task_not_found', message: `No task ${action.taskId}.` };
      if (!action.text || !action.text.trim()) {
        return { ok: false, action: action.action, error: 'empty_message', message: 'A room message needs text.' };
      }
      // Live source: stream_publish to the task's room; a mention additionally
      // delivers via coordinate to the named head.
      return {
        ok: true,
        action: action.action,
        message: action.mention
          ? `Sent to the "${task.goal}" room; ${action.mention} mentioned.`
          : `Sent to the "${task.goal}" room.`,
      };
    }
  }
}
