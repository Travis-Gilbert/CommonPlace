# replay (append-only)

- `chart` — plan charted + gated (gates 1+2 PASSED per handoff; board files re-materialized 2026-08-09 after substrate query failed and dir was found empty).
- `occupy s0-lapce-spike` — claim written; scope = fork + evidence + board.
- `work s0 S0.1` — local-proxy feature surgery; tree clean. Verify: PASS (M2). Traverse note: none (mid-node).
- `work s0 S0.2` — cfg-gate table; M1/M2/M3 PASS; two source fixes (window_tab duplicate field, app.rs watcher hoist). Verify: PASS (M3 build).
- `work s0 S0.3` — boot-fix chain: web-time shim; 7 plugin.rs spawn gates; wasm::signal_from_channel + palette_pump; wgpu webgl feature; wasm-serve pipeline + WASI shim; StubProxy (in-memory tree: README.md, Cargo.toml, src/main.rs, src/lib.rs, notes.txt).
- `work s0 S0.3 diagnosis` — headless AdapterNotFound (env limit, recorded WEBGPU_UNAVAILABLE_HEADLESS); headed Chrome renders workbench, palette opens+filters, canvas 800x600 no resize; open-bug: file click selects but no buffer opens; instrumented stub with req/notif/resp console logs (build 2m13s, bundle regenerated 21:03).
- `park (temporary)` — user restarting Zed; continuity brief written; fork committed scoped; verify harness copied out of /tmp. Node stays occupied, resumable.

## Faults / ladder

- OOM x2 (cargo target volume on /Volumes/SSD Samsung) — rung: read record → clean stale artifacts (incremental dirs, lapce-chrome-app, wasm-dev) → 38Gi free. Also purged ~/.cargo registry web-time cache (re-fetch) and /tmp/ms-playwright (reinstall).
- `RuntimeError: unreachable` = panic-abort; use debug build + console_error_panic_hook, symbolicate with llvm-nm if needed.
- cargo 1.96 rejects underscore dep keys (web-time).
- E0428 duplicate `err` in stub_proxy.rs from a bad python patch — fixed (dedupe).
