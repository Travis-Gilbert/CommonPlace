# SPEC-COMMONPLACE-NATIVE-SHELL-1.0

The native browser edition: a thin GPUI shell as the one native authority over windows, surfaces, permissions, input, and agent presence, hosting two content realms it governs but does not render into: the CommonPlace React surface (trusted first-party application in a Wry webview) and Servo surfaces (untrusted web). GPUI is the control plane and compositor-facing shell, not a content engine, and nothing from the block system moves into it. This is an execution handoff; CONVENTIONS.md applies in full, including confirming every named surface against source.

Relationship to existing specs: SPEC-COMMONPLACE-BROWSER-SHELL-1.0's B1 through B7 (browser-embed, pane-host, pane-protocol, session graph, agent view, highlighter, navigation safety) are host-agnostic and are reused unchanged; that spec's F1 and F3 remain the Tauri edition's chrome. This spec is the GPUI edition's chrome. Two editions, one React app, one substrate, joined by the host bridge below.

## The realms

- GPUI shell: window frame, top-level tabs, omnibox, origin and security display, permission and takeover prompts, capability rail, top-level DockArea, surface lifecycle, global commands, input arbitration, native presence rendering.
- CommonPlace React surface: the existing block system, shaders, DnD Kit, editors, composer, user arrangements. Trusted application code, capability-scoped through its host contract. Untrusted block data rendered inside it is escaped and validated as data.
- Servo surfaces: arbitrary untrusted web content, exactly as the browser shell spec built them.

GPUI and React never share authority over one panel: GPUI arranges surfaces, React arranges blocks inside its surface. Nested drag systems must never fight.

## Design laws

- Human input preempts agent action within one frame of the input event, in every realm, enforced by the InteractionArbiter. This is the palace walk law promoted to shell law.
- Permission and takeover prompts render only in native chrome; no page and no block can draw, imitate, or invoke them.
- Agent presence has one canonical Rust state and per-realm renderers; the visual cursor hands off at surface boundaries and the user perceives one continuous agent. The native webview z-order limitation (the webview paints above GPUI elements) is treated as a law, not a bug: the shell never draws popovers or overlays over a webview rectangle, and layout reserves accordingly.
- GPUI stays thin. Markdown editing, correspondence, search results, shaders, the block canvas, the composer, and settings stay in React. A capability may later gain a compact native renderer only through block-contract renderer negotiation, never by rewrite.

## Named choices

- Dependencies: GPUI and gpui-component pinned by commit SHA in a separate Cargo workspace with a committed lockfile; all use wrapped behind Theorem-owned `Shell`, `DockHost`, and `SurfaceHost` traits; GPUI types never appear in BrowserCore, blocks, pane-host, or RustyRed. The substrate does not adopt the shell's toolchain requirements.
- gpui-component's DockArea arranges coarse surfaces only: center tabs (Servo surfaces and the CommonPlace workspace tab), left capability rail, right optional evidence surface, bottom dock (downloads, activity, approvals). DockArea layout state persists to the graph and restores.
- The CommonPlace surface loads the built React bundle through gpui-wry (experimental; pinned; its bounds-and-visibility behavior accepted as-is), speaking to the substrate through the GpuiHostAdapter.
- The host bridge is the durable asset: a browser-independent `CommonplaceHost` interface consumed by the React app, with three adapters (Web over HTTP/GraphQL/WebSocket, Tauri over invoke/events, Gpui over typed loopback IPC). The React app never knows its host.
- Servo-realm presence, takeover indication, and find highlights render through the display-list producer seam already budgeted in SPEC-SCENEOS-SERVO-NATIVE-1.0. No third fork patch exists or is permitted; if the seam cannot express something, that is a reportable finding.
- The capability rail's items are the plugin system's extension-point contributions (pane kinds, composer verbs) read through the bridge, so installed plugins reach native chrome with no shell changes. Rail interactions in v1 are click-to-add and command-to-add; the animated cross-surface drag is its own later handoff by name.
- Omnibox verbs: go resolves in BrowserCore (canonical URL echo per the shell spec's B7); ask and find route into the CommonPlace surface through `openTarget`.
- Applification for this edition is native and minimal: cargo-dist packaging, a self-update check against its release feed, single-instance via a local socket routing argv into the running shell, and protocol plus default-browser registration implemented per OS in BrowserCore (a browser must own its registration; report-if-unverified per OS). The Tauri edition and mobile keep Tauri's applification unchanged.
- macOS is the first exercised platform; Windows and Linux build in CI and their runtime status is reported honestly, never assumed.

## Backend deliverables

### B1. Host bridge

Path: CommonPlace repo `packages/host-bridge` (TypeScript interface plus adapters), consumed by `apps/console` (canonical React host surface; `apps/web` is legacy).

```ts
interface CommonplaceHost {
  queryObjects(q: ObjectQuery): Promise<ObjectSet>;
  invokeCapability(r: CapabilityInvocation): Promise<CapabilityReceipt>;
  subscribeWorkspace(id: string, l: (e: WorkspaceEvent) => void): () => void;
  placeBlock(r: BlockPlacementRequest): Promise<BlockInstance>;
  persistLayout(l: WorkspaceLayout): Promise<void>;
  openTarget(t: OpenTarget): Promise<void>;
}
```

Refactor the React app's existing calls onto `WebHostAdapter` (no behavior change), implement `TauriHostAdapter`, implement `GpuiHostAdapter` over a typed loopback transport, and ship one adapter-conformance suite all three must pass.

Acceptance: the web edition passes its existing behavior fixtures on the adapter with zero regressions; the conformance suite is green for all three adapters (Gpui against a loopback harness); grep of `apps/web` shows no direct transport calls bypassing the interface.

### B2. BrowserCore

Path: CommonPlace repo `crates/browser-core` (GPUI-free).

Tabs, navigation, and history as views over the session graph; a permissions store with receipts feeding the native prompts; minimal downloads with receipts; session recovery; the single-instance socket routing a second launch's argv (URLs, files) into the running shell; protocol-scheme and default-browser registration per OS; the update check against the cargo-dist feed.

Acceptance: tab and history fixtures round-trip through the session graph; a second launch delivers its URL to the first instance and exits; registration is exercised on macOS with the OS dialog flow captured, other OSes reported as verified or not; a permission grant and a download each produce receipts; the update check parses the fixture feed and never auto-applies.

### B3. InteractionArbiter

Path: CommonPlace repo `crates/interaction-arbiter` (GPUI-free).

Input ownership per surface; agent action leases with acquire, renew, freeze, and cancel; the one-frame human-preemption law; focus ownership registry; the canonical `AgentPresence` state (surface, state, anchor, frozen, intent) with handoff events at surface boundaries, consumed by every realm's renderer.

Acceptance: a scripted agent action freezes within one frame of synthetic human input (event-timestamp assertion); lease expiry cancels cleanly; presence handoff events for a scripted cross-realm path arrive ordered with no gap and no overlap; focus registry matches the scripted focus sequence.

### B4. GPUI shell

Path: CommonPlace repo `apps/browser-native`, its own Cargo workspace, pinned SHAs, committed lockfile.

The window; native top bar with omnibox wired per the named verbs; DockArea per the named arrangement with layout persisted to the graph and restored; native permission and takeover prompts rendered from BrowserCore's grant requests; the capability rail fed by extension-point contributions through the bridge; the native presence renderer; all GPUI use behind the `Shell`, `DockHost`, and `SurfaceHost` traits.

Acceptance: the shell runs with mock surfaces; a fixture grant request renders the native prompt and resolves into the permissions store; the rail lists fixture contributions and updates live on install through the bridge subscription; DockArea layout survives restart via the graph; a trait-boundary check shows no GPUI types exported.

### B5. Servo surface hosting

Path: `apps/browser-native` plus the unchanged pane-host.

Pane-host Servo surfaces parent into the shell window by RawWindowHandle; bounds track DockArea panels; focus and IME route through the arbiter; presence, takeover indication, and find highlights draw through the SceneOS display-list producer seam from canonical arbiter state.

Acceptance: an ordinary site loads in a docked Servo panel; CommonPlace and Servo resize side by side with surfaces tracking within a frame of settle; keyboard focus and an IME composition smoke pass in the Servo panel; the presence overlay renders in-page from a fixture presence state and hands off at the panel edge.

### B6. CommonPlace surface hosting

Path: `apps/browser-native` plus `packages/host-bridge`.

A gpui-wry panel loads the built React bundle; the GpuiHostAdapter speaks the loopback transport; reloading the surface loses no block state because canonical state lives in the substrate and reload re-subscribes; the z-order law is enforced by layout (no native overlay may intersect the webview rectangle).

Acceptance: the bundle loads and `placeBlock` round-trips through the adapter; a forced reload restores the fixture workspace byte-identically from the substrate; a scripted native-popover fixture shows zero intersection with the webview rect (screenshot assertion); killing the webview shows the honest crashed state with restart.

## Frontend deliverables

Paths: CommonPlace repo `apps/web` (running inside the surface).

### F1. React presence and lens renderers

The React realm renders the agent cursor and find-highlight lens from bridge presence and lens events, visually continuous with the native renderer's style at the boundary.

Acceptance: a scripted presence path crossing native chrome into the React surface renders one continuous cursor in capture (no duplicate, no gap frame); the lens highlights the fixture block content from canonical state.

### F2. Rail-initiated placement

Click-to-add and command-to-add from the capability rail invoke `placeBlock`; the block instance appears in the workspace with its canonical id and grants; the animated cross-surface drag is explicitly absent and named as its own handoff.

Acceptance: rail click adds the fixture block visible in the React surface with the canonical id from the substrate; the command palette path adds the same; no drag handlers for cross-surface drag exist in this build.

### F3. The proof window

The ten-point proof as a scripted acceptance suite, gating any further chrome migration into GPUI: native top bar; gpui-wry loading the real CommonPlace build; a Servo surface on an ordinary site; side-by-side resize; keyboard focus and IME correctness; shell-captured find routed to the focused surface; human pointer movement freezing an agent action; agent-cursor handoff across all three realms; React surface reload without block-state loss; a native permission prompt that page content cannot imitate or invoke. The hardest three (surface composition, input routing, overlay handoff) get capture evidence in the report.

Acceptance: all ten pass as automated or scripted-with-capture checks; the report includes the captures for the hardest three; a failing point blocks chrome-migration work by policy stated in the report.

## Out of scope

Porting any React feature into GPUI (markdown editing, correspondence composition, search results, shaders, the block canvas, document layouts, the composer, settings), compact native block renderers (renderer negotiation, its own handoff), the animated cross-surface drag, Windows and Linux runtime polish beyond honest reports, replacing the Tauri edition or mobile, and any change to the block system's internal drag mechanics. Each is its own handoff; none gates anything above.

## Reporting

Per CONVENTIONS: scannable status list per deliverable with acceptance verified or not and how. Lead with what is not done or not verified, including the pinned SHAs, per-OS registration status, and the proof-window captures.
