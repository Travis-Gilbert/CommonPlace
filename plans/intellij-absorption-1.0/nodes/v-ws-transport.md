# v-ws-transport — verify websocket transport (verify)

- kind: verify
- controller: agent
- gist: Runs the declared proof commands for ws-transport and gates: native checks green, wasm32 check green, browser↔proxy smoke recorded or named deferral, evidence complete.

## Proof commands

- `cargo +1.96.1 check -p lapce-rpc -p lapce-proxy` (native, CARGO_TARGET_DIR/CARGO_HOME overrides, in the fork).
- `cargo +1.96.1 check -p lapce-app --target wasm32-unknown-unknown --no-default-features --features vendored-fonts` (the S0 recipe minus the wasi env — check only needs the target; include the env if the build demands it).
- Browser smoke: proxy `serve_ws` on a temp workspace + headed-Chrome verify harness (dump-all console) — tree, buffer, typing, palette.
- Inspect: ws.rs framing mirrors stdio.rs; no blocking recv on wasm main thread; StubProxy feature-gated; evidence `WS-TRANSPORT.md` complete.

## Gate

PASS only when: both checks green, smoke recorded (pass or named deferral), evidence complete, no scope violations.

## Gate record (2026-08-10) — PASSED

Verify head re-ran: `cargo +1.96.1 check -p lapce-rpc -p lapce-proxy` → Finished (0.80s warm); `cargo +1.96.1 check -p lapce-app --target wasm32-unknown-unknown --no-default-features --features vendored-fonts,ws-proxy` → Finished (28.06s) — note: the S0 CC recipe is REQUIRED even for check (tree-sitter's C build script needs `CC_wasm32_unknown_unknown="clang --sysroot=/tmp/wasi-sysroot"`; omitting it fails with stdio.h not found). Smoke: 5/5 PASS recorded in WS-TRANSPORT.md (ws connected; real-FS ReadDir; NewBuffer with real bytes; typing `Update { delta, rev }` on the wire; palette 10 rows). Scope: fork only (lapce-rpc/ws.rs + proxy serve_ws + app ws_proxy.rs + wasm-serve). Evidence complete. GATE: PASS.
