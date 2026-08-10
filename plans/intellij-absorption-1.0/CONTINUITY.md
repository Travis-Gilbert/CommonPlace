# CONTINUITY — next session brief (2026-08-10, wave 5: integration wave — g0-verify SEALED with measured results)

## Where we are

Plan `intellij-absorption-1.0`. S0 spike closed; post-gate wave closed (d8/d7/d7m/theorem-proxy/token-kernel/p-l3). **Wave 5 (integration) status:**
- **ws-transport DONE, gate PASSED** — websocket transport; browser↔real-proxy smoke 5/5. Fork `17ef8dd`.
- **ws-merge DONE, gate PASSED** — fork crates merged into `rustyredcore_THG` as `theorem-ide-app`/`rpc`/`proxy`/`core`; floem pin traveled; repairs (tree-sitter 0.26, wasmtime 14.0.4, psp-types vendored). Theorem `0f991b63c`, fork `93909f1`.
- **g0-verify DONE, gate PASSED (sealed this session, 2026-08-10)** — all five items executed or protocol'd:
  - O-G.1 a11y decision recorded (focus model = attach seam).
  - O-G.2 `WebClipboard` adapter; app checks green native + wasm32 (closes ws-merge O-M.4).
  - O-G.3 keystroke budget **MEASURED PASS**: n=8, median 9.90ms, p95 15.0ms, max 19.2ms (<32ms violation threshold). Raw trace: `wasm-serve/verify/shots/g0-keystroke/traces.json`.
  - O-G.4 GL fallback **EXECUTED → FAIL at device-request, root-caused**: `--disable-features=WebGPU`/`--disable-webgpu` are no-ops in CfT 1234; `--disable-gpu` over-forces (kills WebGL2 → AdapterNotFoundError panic). Page-level `navigator.gpu` shadow (committed forcing method) proves the GL backend ENGAGES but `request_device` fails: `max_compute_workgroups_per_dimension requested: 65535, allowed: 0` (floem default limits vs WebGL2 no-compute) → floem unwrap panic at app_handle.rs:83:71; canvas unpainted. WebGPU control PASS (Metal). **WebGPU remains the only working web backend — integration NOT blocked.** Fix is floem-side (limit policy + unwrap hardening) → **charted as decision node `d9-gl-fallback`** (pending decision; does not gate). Secondary: floem unwraps device errors on web (winit RefCell cascade); pixel-distinctness alone is a false-positive render oracle.
  - O-G.5 real-OS IME protocol written — **the one MANUAL verify item** (CJK via macOS IME; needs a CJK font since DejaVu has none).
- **ide-proxy-fold PARKED (weather)** — `theorem ide-proxy` code LANDED; check + smoke blocked by another agent's in-flight `rustyred-thg-mcp` refactor (lib.rs unparseable) + disk. **Check the weather now — the refactor may have healed.**
- v-ws-integration: pending on ide-proxy-fold.

## The one line that matters for the next head

**g0-verify is sealed with numbers; the wave's only remaining code path is ide-proxy-fold (theorem-cli check → `--help` capture → smoke → the AgentFs one-store seam `serve_ws_with_backend`), then v-ws-integration gate → seal ws-integration → next wave (console-host consumption of the wasm frontend; token-kernel remains: floem Style-chain binding, CSS/Rust dialects, light theme, fork activation, unit tests; p-l3 probe executions K2/K5/K6; d9-gl-fallback decision).**

## Commits (IN FLIGHT — this session's work, scoped paths only)

- Fork (`apps/theorem-ide/lapce`, branch master): `git add wasm-serve/build-wasm.sh wasm-serve/patch-glue.py wasm-serve/verify/keystroke-budget.js wasm-serve/verify/gl-fallback.js wasm-serve/verify/shots/g0-keystroke wasm-serve/verify/shots/g0-glfallback` then commit. NEVER `git add -A` (wasm-serve artifacts: bundle, .bmp files, node_modules).
- Theorem: `git add docs/plans/intellij-absorption/G0-VERIFY.md` (commit; branch moves under other agents — scoped paths only).
- Board (`CommonPlace`, branch `feat/ard-ui-parts-1-4-6`): manifest.md, nodes/g0-verify.md, nodes/d9-gl-fallback.md (new), replay.md, CONTINUITY.md. `.tmp-gl-render.png` in plans dir was a scratch view copy — DELETE before commit (or leave unstaged; better delete).

## Environment (MANDATORY — machine OOM'd twice historically; now healthy)

- SSD `/Volumes/SSD Samsung` target: `~/.cargo/config.toml` points there. EVERY cargo invocation needs `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target` + `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home`. Disk currently FINE (9.1Gi free) — I freed a stale 2.4G rustyredcore_THG/target + 153M theorem-style target. Do not assume disk-blocked.
- `cargo +1.96.1`, check/test only, `-j 4`. wasm32 needs the S0 CC recipe (`CC_wasm32_unknown_unknown="/opt/homebrew/opt/llvm/bin/clang --sysroot=/tmp/wasi-sysroot"`, `CFLAGS_wasm32_unknown_unknown="-Wno-implicit-function-declaration"`).
- After ANY dependency-source edit: `rm -rf` affected wasm32 artifacts (cargo 1.96 fingerprints miss dep edits).
- wasm-bindgen CLI must be `.cargo-home/bin` (0.2.126) — `export PATH="$CARGO_HOME/bin:$PATH"` before wasm-bindgen.

## Live runtime (still up, else restart per G0-VERIFY.md close-out)

- `python3 -m http.server 8766` in `wasm-serve/`.
- `theorem-ide-proxy --serve-ws 127.0.0.1:19414 /tmp/lapce-ws-smoke` (`apps/theorem-ide/.target/debug/theorem-ide-proxy`).
- Bundle: `wasm-serve/theorem_ide_wasm_bg.wasm` 19.1MB from the merged crate.

## Remains (recorded, not lost)

- **ide-proxy-fold resume** (first priority once mcp tree heals): `cargo +1.96.1 check -p theorem-cli --manifest-path apps/theorem-cli/Cargo.toml` (chain: mcp → theorem-agentd → harness → rustyred-embedded → theorem-cli; resumes from cached rmeta), `theorem ide-proxy --help`, smoke, then the AgentFs one-store seam (ide_proxy.rs hands the engine store to `serve_ws_with_backend` in theorem-ide-proxy — "keystroke → delta in the harness store"). HONEST GAP from the fold: AgentFsBackend opens its own session store — backend-injection seam is a named remain.
- g0-verify: real-OS IME manual verify (CJK font needed first).
- d9-gl-fallback: decision (patch floem vs require WebGPU).
- token-kernel remains: floem Style-chain binding (heavy — needs disk), CSS + Rust-constants dialects, light Lapce theme (binary ready), fork activation (user data-dir themes), font face decision, kernel/binding unit tests.
- p-l3: K2 matcher-gap fixtures, K5 chord-semantics conformance, K6 driver traces (probes defined).
- d7m: consumer-call-site adapter if old char-based names needed.
- Editor viewport dark-paint cosmetic (S0.3 quirk) rides along; known, cosmetic.

## Pitfalls (don't re-discover)

- GL fallback: CfT 1234 ignores `--disable-features=WebGPU` AND `--disable-webgpu`; `--disable-gpu` kills WebGL2 too; the working forcing method is the page-level `navigator.gpu` shadow (baked into gl-fallback.js). GL renders only via WebGPU at this floem pin — compute limits.
- Cargo 1.96 fingerprints miss dependency-source edits — rm -rf affected artifacts after such edits.
- wasm32 check REQUIRES the S0 CC recipe even for check (tree-sitter C build script).
- Verification scripts must dump ALL console lines; pixel-distinctness alone is a false-positive render oracle (canvas-region probe + no-panics gate required).
- Headed Chrome only (WebGPU); tree clicks: cls threshold >55 + 2-of-5 + collapse-recovery; wire signals (`new_buffer`, `update`) are the success oracle, not editor pixels.
- Another agent's in-flight refactor can leave shared crates unparseable — check `cargo check` errors against `git status` before assuming your code broke.
- The Theorem repo branch moves under other agents; shared tree has uncommitted changes — scoped-path staging only.
- Playwright + browsers get purged from /tmp on OOM; reinstall recipe: `npm i playwright` + `PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright npx playwright install chromium`; launch with explicit `executablePath` (chromium-1234 headed Chrome for Testing).
