# CONTINUITY — next session brief (2026-08-10, session 7: d9 decision SEALED)

## Where we are

Plan `intellij-absorption-1.0`. S0 spike closed; post-gate wave closed (d8/d7/d7m/theorem-proxy/token-kernel/p-l3). **Wave 5 (integration) is now SEALED:**
- **ws-transport DONE, gate PASSED** — websocket transport; browser↔real-proxy smoke 5/5. Fork `17ef8dd`.
- **ws-merge DONE, gate PASSED** — fork crates merged into `rustyredcore_THG` as `theorem-ide-app`/`rpc`/`proxy`/`core`; floem pin traveled; repairs (tree-sitter 0.26, wasmtime 14.0.4, psp-types vendored). Theorem `0f991b63c`, fork `93909f1`.
- **g0-verify DONE, gate PASSED (sealed session 6)** — all five items executed or protocol'd: O-G.1 a11y decision (focus model = attach seam); O-G.2 `WebClipboard` (checks green native+wasm32); O-G.3 keystroke budget **measured PASS** (n=8, median 9.90ms, p95 15.0ms, max 19.2ms < 32ms; raw trace `wasm-serve/verify/shots/g0-keystroke/traces.json`); O-G.4 GL fallback **executed-FAIL root-caused** (GL backend engages via page-level `navigator.gpu` shadow — CfT 1234 ignores both WebGPU-disabling flags; `--disable-gpu` over-forces and kills WebGL2 too — but `request_device` fails: `max_compute_workgroups_per_dimension requested: 65535, allowed: 0`; floem unwrap panic app_handle.rs:83; WebGPU/Metal control PASS → **WebGPU is the only working web backend, integration NOT blocked**); O-G.5 real-OS IME protocol written = the one MANUAL verify item.
- **v-ws-integration DONE, GATE PASSED-with-deferral (session 6)** — light checks re-run green; inspect items verified (floem pin substrate Cargo.toml:233, fork pruned, wasm-serve re-pointed, ledger + rename table); theorem-cli check re-attempted and **still blocked on weather**: `rustyred-thg-mcp` lib.rs unparseable (unclosed delimiter l.41101, brace balance 4) under another agent's in-flight refactor. Named deferral + resume path recorded in the node.
- **Wave 6 CHARTED (session 6)**: `p-l3-exec` (K2/K5/K6 probe executions), `token-kernel-binding` (floem Style-chain binding, CSS/Rust dialects, light-theme activation in fork, unit tests), `console-host` (wasm frontend in the console surface — weather, apps/console is under other-agent churn). `d9-gl-fallback` charted earlier.
- **ide-proxy-fold PARKED (weather, unchanged)** — `theorem ide-proxy` code LANDED; check + smoke blocked on the same mcp tree.
- **d9-gl-fallback DONE, decision SEALED (session 7)** — the retry mystery was a false source premise: wgpu-types 24 `downlevel_defaults()` retains compute 65535. A temporary `downlevel_webgl2_defaults()` patch cleared device creation in the real headed-browser oracle, then exposed two structural barriers: Vger requires `VERTEX_STORAGE`, and TinySkia cannot acquire Canvas2D after wgpu owns the same canvas with WebGL. Policy: **WebGPU required at floem 31fa8f44; no GL fallback claim**. Evidence in `evidence/d9-gl-fallback/`. Does not gate anything.

## Session-6.5 update (token-kernel-binding executed in parallel)

While the mcp/IDE thread is with Codex, this session claimed **token-kernel-binding**
(wave 6) and delivered the generator-consumer slice:
- **CSS dialect** — `--dialect css` → `apps/theorem-style/dialects/int-ui.css` (both schemes; `--ij-*` register contract names via value-join; alpha preserved).
- **Rust constants dialect + drift guard** — `--dialect rust` → `dialects/int-ui-constants.rs`; the `rust_dialect_matches_kernel_tokens` test (alias-resolved, name-for-name) is the charted drift killer — GREEN.
- **Light Lapce theme** — `theorem-int-ui-light.toml` in fork `themes/`; schema MATCH (165 keys, 4 tables).
- **Workspace `cargo test` first-ever green**: kernel 12/12 (fixed pre-existing `space.rs:142` test bug), gen 4/4, intui 8/8, doc 1.
- **Floem Style-chain binding + fork activation remain PARKED** — reason: multi-GiB codegen on a target/disk contended by the mcp/IDE thread; resume in a disk-quiet session (floem pin 31fa8f44; own target dir).
- Commits: Theorem (theorem-style crates + dialects outputs + TOKEN-KERNEL.md §8), fork (light theme file), board.

## The one line that matters for the next head

**Wave 5 and d9 are sealed with live evidence. The next session has three open threads: (1) resume ide-proxy-fold when the mcp tree parses (theorem-cli check → `--help` → smoke → AgentFs one-store seam `serve_ws_with_backend`); (2) continue wave 6 — p-l3-exec and the parked floem slice of token-kernel-binding are unblocked (console-host waits on apps/console weather); (3) the real-OS IME manual verify (needs a CJK font + human at the keyboard).**

## Commits this session

- Fork (`apps/theorem-ide/lapce`): `3f9c96c` — g0-verify executed (keystroke-budget/gl-fallback script fixes + evidence shots). Never `git add -A` (bundle, .bmp, node_modules).
- Theorem (`Travis-Gilbert/incremental-derivation-outstanding`): `ce9708b76` — G0-VERIFY.md updated (O-G.3 measured, O-G.4 executed-FAIL → D9).
- Board (`CommonPlace`, `feat/ard-ui-parts-1-4-6`): `c9f5e03c` (wave-5 seal) — plus this session's final board commit (v-ws-integration discharge, wave-6 chart, d9 park, replay, continuity) — **COMMIT PENDING** (stage manifest.md, nodes/v-ws-integration.md, nodes/d9-gl-fallback.md, replay.md, CONTINUITY.md).

## Environment (MANDATORY — machine OOM'd twice historically; now healthy)

- Rechecked during d9: the system volume has only ~4.8Gi free while `/Volumes/SSD Samsung` has ~704Gi free. Heavy builds must use an explicit SSD-backed `CARGO_TARGET_DIR`; the prior system-target instruction is superseded. Keep `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home` and `CARGO_BUILD_JOBS=4` max.
- `cargo +1.96.1`, check/test only, `-j 4`. wasm32 needs the S0 CC recipe. wasm-bindgen CLI from `.cargo-home/bin` (0.2.126).
- After ANY dependency-source edit: `rm -rf` affected wasm32 artifacts (cargo 1.96 fingerprints miss dep edits).

## Live runtime (may still be up; restart per G0-VERIFY.md close-out)

- `python3 -m http.server 8766` in `wasm-serve/`; `theorem-ide-proxy --serve-ws 127.0.0.1:19414 /tmp/lapce-ws-smoke`; bundle `wasm-serve/theorem_ide_wasm_bg.wasm` (19.1MB, merged crate).

## Remains (recorded, not lost)

- ide-proxy-fold resume (mcp-weather trigger; resume path in v-ws-integration node + IDE-PROXY-FOLD.md; honest gap: AgentFsBackend opens its own session store — backend-injection seam `serve_ws_with_backend` is the named remain).
- g0-verify: real-OS IME manual verify (CJK font first — DejaVu has no CJK).
- Wave 6: p-l3-exec (K2 matcher-gap fixtures, K5 chord semantics, K6 driver traces — probes in P-L3-PROBE.md) is the next unblocked node; token-kernel-binding: dialects + light theme + workspace tests DONE, floem Style-chain binding + fork activation remain parked (shared-build contention; needs a disk-quiet session).
- console-host: weather (apps/console churn).
- d7m: consumer-call-site adapter if old char-based names needed. Editor viewport dark-paint cosmetic rides along (known, cosmetic).

## Pitfalls (don't re-discover)

- GL fallback: CfT 1234 ignores `--disable-features=WebGPU` AND `--disable-webgpu`; `--disable-gpu` kills WebGL2 too; working forcing method = page-level `navigator.gpu` shadow (baked into gl-fallback.js). WebGPU is required at floem 31fa8f44. `downlevel_webgl2_defaults()` clears device creation but cannot make Vger or TinySkia render on the already WebGL-owned canvas; see the sealed d9 node before proposing a limits-only patch.
- Cargo 1.96 fingerprints miss dependency-source edits — rm -rf affected artifacts. wasm32 check REQUIRES the S0 CC recipe even for check.
- Verification scripts: dump ALL console lines; pixel-distinctness alone is a false-positive render oracle (canvas-region probe + no-panics gate).
- Headed Chrome only (WebGPU); tree clicks: cls threshold >55 + 2-of-5 + collapse-recovery; wire signals (`new_buffer`, `update`) are the success oracle, not editor pixels.
- Shared repos move under other agents — scoped-path staging only; never `git add -A` in Theorem or the fork.
- Playwright + browsers purged from /tmp on OOM; reinstall recipe in the previous brief (chromium-1234 headed, explicit executablePath).
