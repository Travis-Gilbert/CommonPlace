# g0-verify — g0 carry-forward verify items (work, refine of ws-integration)

- kind: work
- controller: agent
- gist: Execute or explicitly defer (with named protocols) the five g0-island-probe carry-forward items on the merged build: a11y decision, wasm Clipboard adapter (copy/paste), one-frame keystroke budget, GL fallback, real-OS IME.
- provenance: g0-island-probe acceptance carry-forward; parent: ws-integration (O-WS.4). Depends on ws-merge (works in the merged theorem-ide-app).

## Blueprint

Five items (from g0 acceptance + p-l3 findings):

1. **a11y decision (record it)**: adopt p-l3's finding — the focus model is the attach seam; decide the recorded posture (e.g. a11y deferred to post-merge with the focus-model seam named; document what a future a11y pass would attach to). Decision paragraph is the deliverable.
2. **Copy/paste on wasm**: implement a web-sys Clipboard adapter behind the existing `Clipboard` trait in theorem-ide-app (p-l3: floem's clipboard.rs documents "TODO: Implement clipboard support for the web" — the app-level seam is the existing Clipboard trait; the adapter lives in the app's wasm module, cfg-gated). Proof: wasm32 check of theorem-ide-app if disk allows; code refs otherwise.
3. **One-frame keystroke budget**: measure keystroke → wire-delta latency via the verify harness (instrument or reuse ws_proxy timing logs): record the measured number (ms) or the named measurement protocol + deferral.
4. **GL fallback**: attempt — headed Chrome with WebGPU disabled (`--disable-features=WebGPU`); the wgpu `webgl` feature (already enabled in the fork's wgpu dep — must survive the merge) should engage WebGL. Record render-or-fail; deferral protocol if the flag doesn't force it.
5. **Real-OS IME**: named protocol — real-OS IME needs a real input session (synthetic composition events were already tested in S0.3: no panic, no CJK glyphs with DejaVu). Write the protocol: what to type (CJK via macOS IME into the canvas), what to observe (composition window, glyphs, correct commit), and mark it the first manual verify of the merged build.

## Obligations

- O-G.1: a11y decision recorded. Proof: evidence paragraph.
- O-G.2: Clipboard adapter implemented (or named deferral with the trait seam + adapter sketch). Proof: code refs + check result.
- O-G.3: keystroke budget measured or protocol written. Proof: evidence paragraph with number or protocol.
- O-G.4: GL fallback attempt recorded (render/fail/deferral protocol). Proof: evidence paragraph.
- O-G.5: real-OS IME protocol written. Proof: evidence paragraph.

## Scope

Writes: merged `theorem-ide-app` (clipboard adapter, wasm module), fork's wasm-serve verify harness (new scripts), evidence `Theorem/docs/plans/intellij-absorption/G0-VERIFY.md`. Do NOT touch: theorem-cli, the merged rpc/proxy crates, the board.

## Environment (MANDATORY)

- CARGO_TARGET_DIR/CARGO_HOME overrides on every cargo invocation; `cargo +1.96.1`, check only, `-j 4`; wasm32 check needs the S0 CC recipe (`CC_wasm32_unknown_unknown="/opt/homebrew/opt/llvm/bin/clang --sysroot=/tmp/wasi-sysroot"`, `CFLAGS_wasm32_unknown_unknown="-Wno-implicit-function-declaration"`). Watch `df -h /` (~2.8Gi free). Headed Chrome only. No commits.

## Acceptance

O-G.1–5 discharged (execute or named protocol).

## Discharge (2026-08-10)

- O-G.1 EXECUTED: a11y decision recorded — deferred post-merge by construction; the focus model (`window_tab.rs:112` Focus enum + keypress when-conditions) is the named attach seam for the WICG html-in-canvas / layoutsubtree mirror tiers; canary = tab order + one mirror-invocable action.
- O-G.2 EXECUTED: `WebClipboard` web-sys adapter (`src/wasm/clipboard.rs`, 104 lines; target-split shim `src/clipboard.rs`; 5 call sites swapped) behind the Clipboard trait, cfg-gated. **Both checks of the merged crate now GREEN**: native `cargo check -p theorem-ide-app` and wasm32 (S0 CC recipe) — this ALSO closes ws-merge's O-M.4 deferral. Three ws-merge carry-over defects repaired en route: missing resource dirs (extra/icons/defaults copied from fork, 4.8MB), wasm bin missing native main (E0601), getrandom 0.3 wasm32 backend (+wasm_js target dep).
- O-G.3 EXECUTED (PASS): keystroke → wire-delta measured on the merged bundle vs the real proxy (headed Chrome, S0-trap-aware script); n=8, median 9.90ms, p95 15.0ms, max 19.2ms — all inside the 32ms one-frame budget. Raw trace preserved at `wasm-serve/verify/shots/g0-keystroke/traces.json`.
- O-G.4 EXECUTED (FAIL at device-request, root-caused): GL fallback ladder climbed to completion. Control (WebGPU/Metal) renders + zero panics. `--disable-features=WebGPU` and `--disable-webgpu` are both no-ops in CfT 1234; `--disable-gpu` over-forces (kills WebGL2 too → AdapterNotFoundError panic). Page-level `navigator.gpu` shadow (the committed forcing method) proves the **GL backend engages** — but `request_device` fails: `max_compute_workgroups_per_dimension requested: 65535, allowed: 0` — floem requests default limits; WebGL2 has no compute. floem `unwrap()` panics at app_handle.rs:83:71; canvas unpainted. **WebGPU remains the only working web backend** (control PASS) — integration not blocked. Fix is a floem-side limit-policy change (floem is an upstream git dep) → charted as decision row D9, not wave-5 scope. Secondary findings: floem unwraps device errors on web (winit RefCell cascade panic); pixel-distinctness alone is a false-positive render oracle (canvas-region probe + no-panics gate required). Evidence: G0-VERIFY.md + `wasm-serve/verify/shots/g0-glfallback/`.
- O-G.5 EXECUTED: real-OS IME protocol written — CJK via macOS IME into the canvas; observe composition window → preedit underline → commit on the wire (`"method":"update"` frames) → zero panics; first MANUAL verify of the merged build; glyph check conditional on a CJK font (DejaVu gap recorded).

STATE: done (2026-08-10; O-G.1/O-G.2/O-G.5 executed, O-G.3 measured PASS, O-G.4 executed-FAIL root-caused → D9 decision row charted; app checks green). Evidence: `Theorem/docs/plans/intellij-absorption/G0-VERIFY.md`. Verify: parent v-ws-integration (pending ide-proxy-fold).
