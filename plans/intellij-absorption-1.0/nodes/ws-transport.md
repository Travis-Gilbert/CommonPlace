# ws-transport — websocket transport for ProxyMessage (work)

- kind: work
- controller: agent
- gist: New websocket transport for `RpcMessage`/`ProxyMessage` between the wasm frontend and the IDE proxy: reuse `stdio.rs`'s framing over a ws channel; the proxy gains a `serve_ws` listener fronting `Dispatcher` (the WorkspaceBackend seam from theorem-proxy); lapce-rpc gains a client transport with native + wasm backends; the wasm frontend connects to `ws://host:port` instead of the in-page StubProxy; browser smoke against the real proxy.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 post-gate item 2; prerequisite of ws-integration (O-WS.3).

## Blueprint (grounded in reads of the fork)

Architecture as read (2026-08-10):
- `lapce-rpc/src/stdio.rs` — transport-agnostic JSON framing: `stdio_transport(writer, writer_receiver, reader, reader_sender)` + `write_msg`/`read_msg` over any `Write`/`BufRead`. THE reusable seam.
- `lapce-rpc/src/proxy.rs` — `ProxyRpcHandler` (channel-based, `request` blocks on `rx.recv()` — the S0.3 wasm deadlock trap; `request_async` exists and is the wasm-mandatory path).
- `lapce-app/src/proxy.rs::new_proxy` — `LapceWorkspaceType::Local` runs `Dispatcher::mainloop` in-process (behind the `local-proxy` feature). No network transport anywhere.
- `lapce-proxy` — dispatcher crate; theorem-proxy stage added `backend/` (WorkspaceBackend seam) + feature `agentfs`.

Required work:
1. **Inventory** (evidence paragraph): no upstream network transport; framing reuse; where each side plugs in (file refs).
2. **Transport module** in `lapce-rpc` (`ws.rs`): mirror `stdio.rs` framing over a ws channel; two backends behind cfg/features — native (tungstenite) and wasm (`web-sys` WebSocket; `cfg(target_arch = "wasm32")`). No blocking `rx.recv()` on the wasm main thread — callbacks/`request_async` only.
3. **Proxy server**: `lapce-proxy` gains a `serve_ws` mode (binary or lib entry): listener → per-connection `Dispatcher` loop (same mainloop pattern) with the WorkspaceBackend seam — this IS the theorem-proxy service surface. Native-only deps (tungstenite) — no wasm impact on the proxy.
4. **Wasm client wiring**: the wasm frontend's proxy connection switches from the in-page StubProxy to a ws client (StubProxy stays behind a feature as fallback). Verify the S0.3 async discipline holds.
5. **Browser smoke (the first end-to-end browser↔real-proxy test)**: run the native proxy with `serve_ws` (HostFs default, a small temp workspace), boot the wasm frontend in headed Chrome pointed at `ws://localhost:PORT`, verify: real-FS tree renders, buffer opens, typing lands, palette opens. Reuse the fork's verify harness (`wasm-serve/verify/` — dump-all console scripts).

## Obligations

- O-WT.1: transport inventory recorded (no network transport upstream; stdio.rs framing reused; S0.3 async trap honored). Proof: evidence paragraph with file refs.
- O-WT.2: `ws` transport in lapce-rpc + `serve_ws` in lapce-proxy fronting Dispatcher. Proof: `cargo +1.96.1 check -p lapce-rpc -p lapce-proxy` green.
- O-WT.3: wasm client wired (web-sys WebSocket; request_async-only on the wasm main thread). Proof: `cargo +1.96.1 check -p lapce-app --target wasm32-unknown-unknown` (no-default-features, the S0 recipe) green.
- O-WT.4: browser↔proxy smoke recorded (tree/buffer/typing/palette) OR an explicit named deferral with reason. Proof: harness output in evidence.

## Scope

Writes: fork only — `lapce-rpc/` (ws.rs + Cargo.toml deps), `lapce-proxy/` (serve_ws + Cargo.toml), `lapce-app/` (client wiring + features), `wasm-serve/` (page/glue + verify scripts). Evidence: `Theorem/docs/plans/intellij-absorption/WS-TRANSPORT.md`. Do NOT touch: rustyredcore_THG, the board, other apps.

## Environment (MANDATORY — machine OOM'd twice; system disk has ~16Gi free)

- `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target`
- `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home`
- `cargo +1.96.1`; `cargo check` everywhere; wasm32 full build ONLY for the smoke (needs the S0 env recipe: `CC_wasm32_unknown_unknown="/opt/homebrew/opt/llvm/bin/clang --sysroot=/tmp/wasi-sysroot"`, `CFLAGS_wasm32_unknown_unknown="-Wno-implicit-function-declaration"`, `RUSTFLAGS="-C link-arg=-L/tmp/wasi-sysroot/lib -C link-arg=-lc -C link-arg=--allow-undefined"`). Before a full wasm build, delete stale `wasm32-unknown-unknown` artifacts under the target dir to hold disk. Never touch the SSD target.
- After ANY dependency-source edit, `rm -rf` the affected wasm32 target artifacts (cargo 1.96 fingerprinting misses dep edits).
- No `git add -A` (fork has wasm-serve artifacts); leave the tree for the head.

## Acceptance

O-WT.1–4 discharged; smoke passed or deferred with a named reason.

## Discharge (2026-08-10)

- O-WT.1 DISCHARGED: inventory recorded — no network transport upstream; `stdio.rs` framing is the seam (byte-identical envelopes via shared `msg_to_json_value`/`parse_value`); local mode is an in-process Dispatcher behind `local-proxy`; wasm used the in-page StubProxy; `request_async` is the wasm-mandatory path.
- O-WT.2 DISCHARGED: `lapce-rpc/src/ws.rs` (encode/decode + native `connect`/`accept`/`ws_transport` — tungstenite 0.24, one driver thread polling non-blocking socket at 5ms — and wasm `WasmWsClient` via web-sys WebSocket with outbound buffering until onopen); `lapce-proxy/src/lib.rs::serve_ws(addr)` + CLI `--serve-ws 127.0.0.1:PORT` fronting a fresh Core/Proxy/Dispatcher trio per connection (the theorem-proxy service surface over the WorkspaceBackend seam). Proof: native check green (re-run by verify head).
- O-WT.3 DISCHARGED: `lapce-app/src/wasm/ws_proxy.rs` — `launch_wasm` behind `ws-proxy` feature; timer pumps; request_async-only; StubProxy stays as fallback. Proof: wasm32 check green (re-run by verify head, with the S0 CC recipe).
- O-WT.4 DISCHARGED — SMOKE PASS 5/5 (first end-to-end browser↔real-proxy run in the program): proxy `--serve-ws 127.0.0.1:19414` on `/tmp/lapce-ws-smoke` (HostFs); bundle served at :8766; headed Chrome; console evidence: `[ws] connected`, ReadDir with real entries (nested notes/), `NewBufferResponse` with real file bytes, typing `Notification Update { delta: Delta(<ins:1> [0,13) base_len: 13), rev: 2 }` on the wire, palette 10 rows; screenshots `wasm-serve/verify/shots/ws/`. Known cosmetic: editor viewport paints dark (S0.3 quirk — buffer/typing proven on the wire).
- Environment note: release wasm bundle 18.9 MB (wasm-opt -Oz); wasm-bindgen-cli 0.2.108 installed machine-locally into `.cargo-home/bin` (global 0.2.127 has a schema mismatch with the lockfile pin).

STATE: done. Verify sibling: v-ws-transport (gate PASSED 2026-08-10). Evidence: `Theorem/docs/plans/intellij-absorption/WS-TRANSPORT.md`.
