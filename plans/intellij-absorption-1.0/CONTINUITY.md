# CONTINUITY — next session brief (2026-08-10, post-gate wave closed)

## Where we are

Plan `intellij-absorption-1.0`: S0 spike CLOSED (gate PASSED). **Post-gate wave CLOSED 2026-08-10** — six nodes sealed done, three verify gates PASSED:
- **d8** (decision): vfs sits BESIDE agentfs (siblings over one graph store + blob store). Graph-native workspaces via AgentFsHost; host workspaces via vfs journal (generation cursors) + stock HostFs; fuse_host = LSP/PTY/git mountpoint when AgentFs-backed. Bonus: `rustyred-thg-vfs` is already an IntelliJ-VFS-semantics port in-substrate.
- **d7** (decision): D7 pinned — lapce-xi-rope 0.3.2 is the single text algebra (RopeDelta wire/compute/rebase); substrate owns durable delta encoding; fleet manifest fleet/andel rope row amended (ropey superseded, clause satisfied).
- **d7m** (work): text-model migration done — `rustyred-thg-text-model` re-backed on lapce-xi-rope; Operation algebra deleted; `encoding.rs` (353 lines) durable encoding; affinity resolved by fixtures (interval tree retained — Spans cannot express per-boundary greedy affinity); **16/16 tests green** (verify re-ran).
- **theorem-proxy** (work): `lapce-proxy/src/backend/` — WorkspaceBackend trait (14 methods) at dispatch file layer; HostFs verbatim parity (4 tests); AgentFs over AgentFsHost per handoff mapping (10 tests, feature `agentfs`); **check + 14/14 backend tests green** (verify re-ran). Watcher→store-subscriptions + BufferHead→graph-history recorded as seams (no per-file head / no subscription channel on AgentFsHost).
- **token-kernel** (work): K1 seed found LIVE — Int UI tokens are the CommonPlace console's `int-ui-register.css` (verbatim JetBrains expUI_dark.theme.json, SHA 1a82cda); canonicalized to `Theorem/apps/theorem-style/tokens/int-ui.json`; `theorem-style` kernel crate (8 Space values, Inset/Gap, Surface roles, density mode, no margin on block-level, zero deps); `theorem-style-intui` theme binding; **generated `theorem-int-ui.toml` into fork themes/ with schema MATCH (165 keys/4 tables)**.
- **p-l3** (probe): evidence `P-L3-PROBE.md` — inherited-behavior inventory; K8 IdeaVim corpus map (expressible/upgrade/new-machinery buckets); K2/K5/K6 probes named; g0 items informed (copy/paste on wasm = new web-sys Clipboard adapter; text model lives in floem_editor_core, not the fork).

## The one line that matters for the next head

**ws-integration is UNBLOCKED**: theorem-proxy, d7m, and token-kernel all landed with verified gates. The next wave charts and executes: websocket transport for `ProxyMessage` (chart as a work node), then ws-integration (fork crates → rustyredcore_THG as theorem-ide-app/rpc/proxy; IDE proxy folds into the `theorem` binary — one process, one store handle; rename resolves the `apps/theorem-proxy` name collision → `theorem-ide-proxy`; g0 carry-forward verify: real-OS IME first, GL fallback, one-frame keystroke budget, copy/paste adapter, a11y decision).

## Repos / commit state (as of close)

- **Fork** (`Theorem/apps/theorem-ide/lapce`, own git repo, master): working tree has lapce-proxy backend changes + themes/theorem-int-ui.toml — COMMIT NEEDED (scoped; no git add -A — wasm-serve artifacts live there).
- **Theorem** (branch feat/browser-driver-1.0, LARGE dirty tree from other agents — never `git add -A`): stage only `rustyredcore_THG/crates/rustyred-thg-text-model/**`, `docs/plans/jetbrains-fleet-port/CLOSURE-MANIFEST.md`, `docs/plans/intellij-absorption/*.md`, `apps/theorem-style/**`.
- **Board** (`CommonPlace`, branch feat/ard-ui-parts-1-4-6): plans dir updated (manifest/edges/replay/lessons/continuity/node files) — COMMIT NEEDED.
- (If the head already committed at close, verify with `git --no-optional-locks status` before re-committing.)

## Environment (MANDATORY — machine OOM'd twice)

- SSD `/Volumes/SSD Samsung` is 100% FULL: global `~/.cargo/config.toml` target-dir AND `~/.cargo/registry`+`git` symlinks point there. EVERY cargo invocation needs:
  - `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target`
  - `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home`
  - `cargo +1.96.1`, `cargo check`/`test` only, `-j 4`.
- Theorem repo dirty tree: stage explicit paths only. Fork repo: scoped commits only.

## Remains (recorded, not lost)

- d7m: consumer-call-site adapter if old char-based names needed (len_chars→len_bytes, byte↔utf16 renames).
- theorem-proxy: watcher→store-subscriptions seam, BufferHead-from-graph-history, fuse_host mount lifecycle, rename → theorem-ide-proxy (all ws-integration).
- token-kernel: floem Style-chain binding, CSS + Rust-constants dialects (`--dialect css|rust`), light Lapce theme (binary ready), fork activation (user data-dir themes — repo themes/ not scanned), font face decision, kernel/binding unit tests.
- p-l3: K2 matcher-gap fixture run, K5 chord-semantics conformance, K6 driver traces (probes defined, not executed).
- g0 carry-forward: real-OS IME (browser, unproven), GL fallback (wgpu webgl feature, unexercised), one-frame keystroke budget (unmeasured), copy/paste (web-sys Clipboard adapter needed), a11y decision (unrecorded).

## Pitfalls (don't re-discover)

- Cargo 1.96 fingerprinting misses dependency-source edits — rm -rf affected target artifacts after such edits.
- Verification scripts must dump ALL console lines; filtered slices hid working logs for hours (S0).
- Headed Chrome only (WebGPU). Canvas 800x600; tree click column x≈35-45.
- OOM purges /tmp — verify harness lives in fork's wasm-serve/verify/.
- Disk is shared with other agents' builds — free only your own stale artifacts; never delete others' targets.
