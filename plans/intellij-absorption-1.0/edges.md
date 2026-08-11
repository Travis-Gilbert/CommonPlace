# edges

## start -> s0
Handoff (from HANDOFF-LAPCE-FORK-SPIKE-1.0 + styling-API amendment): rescope register lane to hard fork lapce/lapce; board amendments 1-5 (insert s0/v-s0, rescope g0, retarget p-l3, D7/D8 rows, re-verify floem pin seam). Read: full handoff + the context note (three-layer style kernel; trunk/wasm-bindgen mechanics; crates dissolve post-gate into rustyredcore_THG; theorem-proxy folds into theorem binary). Remains: S0.1-S0.6 evidence + verdicts.

## s0 -> v-s0
Handoff: node file carries obligations + work log; evidence file at Theorem/docs/plans/intellij-absorption/S0-LAPCE-SPIKE.md (COMPLETE as of 2026-08-10: matrix, cfg-gate table, diff summary, blocker register, bundle size, IME observation, S0.3 diagnosis log, PASS verdicts); verify harness at fork wasm-serve/verify/ (accept-final.js, dumpall.js, af-*.png). Remains: none — gate PASSED, traverse recorded.

## v-s0 -> g0-island-probe
Handoff: s0 DISCHARGED (S0.1/S0.2/S0.3 PASS, kill criteria not triggered). g0-island-probe is superseded-by-s0 (rescope recorded): the probe target is the forked lapce-app workbench in the browser, and its six-point acceptance is the carry-forward list (IME first — still unproven with a REAL OS IME; shaping — proven with vendored DejaVu; GL fallback — available via wgpu webgl feature, unexercised; one-frame keystroke budget — unmeasured; copy/paste/scroll — unmeasured; a11y decision — unrecorded). Those five open items feed the theorem-proxy wave. Remains: probe results feed K2/K5/K6 upgrade decisions + p-l3 retarget.

## g0-island-probe -> p-l3
Handoff: K8 retargets onto Lapce's editor behavior layer; K2/K5/K6 flip to upgrade-decision probes.

## post-gate edges (charted 2026-08-10, wave claimed)

## s0 -> d8
Handoff: read `rustyredcore_THG/crates/rustyred-thg-vfs/src/lib.rs` + `rustyred-thg-agentfs/src/lib.rs`; record one-paragraph layering decision (vfs under or beside agentfs for workspaces). Remains: decision paragraph feeds theorem-proxy's AgentFs impl.

## s0 -> d7
Handoff: D7 decision of record (RopeDelta wire/compute/rebase algebra; substrate-owned durable delta encoding at store boundary; STUDY-RHIZOME-REBASE reference) + fleet manifest amendment row on CLOSURE-MANIFEST.md fleet/andel rope row. Remains: d7m migration.

## d7 -> d7m -> v-d7m
Handoff: decision pins the algebra; d7m executes the shrink (fixture suite first, RopeDelta replaces Operation algebra where covered, affinity resolved by fixtures, encoding module owned). Remains: fixture-green on xi-rope, encoding tests.

## s0 -> theorem-proxy -> v-theorem-proxy
Handoff: fork's lapce-proxy gains WorkspaceBackend trait at dispatch.rs file layer; HostFs preserves stock behavior; AgentFs over AgentFsHost per mapping table; LSP/PTY/git over fuse_host with mirror fallback; git-status-over-FUSE measured not assumed; name collision with existing model-path apps/theorem-proxy recorded (resolve at ws-integration). Remains: mapping tests green, evidence file.

## s0 -> token-kernel -> v-token-kernel
Handoff: K1 token source seeded (int-ui-standalone home absent — seed from CommonPlace console MaterialLayer, provenance recorded); theorem-style kernel crate (typed Space/Inset/Gap/Surface, text roles, density mode, no margin constructor on block-level, framework-free); Int UI theme crate binding; generated Lapce theme file into fork themes/. Remains: kernel + theme checks green, theme file valid.

## s0 -> p-l3
Handoff: K8 onto Lapce editor behavior layer; inherited-behavior inventory; IdeaVim corpus map; K2/K5/K6 upgrade-decision probes; g0 carry-forward items informed. Remains: evidence file P-L3-PROBE.md.

## Post-gate wave traversed 2026-08-10 (all edges below carry these)

## s0 -> d8 (done)
Handoff: vfs sits BESIDE agentfs — siblings over one graph store + blob store; graph-native workspaces serve through agentfs (AgentFs impl → AgentFsHost), host workspaces through the vfs journal (generation cursors = store-subscription watcher seam) + stock HostFs; fuse_host (agentfs) is the LSP/PTY/git mountpoint when AgentFs-backed. Bonus: rustyred-thg-vfs is already an IntelliJ-VFS-semantics port. Remains: consumed by theorem-proxy's WorkspaceBackend classification; nothing open.

## s0 -> d7 -> d7m (done)
Handoff: D7 decision of record pinned (RopeDelta wire/compute/rebase algebra; substrate-owned durable delta encoding at store boundary; STUDY-RHIZOME-REBASE reference); fleet manifest fleet/andel rope row amended (ropey superseded, clause satisfied). d7m executed the shrink: Operation algebra deleted, fixtures 16/16 green on lapce-xi-rope 0.3.2, affinity resolved by fixtures (interval tree retained; Spans cannot express per-boundary greedy affinity), encoding.rs durable encoding tested. Remains: consumer-call-site adapter if the old char-based names are needed (len_chars→len_bytes); the websocket transport (charted, ws-integration wave).

## s0 -> theorem-proxy (done)
Handoff: WorkspaceBackend trait (14 methods) at lapce-proxy dispatch file layer; HostFs verbatim-parity (4 tests); AgentFs over AgentFsHost (10 mapping tests, feature-gated `agentfs`); fuse wiring + git-status-over-FUSE measurement deferred to ws-integration with named protocol; name collision with apps/theorem-proxy recorded. Remains for ws-integration: watcher→store-subscriptions seam, BufferHead-from-graph-history (no per-file head on AgentFsHost), fuse_host mount lifecycle, rename theorem-ide-proxy.

## s0 -> token-kernel (done)
Handoff: K1 seed = int-ui.json canonicalized from CommonPlace console (verbatim Int UI, expUI_dark.theme.json SHA 1a82cda); theorem-style kernel (8 Space values, Inset/Gap, Surface roles, density mode, no margin on block-level, zero deps); theorem-style-intui theme binding; theorem-int-ui.toml generated, schema MATCH (165 keys/4 tables). Remains: floem Style-chain binding, CSS + Rust-constants dialects, light theme, fork activation (user data-dir themes), font face decision, kernel/binding unit tests (check-only wave).

## (theorem-proxy + d7m + token-kernel + websocket transport) -> ws-integration
Handoff: merge fork crates into rustyredcore_THG as theorem-ide-app/rpc/proxy (rename; name-collision resolution → theorem-ide-proxy), IDE proxy folds into theorem binary (one process, one store handle), websocket transport for ProxyMessage (charted-in as remaining prerequisite), g0 carry-forward verify items (real-OS IME first; GL fallback; one-frame keystroke budget; copy/paste = new web-sys Clipboard adapter; a11y decision). UNBLOCKED as of 2026-08-10 (theorem-proxy, d7m, token-kernel all done; transport now charted as ws-transport).

## ws-transport -> ws-integration (charted 2026-08-10)
Handoff: no upstream network transport exists — stdio.rs framing is the reusable seam (stdio_transport/write_msg/read_msg); native local mode runs Dispatcher in-process behind local-proxy feature; wasm used the in-page StubProxy. ws-transport builds: ws.rs in lapce-rpc (native tungstenite + wasm web-sys backends), serve_ws in lapce-proxy fronting Dispatcher with the WorkspaceBackend seam (the theorem-proxy service surface), wasm client wiring (request_async only), browser smoke vs real proxy. Remains: O-WT.1-4 evidence; then ws-integration consumes it (O-WS.3).

## ws-transport done (2026-08-10) — handoff to ws-integration
Handoff: SMOKE PASS 5/5 (first end-to-end browser↔real-proxy run: ws connected, real-FS ReadDir, NewBuffer with real bytes, typing `Update{delta,rev}` on the wire, palette 10 rows). Release bundle 18.9MB (wasm-opt -Oz). Fork committed 17ef8dd. Remains for ws-integration: consumed as O-WS.3; the editor viewport dark-paint cosmetic (S0.3 quirk) rides along.

## ws-merge done (2026-08-10) — handoff to ide-proxy-fold + g0-verify + v-ws-integration
Handoff: four crates merged+renamed into rustyredcore_THG (theorem-ide-app/rpc/proxy/core); floem pin 31fa8f44 + patches traveled; fork pruned; wasm-serve builds theorem_ide_wasm from the substrate; PROVENANCE ledger + register manifest amendment + WS-MERGE.md complete; repair ladder: tree-sitter 0.26 StreamingIterator wrapper, wasmtime 14.0.4 pin + rev 21419eb, psp-types vendored (lsp-types 0.97 Url→Uri). Checks green (rpc/proxy/core) + syntax tests 2/2; theorem-ide-app checks closed later by g0-verify (native + wasm32 green). Commits: Theorem 0f991b63c, fork 93909f1. Remains: ide-proxy-fold check/smoke; the AgentFs store-injection seam; the wasm frontend's console-host consumption (charted, next wave).

## ide-proxy-fold PARKED (weather, resumable) — blocked-on edge
Blocked-on: (1) another agent's in-flight rustyred-thg-mcp refactor (lib.rs unparseable, unclosed delimiter l.30409) — theorem-cli cannot check until it heals; (2) disk headroom ≥1.5Gi quiet. Code landed (theorem ide-proxy subcommand; one-store proof; lockfile wasmtime 14 pin). Resume: theorem-cli check (overrides) → --help capture → smoke → AgentFs one-store seam (serve_ws_with_backend in theorem-ide-proxy; ide_proxy.rs hands the engine store over).

## g0-verify done (2026-08-10) — handoff to v-ws-integration
Handoff: a11y decision recorded (focus model = attach seam); WebClipboard adapter landed + native/wasm32 checks of theorem-ide-app GREEN (closes ws-merge O-M.4; three carry-over defects repaired: resource dirs, native main, getrandom wasm32); keystroke budget protocol staged (expected 8-16ms; >32ms = violation); GL fallback: webgl feature survival verified, render protocol staged; real-OS IME protocol = first manual verify of the merged build (CJK via macOS IME). Remains: the three protocol-deferred executions need a wasm bundle build (~3-4Gi transient disk) — trigger. Evidence G0-VERIFY.md.

## (theorem-proxy + d7m + token-kernel + websocket transport) -> ws-integration
Handoff: merge fork crates into rustyredcore_THG as theorem-ide-app/rpc/proxy (rename; name-collision resolution), IDE proxy folds into theorem binary (one process, one store handle), websocket transport for ProxyMessage, g0 carry-forward verify items (real-OS IME first). BLOCKED on dependencies.

## g0-verify -> d9-gl-fallback -> terminal (decision sealed 2026-08-10)
Handoff: read the d9 derivation manifest and `evidence/d9-gl-fallback/`. Decided: WebGPU is required for the browser IDE at floem `31fa8f44`; do not advertise GL fallback. Remains: none for this decision or its dependents. If no-WebGPU browser support becomes a requirement, chart a new renderer-architecture node that selects TinySkia before wgpu surface creation or supplies a storage-buffer-free WebGL renderer. Learned: wgpu-types 24 `downlevel_defaults()` retains compute 65535; the one-line WebGL2 limits patch merely reveals Vger vertex-storage incompatibility and same-canvas context ownership.

## p-l3-exec done (2026-08-11) — wave-6 first seal; handoff to the board
Handoff: K2/K5/K6 probes executed; verdicts KEEP/KEEP/KEEP. K2: nucleo 84.9% on the register-relevant fixture subset — gaps are hump rank-noise, `*` globs (no surface types them), transliteration; fixture set = upgrade seed. K5: 15/15 conformance — all common-default chords are modal-gated and dropped under default `modal=false` (macOS meta+k pair survives); `0` is count-candidate AND line_start, resolved by the n==0 rule; timeout fixed 1000ms. K6: rank identity 8/8 wire-proven (Enter→NewBuffer == offline oracle top-1), per-keystroke typeahead re-filter proven, one >350ms final-keystroke render lag observed, count parity pixel-limited. Remains: upgrade seeds (fixtures + palette_oracle pair); the parallel agent's untracked ide-absorb-* crates are their K2-upgrade/K3 lane, not ours. Learned: winit KeyCode has no Unidentified at this pin (use a placeholder code; the physical key is unused for ascii chars); the wasm palette can lag the final keystroke's paint while Enter still selects the correct top-1.

## token-kernel-binding done (2026-08-11) — wave-6 seal; handoff to the board
Handoff: O-TKB.1-5 all discharged. Dialects css+rust (drift guard green), light theme schema MATCH, workspace tests 34/34 (kernel 12, floem 8, gen 4, intui 9, doc 1). Floem slice: kernel grew `TextColorMap`/`resolve_text_color`; new `theorem-style-floem` crate maps Theme vocabulary → floem Style chains with readback drift guards; activation = theme files placed in both user data-dir themes folders (`~/Library/Application Support/dev.lapce.Lapce-{Debug,Stable}/themes/`). Remains: selection is a user preference (`color-theme = "Theorem Int UI Dark"`); console-host (weather) and ide-proxy-fold (mcp weather) are the other wave-6 items. Learned: floem Style props are publicly readable (`Style::get(Prop)`) — the drift-guard readback pattern for any floem binding; a new workspace can reuse another workspace's warm target dir when floem rev + features match (~27s instead of multi-GiB).

## board re-entry -> d10-console-host-boundary -> console-host -> v-console-host (2026-08-11)
Handoff: the one-line console-host row had no blueprint or verify sibling. D10 chose CommonPlace-owned browser UI source and loader, the existing authenticated `/IDE` edge as product/rollback boundary, and a pinned Theorem IDE protocol/backend seam. Directly copying the Theorem spike bundle is rejected. Remains: ide-proxy-fold must pass its corrected manifest-path proof; then console-host declares a clean CommonPlace scope, re-homes UI source, emits an immutable artifact manifest, and runs local plus live gates. console-host is parked on those triggers.
