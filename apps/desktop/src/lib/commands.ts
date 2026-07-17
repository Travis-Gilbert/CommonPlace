// The invoke() command contract: the CC/Codex seam for Theorem Desktop phase one.
//
// Claude Code authors this file as the agreed interface. Codex implements the
// matching #[tauri::command] handlers in apps/desktop/src-tauri. The Rust
// command name is given in a comment above each wrapper; argument keys must
// match exactly (Tauri maps camelCase TS keys to snake_case Rust params, so we
// pass the keys Tauri expects).
//
// Every wrapper degrades gracefully when not running inside Tauri (plain Vite
// browser mode): it returns honest in-memory mock data so the frontend shell
// renders and the omnibox/sidebar/rail are exercisable before the Rust backend
// lands. The real path is always invoke(); mocks are gated behind isTauri().

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  HarnessTarget,
  AgentIngestionReceipt,
  QueueJob,
  RoomFeedItem,
  RoomIntent,
  RoomParticipant,
  RoomRecord,
  HarnessSettings,
  PageContext,
  ProviderId,
  RecallHit,
  ReceiverSettings,
  SessionState,
  SyncReceipt,
  TabId,
  TurnUsage,
} from "../state/types";

/** True when running inside the Tauri runtime (vs. a plain browser dev server). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// --- Tab / webview lifecycle (D3) -- Rust: src-tauri, one wry webview per tab.
//
// Identity ownership: the FRONTEND owns tab identity (crypto.randomUUID). The
// backend manages wry webviews keyed by that TabId. The ask-first new-tab page
// is pure DOM with no webview -- for it, call tabSetActive(null) so the backend
// hides all webviews and the React new-tab page shows through.

/**
 * Rust: `tab_create(tab_id: String, url: Option<String>)`. Creates a wry webview
 * bound to this frontend-owned TabId; if url is given, navigates to it.
 */
export async function tabCreate(tabId: TabId, url?: string): Promise<void> {
  if (isTauri()) return invoke("tab_create", { tabId, url: url ?? null });
}

/** Rust: `tab_navigate(tab_id: String, url: String)`. */
export async function tabNavigate(tabId: TabId, url: string): Promise<void> {
  if (isTauri()) return invoke("tab_navigate", { tabId, url });
}

/** Rust: `tab_reload(tab_id: String)`. */
export async function tabReload(tabId: TabId): Promise<void> {
  if (isTauri()) return invoke("tab_reload", { tabId });
}

/** Rust: `tab_go_back(tab_id: String)`. */
export async function tabGoBack(tabId: TabId): Promise<void> {
  if (isTauri()) return invoke("tab_go_back", { tabId });
}

/** Rust: `tab_go_forward(tab_id: String)`. */
export async function tabGoForward(tabId: TabId): Promise<void> {
  if (isTauri()) return invoke("tab_go_forward", { tabId });
}

/** Rust: `tab_close(tab_id: String)`. */
export async function tabClose(tabId: TabId): Promise<void> {
  if (isTauri()) return invoke("tab_close", { tabId });
}

/**
 * Rust: `tab_set_active(tab_id: Option<String>)`. Shows that tab's webview and
 * hides the others; null means the new-tab page is showing (no webview).
 */
export async function tabSetActive(tabId: TabId | null): Promise<void> {
  if (isTauri()) return invoke("tab_set_active", { tabId });
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rust: `tab_set_bounds(rect: Rect)`. Positions the active webview to fill the
 * stage hole left by the chrome (sidebar + omnibox + optional rail).
 */
export async function tabSetBounds(rect: Rect): Promise<void> {
  if (isTauri()) return invoke("tab_set_bounds", { rect });
}

// --- Co-browse telegraph + shell events (HANDOFF-COBROWSE-PRESENCE D3/D4/D6).
// Implemented in crates/commonplace-desktop-runtime/src/lib.rs; consumed by the
// shipped web bridge (apps/web/src/lib/desktop.ts).

/**
 * Rust: `tab_highlight(tab_id, x, y, width, height, label: Option<String>)`.
 * Evals a pointer-events-none outline overlay (gold register) into the tab's
 * page at the element bbox the agent is about to act on. `tab_clear_highlight`
 * removes it.
 */
export async function tabHighlight(
  tabId: TabId,
  rect: Rect,
  label?: string,
): Promise<void> {
  if (isTauri())
    return invoke("tab_highlight", { tabId, ...rect, label: label ?? null });
}

/** Rust: `tab_clear_highlight(tab_id)`. */
export async function tabClearHighlight(tabId: TabId): Promise<void> {
  if (isTauri()) return invoke("tab_clear_highlight", { tabId });
}

/**
 * Shell events emitted by the runtime (subscribe via the tauri event plugin):
 *
 *   `cobrowse://stage-focus`  { tabId }        a tab window gained OS focus:
 *     the user-input-into-the-stage signal for interrupt-to-pause. External-URL
 *     webviews cannot report in-page keystrokes; the first click or keystroke
 *     into the stage necessarily focuses its window.
 *   `cobrowse://navigation`   { tabId, url }   a tab committed a navigation
 *     (receipt-rail timing, telegraph clearing).
 */
export type CoBrowseShellEvent = "cobrowse://stage-focus" | "cobrowse://navigation";

// --- Page extraction (D4) -- Rust re-fetches the tab's URL server-side, text only.

/** Rust: `extract_visible_text(tab_id: String) -> PageContext`. */
export async function extractVisibleText(tabId: TabId): Promise<PageContext> {
  if (isTauri()) return invoke<PageContext>("extract_visible_text", { tabId });
  return {
    url: "https://example.com",
    title: "Example Domain",
    text: "Example Domain. This domain is for use in illustrative examples.",
  };
}

// --- Margin recall geometry (HANDOFF-MARGIN-RECALL D1) ----------------------
//
// The versioned command family the margin overlay positions itself by. Because a
// tab is a native WebviewWindow (no Servo sidecar), geometry for an EXTERNAL page
// is obtained by evaluating a resolver INTO the page (the same mechanism as
// tab_highlight), not by a shell-side overlay -- which is also what keeps the
// contract engine-neutral: a CDP fallback driver must return the same shapes from
// the same inputs. CommonPlace's own reader resolves in its own DOM and skips these.

/** A text target to resolve: a quote plus optional disambiguating context and a
 * character-offset hint into the page's text (prefer the nearest occurrence). */
export interface TextTarget {
  quote: string;
  prefix?: string;
  suffix?: string;
  positionHint?: number;
}

/** Zero or more viewport rects for one resolved target, with a confidence in
 * [0,1] (1 = exact text match; lower = fuzzy). Empty `rects` = did not resolve. */
export interface RectSet {
  rects: Rect[];
  confidence: number;
}

/** Stable identity of the page a tab currently shows. `contentHash` is a BLAKE3
 * hash of the page content -- the cache + re-anchor key (D2/D3). */
export interface PageIdentity {
  url: string;
  title: string;
  contentHash: string;
}

/**
 * Rust: `resolve_text_targets(tab_id, request_id, target) -> ()`.
 * Evals a self-contained in-page resolver for each quote (exact context match, then
 * quote-only fallback) and delivers the client rects via the `marginrecall://targets`
 * event, tagged with the request id. This wrapper fans out per-target invocations,
 * correlates results by request id, and collects one RectSet per input target in order.
 */
export async function resolveTextTargets(
  tabId: TabId,
  targets: TextTarget[],
): Promise<RectSet[]> {
  if (!isTauri()) return targets.map(() => ({ rects: [], confidence: 0 }));
  return Promise.all(
    targets.map(async (target) => {
      const requestId = crypto.randomUUID();
      // Grab the resolver from the Promise constructor synchronously so the listener
      // callback and the invoke error path can both settle it.
      let resolveResult: ((r: RectSet) => void) | null = null;
      const resultPromise = new Promise<RectSet>((res) => {
        resolveResult = res;
      });
      // resolveResult is always assigned above (Promise constructor is synchronous).
      // Register the listener before invoking to avoid a race with the eval postback.
      const unlisten = await listen<{ requestId: string; targets: RectSet[] }>(
        "marginrecall://targets",
        (event) => {
          if (event.payload.requestId !== requestId) return;
          unlisten();
          resolveResult!(event.payload.targets[0] ?? { rects: [], confidence: 0 });
        },
      );
      // Fire the resolver; rects arrive via the event listener above.
      invoke("resolve_text_targets", { tabId, requestId, target }).catch(() => {
        unlisten();
        resolveResult!({ rects: [], confidence: 0 });
      });
      return resultPromise;
    }),
  );
}

/** Rust: `scroll_to_target(tab_id: String, target: TextTarget)`. Evals a
 * scroll-into-view for the resolved quote so the overlay can bring a passage in. */
export async function scrollToTarget(tabId: TabId, target: TextTarget): Promise<void> {
  if (isTauri()) return invoke("scroll_to_target", { tabId, target });
}

/** Rust: `page_identity(tab_id: String) -> PageIdentity`. URL + title + BLAKE3
 * content hash, for result caching (D2) and re-anchoring (D3). */
export async function pageIdentity(tabId: TabId): Promise<PageIdentity> {
  if (isTauri()) return invoke<PageIdentity>("page_identity", { tabId });
  return {
    url: "https://example.com",
    title: "Example Domain",
    contentHash: "blake3:" + "0".repeat(64),
  };
}

/**
 * Shell events for overlay tracking (subscribe via the tauri event plugin):
 *
 *   `marginrecall://viewport` { tabId, width, height }  the page viewport resized
 *     (overlay re-layout).
 *   `marginrecall://scroll`   { tabId, x, y }           the page scrolled; the
 *     overlay offsets its tints to stay glued to passages.
 *
 * Emitted by an injected listener in the tab page, forwarded by the runtime. A CDP
 * fallback driver emits the same two events from the same page signals.
 */
export type MarginRecallShellEvent = "marginrecall://viewport" | "marginrecall://scroll";

// --- Session persistence (D3) -- Rust: tauri-plugin-sql (SQLite).

/** Rust: `session_load() -> Option<SessionState>`. */
export async function sessionLoad(): Promise<SessionState | null> {
  if (isTauri()) return invoke<SessionState | null>("session_load");
  return null;
}

/** Rust: `session_save(state: SessionState)`. */
export async function sessionSave(state: SessionState): Promise<void> {
  if (isTauri()) return invoke("session_save", { state });
}

// --- Keychain (D5) -- Rust: OS keychain plugin. Keys never leave the backend.

/** Rust: `keychain_set(provider: String, key: String)`. */
export async function keychainSet(provider: ProviderId, key: string): Promise<void> {
  if (isTauri()) return invoke("keychain_set", { provider, key });
}

/** Rust: `keychain_has(provider: String) -> bool`. Never returns the key. */
export async function keychainHas(provider: ProviderId): Promise<boolean> {
  if (isTauri()) return invoke<boolean>("keychain_has", { provider });
  return false;
}

/** Rust: `keychain_delete(provider: String)`. */
export async function keychainDelete(provider: ProviderId): Promise<void> {
  if (isTauri()) return invoke("keychain_delete", { provider });
}

// --- Harness memory (D4) -- Rust: hosted MCP client, bearer + tenant.

export interface RememberInput {
  text: string;
  /** Page provenance for the turn (url/title). */
  url?: string;
  title?: string;
  tags?: string[];
  /** Free-form provenance, e.g. mentioned tab urls. */
  provenance?: Record<string, unknown>;
}

/** Rust: `harness_remember(input) -> { id, tags }`. */
export async function harnessRemember(
  input: RememberInput,
): Promise<{ id: string; tags: string[] }> {
  if (isTauri()) return invoke("harness_remember", { input });
  return { id: `mock-mem-${Math.round(performance.now())}`, tags: input.tags ?? [] };
}

export interface RecallQuery {
  text?: string;
  domain?: string;
  limit?: number;
}

/** Rust: `harness_recall(query) -> RecallHit[]`. Powers the known-context strip. */
export async function harnessRecall(query: RecallQuery): Promise<RecallHit[]> {
  if (isTauri()) return invoke<RecallHit[]>("harness_recall", { query });
  return [];
}

/** Rust: `harness_settings_get() -> HarnessSettings`. */
export async function harnessSettingsGet(): Promise<HarnessSettings | null> {
  if (isTauri()) return invoke<HarnessSettings | null>("harness_settings_get");
  return null;
}

/** Rust: `harness_settings_set(settings: HarnessSettings)`. */
export async function harnessSettingsSet(settings: HarnessSettings): Promise<void> {
  if (isTauri()) return invoke("harness_settings_set", { settings });
}

export interface LocalNodeStatus {
  nodeUp: boolean;
  endpoint: string;
  port: number;
  storePath: string;
  activeTarget: HarnessTarget;
  toolsMatchHosted: boolean;
}

export interface CommonplaceStatus {
  nodeUp: boolean;
  endpoint: string;
  port: number;
  storePath: string;
}

export interface ReceiverStatus {
  enabled: boolean;
  state: "off" | "configured" | "running" | "error";
  lanes: string[];
  lastClaimTime?: string;
  lastJobResult?: string;
}

/** Rust: `local_node_status() -> LocalNodeStatus`. */
export async function localNodeStatus(): Promise<LocalNodeStatus> {
  if (isTauri()) return invoke<LocalNodeStatus>("local_node_status");
  return {
    nodeUp: false,
    endpoint: "http://127.0.0.1:17888/mcp",
    port: 17888,
    storePath: "~/Library/Application Support/Theorem/store",
    activeTarget: "local",
    toolsMatchHosted: false,
  };
}

/** Rust: `commonplace_status() -> CommonplaceStatus`. */
export async function commonplaceStatus(): Promise<CommonplaceStatus> {
  if (isTauri()) return invoke<CommonplaceStatus>("commonplace_status");
  return {
    nodeUp: false,
    endpoint: "http://127.0.0.1:17890",
    port: 17890,
    storePath: "~/Library/Application Support/Theorem/store/commonplace-api",
  };
}

/** Rust: `receiver_settings_get() -> ReceiverSettings`. */
export async function receiverSettingsGet(): Promise<ReceiverSettings | null> {
  if (isTauri()) return invoke<ReceiverSettings | null>("receiver_settings_get");
  return null;
}

/** Rust: `receiver_settings_set(settings: ReceiverSettings)`. */
export async function receiverSettingsSet(settings: ReceiverSettings): Promise<void> {
  if (isTauri()) return invoke("receiver_settings_set", { settings });
}

/** Rust: `receiver_status() -> ReceiverStatus`. */
export async function receiverStatus(): Promise<ReceiverStatus> {
  if (isTauri()) return invoke<ReceiverStatus>("receiver_status");
  return {
    enabled: false,
    state: "off",
    lanes: [],
  };
}

/** Rust: `harness_bearer_set(token: String)`. Bearer is a secret -> keychain. */
export async function harnessBearerSet(token: string): Promise<void> {
  if (isTauri()) return invoke("harness_bearer_set", { token });
}

/** Rust: `harness_bearer_clear()`. */
export async function harnessBearerClear(): Promise<void> {
  if (isTauri()) return invoke("harness_bearer_clear");
}

// --- Model chat (D4) -- Rust: BYO provider keys, DeepSeek keyless default.

export interface ModelMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ModelChatInput {
  model: ProviderId;
  messages: ModelMessage[];
  ollamaEndpoint?: string;
  ollamaModel?: string;
  localEndpoint?: string;
  localModel?: string;
  localProtocol?: "openai" | "ollama";
}

export interface ModelChatResult {
  content: string;
  usage?: TurnUsage;
}

/** Rust: `model_chat(input) -> ModelChatResult`. Streaming is a later addition. */
export async function modelChat(input: ModelChatInput): Promise<ModelChatResult> {
  if (isTauri()) return invoke<ModelChatResult>("model_chat", { input });
  // Web-mode placeholder so the rail is exercisable without a provider key.
  const last = input.messages[input.messages.length - 1];
  return {
    content:
      `[dev placeholder, no backend] You said: "${last?.content ?? ""}". ` +
      `The real answer will come from ${input.model} via the Rust model-client.`,
    usage: {
      provider: input.model,
      model: input.model === "ollama" ? "local-dev" : input.model,
      tokensIn: Math.ceil(input.messages.map((m) => m.content).join(" ").length / 4),
      tokensOut: Math.ceil((last?.content ?? "").length / 5),
      estimatedUsd: 0,
    },
  };
}

// --- Sync (phase three) -----------------------------------------------------

/** Rust: `sync_run() -> SyncReceipt`. Executes one sync round when enabled. */
export async function syncRun(): Promise<SyncReceipt> {
  if (isTauri()) return invoke<SyncReceipt>("sync_run");
  return {
    id: `mock-sync-${Math.round(performance.now())}`,
    status: "disabled",
    startedAt: new Date().toISOString(),
    message: "Sync disabled in browser preview.",
  };
}

export interface BackgroundFetchInput {
  urls: string[];
}

/** Rust: `background_fetch_receipt(input)`. Records the background fetch pass. */
export async function backgroundFetchReceipt(input: BackgroundFetchInput): Promise<void> {
  if (isTauri()) return invoke("background_fetch_receipt", { input });
}

// --- Agent spaces and queue (phase four) ------------------------------------

export interface SpaceBindInput {
  roomId: string;
  spaceName: string;
}

/** Rust: `space_bind_room(input)`. Starts/joins a room for a Space. */
export async function spaceBindRoom(input: SpaceBindInput): Promise<void> {
  if (isTauri()) return invoke("space_bind_room", { input });
}

export interface RoomContext {
  feed: RoomFeedItem[];
  participants: RoomParticipant[];
  intents: RoomIntent[];
  records: RoomRecord[];
}

/** Rust: `room_context(room_id) -> RoomContext`. */
export async function roomContext(roomId: string): Promise<RoomContext> {
  if (isTauri()) return invoke<RoomContext>("room_context", { roomId });
  return { feed: [], participants: [], intents: [], records: [] };
}

export interface RoomPostInput {
  roomId: string;
  message: string;
}

/** Rust: `room_post_message(input)`. */
export async function roomPostMessage(input: RoomPostInput): Promise<void> {
  if (isTauri()) return invoke("room_post_message", { input });
}

export interface JobSubmitInput {
  title: string;
  specRef: string;
  repo: string;
  kind: "ImplementSpec" | "Feature" | "Edit" | "App" | "Investigation";
  priority?: "P0" | "P1" | "P2";
  targetHead?: "ClaudeCode" | "Codex" | "Either";
}

/** Rust: `job_submit(input)`. */
export async function jobSubmit(input: JobSubmitInput): Promise<void> {
  if (isTauri()) return invoke("job_submit", { input });
}

export interface QueueStatusInput {
  repo?: string;
  status?: string;
}

/** Rust: `queue_status(input) -> QueueJob[]`. */
export async function queueStatus(input: QueueStatusInput = {}): Promise<QueueJob[]> {
  if (isTauri()) return invoke<QueueJob[]>("queue_status", { input });
  return [];
}

// --- Agent tab ingestion (phase five) ---------------------------------------

export interface AgentTabIngestInput {
  tabId: TabId;
  url: string;
  title?: string;
  text: string;
}

/** Rust: `agent_tab_ingest(input) -> AgentIngestionReceipt`. */
export async function agentTabIngest(
  input: AgentTabIngestInput,
): Promise<AgentIngestionReceipt> {
  if (isTauri()) return invoke<AgentIngestionReceipt>("agent_tab_ingest", { input });
  return {
    id: `mock-ingest-${Math.round(performance.now())}`,
    status: "disabled",
    url: input.url,
    title: input.title,
    capturedAt: new Date().toISOString(),
    storeTarget: "hosted",
    trustTier: "open_web_unverified",
    message: "Agent ingestion disabled in browser preview.",
  };
}

// --- Integrations proof (phase six) -----------------------------------------

export interface ConnectorProofResult {
  status: "ok" | "error";
  affordanceId: string;
  message: string;
}

/** Rust: `connector_proof_run() -> ConnectorProofResult`. */
export async function connectorProofRun(): Promise<ConnectorProofResult> {
  if (isTauri()) return invoke<ConnectorProofResult>("connector_proof_run");
  return {
    status: "error",
    affordanceId: "theorem_grpc.code_search.search",
    message: "Connector proof runs only in the desktop backend.",
  };
}
