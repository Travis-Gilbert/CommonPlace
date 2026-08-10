# CONTINUITY — next session brief (2026-08-10, wave 5: integration wave — mostly sealed, one park)

## Where we are

Plan `intellij-absorption-1.0`. S0 spike closed; post-gate wave closed (d8/d7/d7m/theorem-proxy/token-kernel/p-l3). **Wave 5 (integration) status:**
- **ws-transport DONE, gate PASSED** — websocket transport (stdio-framing over ws; native tungstenite + wasm web-sys backends; proxy `serve_ws`; wasm client behind `ws-proxy` feature). **Smoke 5/5**: browser ↔ real proxy — real-FS tree, buffer with real bytes, typing `Update{delta,rev}` on the wire, palette. Fork `17ef8dd`.
- **ws-merge DONE, gate PASSED** — fork crates merged into `rustyredcore_THG` as `theorem-ide-app`/`theorem-ide-rpc`/`theorem-ide-proxy`/`theorem-ide-core`; floem pin traveled; fork pruned; wasm-serve builds `theorem_ide_wasm` from substrate; repairs: tree-sitter 0.26 StreamingIterator wrapper, wasmtime 14.0.4 pin (git rev 21419eb), psp-types vendored (lsp-types 0.97 Url→Uri). Theorem `0f991b63c`, fork `93909f1`. Checks green (rpc/proxy/core) + syntax tests 2/2; **theorem-ide-app native + wasm32 checks now GREEN** (closed by g0-verify's clipboard work).
- **g0-verify DONE, gate PASSED** — a11y decision recorded (focus model = attach seam); `WebClipboard` adapter landed; keystroke-budget + GL-render protocols staged; real-OS IME protocol written. Evidence `G0-VERIFY.md`.
- **ide-proxy-fold PARKED (weather)** — `theorem ide-proxy` subcommand code LANDED (`apps/theorem-cli/src/ide_proxy.rs`, main.rs dispatch, wasmtime-14 lockfile pin; one-store proof via EngineHost→rustyred-embedded, SR-017). Check + smoke blocked by: (1) another agent's in-flight `rustyred-thg-mcp` refactor leaving `lib.rs` UNPARSEABLE (unclosed delimiter l.30409), (2) disk. **Trigger: mcp tree heals + ≥1.5Gi quiet disk.**
- v-ws-integration: pending on the park trigger.

## The one line that matters for the next head

**The wave parks on two triggers, not on code**: (1) `cargo check -p theorem-cli` (resume ide-proxy-fold — chain: mcp → theorem-agentd → harness → rustyred-embedded → theorem-cli; then `--help` capture + smoke + the AgentFs one-store seam `serve_ws_with_backend`); (2) ~4Gi disk headroom → wasm bundle build → run the staged keystroke-budget + GL-fallback scripts, then the real-OS IME manual verify (first manual verify of the merged build). After that: v-ws-integration gate → seal → next wave (console-host consumption of the wasm frontend; token-kernel remains: floem binding, CSS/Rust dialects, light theme, fork activation, unit tests; p-l3 probe executions K2/K5/K6).

## Commits this wave

- Fork: `17ef8dd` (ws-transport), `93909f1` (prune). Uncommitted in fork: g0-verify's wasm-serve scripts (stage `wasm-serve/verify/keystroke-budget.js`, `gl-fallback.js` + any shots).
- Theorem: `0f991b63c` (ws-merge). Uncommitted: g0-verify (theorem-ide-app clipboard + repairs + G0-VERIFY.md) + ide-proxy-fold (theorem-cli code + IDE-PROXY-FOLD.md) — COMMIT NEEDED, scoped paths only.
- Board: wave-5 updates (manifest/edges/replay/lessons/continuity + ws-transport/v-ws-transport/ws-merge/g0-verify/ide-proxy-fold node records) — COMMIT NEEDED on `feat/ard-ui-parts-1-4-6`.
- Theorem branch moves under other agents (was feat/browser-driver-1.0, now Travis-Gilbert/incremental-derivation-outstanding) — commit scoped paths wherever HEAD is; never `git add -A`.

## Environment (MANDATORY — machine OOM'd twice; disk is the binding constraint)

- SSD `/Volumes/SSD Samsung` 100% full: `~/.cargo/config.toml` target-dir AND registry/git symlinks point there. EVERY cargo invocation needs `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target` + `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home`.
- System volume was at 110Mi free (254Mi after freeing theorem-style/.target — rebuildable, mine). Other agents' builds consume it unpredictably. Before ANY build: `df -h /`; free only your own stale artifacts (old `lapce_*` fingerprints under .target/debug are garbage post-rename).
- `cargo +1.96.1`, check/test only, `-j 4`. wasm32 check needs the S0 CC recipe (`CC_wasm32_unknown_unknown="/opt/homebrew/opt/llvm/bin/clang --sysroot=/tmp/wasi-sysroot" CFLAGS_wasm32_unknown_unknown="-Wno-implicit-function-declaration"`).
- After ANY dependency-source edit: `rm -rf` affected wasm32 artifacts (cargo 1.96 fingerprints miss dep edits).

## Remains (recorded, not lost)

- ide-proxy-fold: theorem-cli check + smoke + AgentFs one-store seam (serve_ws_with_backend; ide_proxy.rs hands the engine store over — "keystroke → delta in the harness store").
- g0-verify protocols: keystroke-budget measurement (expected 8-16ms, >32ms = violation), GL-fallback render (3-step ladder: flag-stick, feature-unification, adapter instrumentation), real-OS IME (CJK via macOS IME; composition window → preedit → commit on the wire → zero panics; glyph check needs a CJK font).
- ws-merge: theorem-ide-app checks (now done); wasm frontend's console-host consumption (charted, next wave).
- token-kernel remains: floem Style-chain binding (heavy — needs disk), CSS + Rust-constants dialects, light Lapce theme (binary ready), fork activation (user data-dir themes), font face decision, kernel/binding unit tests.
- p-l3: K2 matcher-gap fixtures, K5 chord-semantics conformance, K6 driver traces (probes defined).
- d7m: consumer-call-site adapter if old char-based names needed.
- The editor viewport dark-paint cosmetic (S0.3 quirk) rides along; known, cosmetic.

## Pitfalls (don't re-discover)

- Cargo 1.96 fingerprints miss dependency-source edits — rm -rf affected artifacts after such edits.
- wasm32 check REQUIRES the S0 CC recipe even for check (tree-sitter C build script: stdio.h not found without it).
- Verification scripts must dump ALL console lines (filtered slices hid working logs for hours).
- Headed Chrome only (WebGPU); canvas 800x600; tree click column x≈35–45.
- Another agent's in-flight refactor can leave shared crates unparseable — check `cargo check` errors against `git status` before assuming your code broke.
- The Theorem repo branch moves under other agents; the shared tree has many uncommitted changes — scoped-path staging only.
