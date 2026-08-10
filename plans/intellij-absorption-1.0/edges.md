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
Handoff: merge fork crates into rustyredcore_THG as theorem-ide-app/rpc/proxy (rename; name-collision resolution → theorem-ide-proxy), IDE proxy folds into theorem binary (one process, one store handle), websocket transport for ProxyMessage (charted-in as remaining prerequisite), g0 carry-forward verify items (real-OS IME first; GL fallback; one-frame keystroke budget; copy/paste = new web-sys Clipboard adapter; a11y decision). UNBLOCKED as of 2026-08-10 (theorem-proxy, d7m, token-kernel all done; transport still to chart as a work node).

## (theorem-proxy + d7m + token-kernel + websocket transport) -> ws-integration
Handoff: merge fork crates into rustyredcore_THG as theorem-ide-app/rpc/proxy (rename; name-collision resolution), IDE proxy folds into theorem binary (one process, one store handle), websocket transport for ProxyMessage, g0 carry-forward verify items (real-OS IME first). BLOCKED on dependencies.
