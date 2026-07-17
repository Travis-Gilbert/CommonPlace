'use client';

/**
 * Dependency-free Tauri bridge for CommonPlace desktop mode (SPEC-9 D4/D5).
 *
 * Avoids the `@tauri-apps/api` dependency by calling the runtime-injected
 * `window.__TAURI_INTERNALS__.invoke` directly, so the web bundle stays clean
 * and nothing here runs outside the desktop shell. `isTauri()` gates the
 * desktop-only panels (co-browser / coordination / receiver) so they never
 * render or dial in a plain browser tab.
 *
 * The typed wrappers mirror the shell's `#[tauri::command]` surface
 * (apps/desktop/src-tauri/src/lib.rs, contract in apps/desktop/src/lib/commands.ts).
 */

// Type-only import (erased at build), so the bridge stays runtime-dependency-free.
import type { RecallPolicy } from '@/lib/margin-recall/recall-dial';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

interface TauriInternals {
  invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Registers a JS callback with the shell and returns its channel id. */
  transformCallback?<T>(callback: (response: T) => void): number;
}

function internals(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TAURI_INTERNALS__?: TauriInternals };
  return w.__TAURI_INTERNALS__ ?? null;
}

/** Invoke a desktop command. Throws when called outside the Tauri runtime. */
export async function invoke<T>(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const bridge = internals();
  if (!bridge) {
    throw new Error(
      `Tauri command "${cmd}" called outside the desktop runtime`,
    );
  }
  return bridge.invoke(cmd, args) as Promise<T>;
}

/* ── Margin recall per-site policy (HANDOFF-MARGIN-RECALL D7) ────── */

/**
 * Rust: `site_policy_get(origin) -> Option<RecallPolicy>` (D7-3). The per-origin recall
 * override for `origin`, or null when it has none (so the global dial applies). Throws
 * outside the desktop runtime, where no per-site store exists.
 */
export const sitePolicyGet = (origin: string) =>
  invoke<RecallPolicy | null>('site_policy_get', { origin });

/**
 * Rust: `site_policy_set(origin, policy)` (D7-3). Pin an origin's recall policy durably; an
 * origin set to Off suppresses the pipeline for that origin no matter how loud the dial.
 */
export const sitePolicySet = (origin: string, policy: RecallPolicy) =>
  invoke<void>('site_policy_set', { origin, policy });

/* ── Receiver (local agent execution) ───────────────────────────── */

export interface ReceiverStatus {
  enabled: boolean;
  state: string;
  lanes: string[];
  lastClaimTime?: string | null;
  lastJobResult?: string | null;
}

export interface ReceiverSettings {
  enabled: boolean;
  claimIntervalSecs: number;
  worktrees: Record<string, string>;
}

export const receiverStatus = () => invoke<ReceiverStatus>('receiver_status');
export const receiverSettingsGet = () =>
  invoke<ReceiverSettings>('receiver_settings_get');
export const receiverSettingsSet = (settings: ReceiverSettings) =>
  invoke<void>('receiver_settings_set', { settings });

/* ── Coordination room ──────────────────────────────────────────── */

export interface RoomFeedItem {
  id: string;
  actor: string;
  text: string;
  createdAt?: string | null;
  kind?: string | null;
}
export interface RoomParticipant {
  actor: string;
  status: string;
  lastSeen?: string | null;
}
export interface RoomIntentItem {
  actor: string;
  status: string;
  summary: string;
  footprint: string[];
  updatedAt?: string | null;
}
export interface RoomRecordItem {
  id: string;
  kind: string;
  actor?: string | null;
  title?: string | null;
  summary: string;
  refs: string[];
  createdAt?: string | null;
}
export interface RoomContext {
  feed: RoomFeedItem[];
  participants: RoomParticipant[];
  intents: RoomIntentItem[];
  records: RoomRecordItem[];
}

export const roomContext = (roomId: string) =>
  invoke<RoomContext>('room_context', { roomId });
export const roomPostMessage = (roomId: string, message: string) =>
  invoke<void>('room_post_message', { input: { roomId, message } });

/* ── Co-browser (human + agent shared browsing) ─────────────────── */

export interface PageContext {
  url: string;
  title: string;
  text: string;
}
export interface AgentIngestionReceipt {
  id: string;
  status: string;
  url: string;
  title?: string | null;
  capturedAt?: string;
  /** Destination space: 'local' or 'hosted' harness store. */
  storeTarget?: string;
  trustTier?: string;
  message: string;
  /** Store-assigned id of the written note, when the store names one. */
  objectId?: string | null;
  /** Title of the nearest existing memory (best-effort recall), for the Keep toast. */
  nearestNeighbor?: string | null;
}

/* ── Shell events (dependency-free tauri event bridge) ──────────────
 *
 * The runtime emits these to the chrome webview (see
 * crates/commonplace-desktop-runtime/src/lib.rs and the contract doc in
 * apps/desktop/src/lib/commands.ts):
 *
 *   cobrowse://stage-focus   { tabId }  a tab window gained OS focus. This is
 *                            the user-input-into-the-stage signal: external-URL
 *                            webviews cannot report in-page keystrokes, but the
 *                            first click or keystroke into the stage necessarily
 *                            focuses its window.
 *   cobrowse://navigation    { tabId, url }  a tab committed a navigation.
 */
export type CoBrowseShellEvent = 'cobrowse://stage-focus' | 'cobrowse://navigation';

export async function listenDesktopEvent<T = unknown>(
  event: CoBrowseShellEvent,
  handler: (payload: T) => void,
): Promise<() => void> {
  const bridge = internals();
  if (!bridge || typeof bridge.transformCallback !== 'function') {
    throw new Error(`desktop event "${event}" subscribed outside the desktop runtime`);
  }
  const callbackId = bridge.transformCallback<{ payload: T }>((raw) => handler(raw.payload));
  const eventId = (await bridge.invoke('plugin:event|listen', {
    event,
    target: { kind: 'Any' },
    handler: callbackId,
  })) as number;
  return () => {
    void bridge.invoke('plugin:event|unlisten', { event, eventId });
  };
}

/** Draw or clear the telegraph highlight overlay inside a tab's page (D3). */
export const tabHighlight = (
  tabId: string,
  bbox: { x: number; y: number; width: number; height: number },
  label?: string,
) =>
  invoke<void>('tab_highlight', {
    tabId,
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    label: label ?? null,
  });
export const tabClearHighlight = (tabId: string) =>
  invoke<void>('tab_clear_highlight', { tabId });

export const tabCreate = (tabId: string, url?: string) =>
  invoke<void>('tab_create', { tabId, url: url ?? null });
export const tabNavigate = (tabId: string, url: string) =>
  invoke<void>('tab_navigate', { tabId, url });
export const tabSetActive = (tabId: string | null) =>
  invoke<void>('tab_set_active', { tabId });
export const extractVisibleText = (tabId: string) =>
  invoke<PageContext>('extract_visible_text', { tabId });
export const agentTabIngest = (input: {
  tabId: string;
  url: string;
  title?: string;
  text: string;
}) => invoke<AgentIngestionReceipt>('agent_tab_ingest', { input });

/* ── Co-browse perception contract (HANDOFF-COBROWSE-PRESENCE D1) ──────────
 *
 * Typed mirror of the rustyred-thg node's browse-with-me response. Grounded in
 * the engine source (rustyred-thg-server/src/router.rs `execute_browser_use` /
 * `execute_live_browser_use`, theorem-browser-agent/src/lib.rs bundles); the
 * contract test deserializes a response captured from the real handler
 * (src/lib/__fixtures__/browse-with-me.captured.json).
 */

/** UI names map onto engine control modes: Watch=agent_drive, Pair=pair, Drive=human_drive. */
export type CoBrowseControlMode = 'agent_drive' | 'pair' | 'human_drive';

export interface PerceptionCandidate {
  id: string;
  kind: string;
  status: string;
  label: string;
  url?: string;
  confidence: number;
  metadata: unknown;
}

export interface CoverageDiagnosis {
  has_known_context: boolean;
  has_browser_context: boolean;
  needs_web: boolean;
  needs_counterevidence: boolean;
  needs_freshness: boolean;
  confidence: number;
}

/** An affordance from the engine's action rail. `label` is the human one-liner. */
export interface RailAction {
  id: string;
  action_type: string;
  category: string;
  risk:
    | 'read_only'
    | 'external_web'
    | 'hot_graph_write'
    | 'canonical_write'
    | 'remember'
    | 'state_changing';
  status: 'ready' | 'needs_confirmation' | 'blocked_policy' | 'not_implemented';
  execution_route: string;
  label: string;
  target: unknown;
}

export interface PerceptionBundle {
  mode: string;
  candidates: PerceptionCandidate[];
  coverage: CoverageDiagnosis;
  actions: RailAction[];
}

export interface ActionRailBundle {
  actions: RailAction[];
  groups: Record<string, string[]>;
}

export interface ObservedPageElement {
  element_id: string;
  role: string;
  name: string;
  value?: string | null;
  test_id?: string | null;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  visible?: boolean;
  enabled?: boolean;
  editable?: boolean;
}

export interface LivePageState {
  url: string;
  title: string;
  distilled_text: string;
  active_tab_id?: string | null;
  interactive_elements: ObservedPageElement[];
  fetch?: unknown;
}

/** The action JSON the engine accepts (selector + verb + optional value). */
export interface BrowserActionInput {
  selector: { element_id: string } | string;
  action: string;
  value?: string;
  options?: Record<string, unknown>;
}

export interface LiveBrowserState {
  status: 'preview_pending' | 'actuated' | 'session_ready' | 'vetoed';
  transport: string;
  session_id: string;
  pending_action?: BrowserActionInput | null;
  /** Present-tense one-liner resolved by the node (never client-templated). */
  intent?: string | null;
  demonstration_count?: number;
  action_receipt?: { applied: boolean; selector: string } | null;
  page: LivePageState;
}

export interface BrowsingRunReceipt {
  run_id: string;
  surface: string;
  context_command_id: string;
  pages_reached: string[];
  actions_applied: RailAction[];
  data_extracted: { candidate_count: number; coverage: CoverageDiagnosis };
  playbooks_used: string[];
  playbooks_created: string[];
  confidence_ceiling: number;
  quarantine_layer: string;
  events: string[];
  live_browser?: LiveBrowserState | null;
}

export interface BrowsePerception {
  tenant: string;
  run_id: string;
  tool: string;
  surface: string;
  control_mode: string;
  task: string;
  context_command: Record<string, unknown>;
  perception: PerceptionBundle;
  action_rail: ActionRailBundle;
  browsing_run: BrowsingRunReceipt;
  browsing_run_node: unknown;
  playbook_pack_ids: string[];
  web_consume: unknown;
  live_browser: LiveBrowserState | null;
  pages_reached: string[];
  mode: string;
}

/** D1's proposed_action view: verb, target descriptor, intent line, confirm flag. */
export interface ProposedAction {
  verb: string;
  targetDescriptor: string;
  intent: string;
  confirm: boolean;
  raw: BrowserActionInput;
}

/** Verbs that write into the page; these always route through the approval card. */
const WRITE_VERBS = new Set(['fill', 'select_option', 'set_checked', 'check', 'set_input_files']);

/**
 * Normalize the engine's held preview into D1's proposed_action shape. Returns
 * null when nothing is pending. The confirm flag is set for write verbs and for
 * any rail action the engine marked needs_confirmation.
 */
export function proposedActionOf(perception: BrowsePerception): ProposedAction | null {
  const live = perception.live_browser;
  if (!live || live.status !== 'preview_pending' || !live.pending_action) return null;
  const raw = live.pending_action;
  const verb = raw.action;
  const elementId = typeof raw.selector === 'string' ? raw.selector : raw.selector.element_id;
  const element = live.page.interactive_elements.find((el) => el.element_id === elementId);
  const railNeedsConfirmation = perception.action_rail.actions.some(
    (action) => action.status === 'needs_confirmation',
  );
  return {
    verb,
    targetDescriptor: element ? element.name || element.element_id : elementId,
    intent: live.intent ?? '',
    confirm: WRITE_VERBS.has(verb) || railNeedsConfirmation,
    raw,
  };
}

function invalid(field: string): never {
  throw new Error(`browse-with-me response missing ${field}`);
}

/**
 * Runtime guard at the fetch boundary: verifies the discriminants the UI relies
 * on so a drifted node contract fails loudly instead of rendering nonsense.
 */
export function parseBrowsePerception(json: unknown): BrowsePerception {
  const value = json as BrowsePerception;
  if (typeof value !== 'object' || value === null) invalid('body');
  if (typeof value.run_id !== 'string') invalid('run_id');
  if (typeof value.control_mode !== 'string') invalid('control_mode');
  if (!value.perception || !Array.isArray(value.perception.candidates)) {
    invalid('perception.candidates');
  }
  if (!Array.isArray(value.perception.actions)) invalid('perception.actions');
  if (!value.action_rail || !Array.isArray(value.action_rail.actions)) {
    invalid('action_rail.actions');
  }
  if (!value.browsing_run || !Array.isArray(value.browsing_run.events)) {
    invalid('browsing_run.events');
  }
  if (value.live_browser) {
    const live = value.live_browser;
    if (typeof live.status !== 'string') invalid('live_browser.status');
    if (!live.page || !Array.isArray(live.page.interactive_elements)) {
      invalid('live_browser.page.interactive_elements');
    }
  }
  return value;
}

export interface BrowseWithMeInput {
  url?: string;
  task?: string;
  runId?: string;
  sessionId?: string;
  controlMode?: CoBrowseControlMode;
  action?: BrowserActionInput;
  confirm?: boolean;
  veto?: boolean;
  tenant?: string;
}

/**
 * Agent-collaborative browsing: the engine's co-browsing route on the local
 * rustyred-thg node (:17888). HTTP, not invoke, so the node must allow the
 * desktop origin (CORS). `wait: true` requests the synchronous perception
 * payload; the engine holds confirm-gated actions server-side (status
 * `preview_pending`) until a follow-up call with `confirm: true` on the same
 * run_id.
 */
/**
 * The tenant live browser traffic is scoped to. The site authenticates exactly
 * one owner (see auth.ts, which rejects every GitHub login but the owner's), so
 * the owner handle is the honest single-tenant default; a deploy can still
 * override it via env without a code change rather than sending traffic to a
 * hardcoded identity.
 */
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_COMMONPLACE_TENANT?.trim() || 'Travis-Gilbert';

export async function browseWithMe(input: BrowseWithMeInput): Promise<BrowsePerception> {
  const tenant = input.tenant ?? DEFAULT_TENANT;
  const res = await fetch(
    `${LOCAL_NODE_URL}/v1/tenants/${tenant}/browser/browse-with-me`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        control_mode: input.controlMode ?? 'pair',
        url: input.url,
        task: input.task,
        run_id: input.runId,
        session_id: input.sessionId,
        action: input.action,
        confirm: input.confirm ?? false,
        veto: input.veto ?? false,
        wait: true,
      }),
    },
  );
  if (!res.ok) throw new Error(`browse-with-me ${res.status}`);
  return parseBrowsePerception(await res.json());
}

/* ── Native status / keychain / harness / sync (full D4 client) ─────────── */

// ponytail: these ports must match the desktop shell consts (apps/desktop/src-tauri/src/lib.rs).
const LOCAL_NODE_URL =
  process.env.NEXT_PUBLIC_LOCAL_NODE_URL ?? 'http://127.0.0.1:17888';

export type HarnessTarget = 'local' | 'hosted';

export interface HarnessSettings {
  endpoint: string;
  localEndpoint: string;
  activeTarget: HarnessTarget;
  tenant: string;
  bearerPresent: boolean;
}

export interface LocalNodeStatus {
  nodeUp: boolean;
  endpoint: string;
  port: number;
  storePath: string;
  activeTarget: HarnessTarget;
  toolsMatchHosted: boolean;
}

export interface CommonplaceStatusInfo {
  nodeUp: boolean;
  endpoint: string;
  port: number;
  storePath: string;
}

export interface HostedConnectionStatus {
  endpoint: string;
  tenant: string;
  bearerPresent: boolean;
  reachable: boolean;
  documentCount?: number | null;
  message: string;
}

export interface ModelStatus {
  enabled: boolean;
  endpoint: string;
  model: string;
  reachable: boolean;
  message: string;
}

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelChatInput {
  model: 'local' | 'ollama' | 'agent' | string;
  messages: ModelMessage[];
  ollamaEndpoint?: string;
  ollamaModel?: string;
  localEndpoint?: string;
  localModel?: string;
  localProtocol?: 'openai' | 'ollama';
}

export interface ModelChatResult {
  content: string;
  usage?: {
    provider: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    estimatedUsd: number;
  };
}

export interface SyncReceipt {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  mergedNodes?: number | null;
  mergedEdges?: number | null;
  conflicts?: number | null;
  message: string;
}

export const localNodeStatus = () =>
  invoke<LocalNodeStatus>('local_node_status');
export const commonplaceStatus = () =>
  invoke<CommonplaceStatusInfo>('commonplace_status');
export const hostedConnectionStatus = () =>
  invoke<HostedConnectionStatus>('hosted_connection_status');
export const modelStatus = () => invoke<ModelStatus>('model_status');
export const modelChat = (input: ModelChatInput) =>
  invoke<ModelChatResult>('model_chat', { input });

export const harnessSettingsGet = () =>
  invoke<HarnessSettings | null>('harness_settings_get');
export const harnessSettingsSet = (settings: HarnessSettings) =>
  invoke<void>('harness_settings_set', { settings });
export const harnessBearerSet = (token: string) =>
  invoke<void>('harness_bearer_set', { token });
export const harnessBearerClear = () => invoke<void>('harness_bearer_clear');

export const keychainSet = (provider: string, key: string) =>
  invoke<void>('keychain_set', { provider, key });
export const keychainHas = (provider: string) =>
  invoke<boolean>('keychain_has', { provider });
export const keychainDelete = (provider: string) =>
  invoke<void>('keychain_delete', { provider });

export const syncRun = () => invoke<SyncReceipt>('sync_run');
