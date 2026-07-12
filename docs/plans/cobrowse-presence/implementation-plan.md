# Co-browse presence + Presence mark implementation plan

Specs: HANDOFF-COBROWSE-PRESENCE (D1..D8) and SPEC-UI-SOURCING-ADDENDUM (library rows, binding map, Presence mark D1..D3). Date: 2026-07-12.

## Verify-first findings (recorded before any code)

- The local rustyred-thg node (:17888) is not running on this machine. D1 types are grounded in the engine source instead: `Theorem/rustyredcore_THG/crates/rustyred-thg-server/src/router.rs` (handler `browser_browse_with_me` at 2934, payload at 2351-2368, live session at 2381-2487) and `crates/theorem-browser-agent/src/lib.rs` (PerceptionBundle 483, ActionCandidate 846, BrowsingRunReceipt 1159). The contract fixture is captured from the real handler by a Rust test (see D1 below), not hand-written.
- Confirm semantics (verified in router.rs tests at 11046-11111): `confirm:false` with an action returns `live_browser.status = "preview_pending"` and the engine holds the action on the session (`pending_action`); a follow-up call with `confirm:true` and the same `run_id` drains and actuates (`status = "actuated"`, `action_receipt.applied = true`). The engine already holds confirm-gated actions; the client never needs to cancel a half-applied action.
- No stable intent string exists in the response today. Per D1 it is added at the node route: `live_browser.intent` (this change, in router.rs), derived server-side from the pending or applied action.
- There is no Servo sidecar. Tabs are separate Tauri `WebviewWindow`s (crates/commonplace-desktop-runtime/src/lib.rs, `ensure_tab_window` 1500-1526), shown/hidden by `tab_set_active`. The shell emits no events to the web layer today and has no highlight command. Both are added in this change (see D3/D4).
- Pointer and keyboard entry into the page stage is observable only as the OS focus transition onto the tab window (`WindowEvent::Focused(true)`); external-URL webviews do not expose in-page input to the shell. D4's detection point is that focus transition, documented in the component.
- Tab lifecycle: `on_navigation` and page-load hooks exist on the Tauri builder; they are wired to emitted events in this change. No SSE or session route exists on the engine; continuity is by resubmitting `run_id`.
- The wait ladder (useWaitTier, WeaveSpinner, narration inventory with a `coBrowseAction` kind, five-state ViewState) exists on branch `origin/claude/ux-physics-accent-spec-6a03d8`, not on this branch. The actual source files are imported (git checkout of those paths), not rewritten.
- FO-041 does not exist anywhere in either repo. The contract-pair convention honored instead: every new command/event is documented in `apps/desktop/src/lib/commands.ts` alongside the runtime implementation.
- textmode.js 0.17.0: real, zero runtime dependencies, WebGL2-only, single-file ESM (~1.0 MB unpacked, not tree-shakable per-module). Options include `canvas` (mount into an existing canvas), `pixelDensity`, `seed`, `frameRate`, `fontSource`; loop control `noLoop/loop/redraw`; drawing `char/charColor/cellColor/point/rect/line/translate/push/pop`. textmode.export.js 1.5.2 provides `plugins: [ExportPlugin]` and `t.saveCanvas({format, filename})`.
- WebGL2 in Tauri WebViews: verifiable on this machine only for macOS (WKWebView). Windows (WebView2/Chromium) and Linux (WebKitGTK) support WebGL2 per platform documentation but are not machine-verified here. Named gap.
- Font: v1 uses the library default UrsaFont (CC0). Runtime brand-font swap is available via `fontSource` (TTF/OTF/WOFF); mixing two fonts in one scene is not supported by the library, so "occasional brand-font characters" is deferred and named as a gap.
- tablecn/TanStack: repo already has @tanstack/react-table ^8.21.3 and @tanstack/react-virtual ^3.13.21. Binding-map rows are documentation for surfaces outside this handoff.

## Checklist (reconciled 2026-07-12, end of implementation session)

Engine (Theorem repo, rustyred-thg-server):
- [x] (COBROWSE D1, D3) `intent` string added to `live_browser` payloads (preview_pending and actuated branches), derived server-side by `action_intent_line` (router.rs, next to page_state_payload); `browse_with_me_live_session_previews_then_confirms_action` asserts presence and present-tense shape. PASSED: `cargo test -p rustyred-thg-server browse_with_me_live_session`.
- [x] (COBROWSE D1) Fixture capture: the same test writes the two real handler responses when `EMIT_BROWSE_WITH_ME_FIXTURE` is set; captured output at apps/web/src/lib/__fixtures__/browse-with-me.captured.json (preview intent: `Filling "Name" with "Travis"`).

Desktop shell (CommonPlace, commonplace-desktop-runtime + commands.ts contract doc):
- [x] (COBROWSE D3) `tab_highlight` / `tab_clear_highlight` commands (eval'd gold-register outline overlay at the bbox, pointer-events none).
- [x] (COBROWSE D4) `cobrowse://stage-focus` emitted from on_window_event on Focused(true) for `tab-` windows.
- [x] (COBROWSE D6) `cobrowse://navigation` emitted from the tab builder's on_navigation hook.
- [x] (COBROWSE D8) `AgentIngestionReceipt` extended with `object_id` (from the remember payload) and `nearest_neighbor` (best-effort recall by title), both real-data-or-absent.
- [x] Contract doc updated in apps/desktop/src/lib/commands.ts (commands, events, corrected extract_visible_text description).
- [ ] BLOCKED, pre-existing: `cargo check` of the desktop runtime fails on a cross-repo lockfile collision (`commonplace v0.1.0` exists in both CommonPlace/crates and Theorem/rustyredcore_THG/crates and the two drifted; fails identically with --locked and predates this change, which touches no manifests). API usage verified against vendored tauri 2.11.5 source instead (on_navigation, eval, Emitter). Needs a rustyred-source sync (`npm run sync:rustyred`) or a lockfile reconciliation session.

Web (CommonPlace apps/web):
- [x] (COBROWSE D1) `desktop.ts` BrowsePerception types + `parseBrowsePerception` runtime guard + `proposedActionOf`; `browseWithMe` returns the typed contract with `wait: true`; desktop.contract.test.ts deserializes the captured fixture. No `unknown` remains on the co-browse path.
- [x] (COBROWSE D2) ControlSpectrum (Watch/Pair/Drive → agent_drive/pair/human_drive), pointer-down firing, sessionStorage persistence; request-capture test asserts control_mode per segment on the wire.
- [x] (COBROWSE D3) Telegraph in useCoBrowseSession: tab_highlight at the pending action's bbox + node-resolved intent line; dwell 1600ms Watch / 700ms Pair; intent entries recorded in the rail.
- [x] (COBROWSE D4) Interrupt: stage-focus handler cancels timers synchronously, flips to Pair, renders the pause chip with one-press Resume; semantics documented in the hook header (engine holds pending_action; pause = withhold confirm; in-flight atomic confirm completes).
- [x] (COBROWSE D5) ApprovalCard: what/why/blast radius, Enter/Escape with visible buttons, oxblood tokens; decline calls the engine veto branch (session continues). Keyboard test passes.
- [x] (COBROWSE D6) ReceiptRail: collapsed by default, ordered, expandable to receipt fields, virtualized; 200-entry test asserts subset mounting.
- [x] (COBROWSE D7) PerceptionCards: three cards from BrowsePerception; five states through ViewStateView + wait ladder (coBrowseAction narration); no JSON.stringify remains in CoBrowserView or successors (grep clean).
- [x] (COBROWSE D8) Keep: extractVisibleText → agentTabIngest → gold-register toast with storeTarget, trustTier, nearestNeighbor (when the store returns one), receipt id; object link renders only when the store named the note id; reduced motion honored in CSS.
- [x] (ADDENDUM Presence D1) PresenceMark: textmode.js scene, six states, gold base + oxblood commit flash, reduced-motion statics, pointer-events none, noLoop + 1.6s shimmer tick in idle, one-frame settle on interrupt.
- [x] (ADDENDUM Presence D2) One component, three mounts: CoBrowserView telegraph, AgentThreadView composing indicator, ReceiverView run-activity glyph.
- [x] (ADDENDUM Presence D3) presenceExport.ts: saveSVG + saveCanvas(png) per state from the same presenceStates definitions; developer-invoked only.
- [x] Wait ladder imported from branch `origin/claude/ux-physics-accent-spec-6a03d8` (actual files, not rewritten): commonplace-wait-tier.ts (+test), commonplace-wait-narration.ts (+test), commonplace-view-state.ts, ViewStateView.tsx, WeaveSpinner. useWaitTier reworked to timer-only updates for this branch's react-hooks compiler lint (same observable semantics; one-tick correction on reactivation).

Docs:
- [x] (ADDENDUM library table + binding map) Appended to Theorem/docs/plans/commonplace/SPEC-UI-COMPONENT-SOURCING-AND-RESKIN.md with verify-first findings.
- [x] Validation: vitest 30 files / 171 tests pass; tsc --noEmit clean; eslint clean on all touched files (one react-hooks/incompatible-library warning on useVirtualizer, a compiler heuristic; @tanstack/react-virtual is already a repo dependency). Repo-wide eslint has 259 pre-existing problems in untouched files. Cargo: server tests pass; desktop runtime blocked as noted above.

## Named gaps (surfaced, not hidden)

1. Live end-to-end demonstration (real node + desktop shell + real page) is not performed in this session: the local node is down and the desktop shell is not built here. Acceptance items that require a recorded live session (D2 screenshot, D3 recorded Watch session, D8 live Keep) are implemented and unit/contract tested but not live-verified.
2. `nearest cluster or neighbor` in the D8 toast: `AgentIngestionReceipt` carries id/status/url/title/store_target/trust_tier/message only. The toast renders the real fields; nearest-neighbor requires a graph query the shell does not expose. Adding it needs a runtime command against the local node store.
3. In-page pointer coordinates are not observable from external-URL webviews; interrupt detection is the tab-window focus transition (first click or keystroke into the stage necessarily focuses it).
4. WebGL2 verified on macOS only in this session; Windows/Linux/mobile-web unverified here.
5. Presence mark v1 renders in UrsaFont; brand-font mixing unsupported by textmode.js.
