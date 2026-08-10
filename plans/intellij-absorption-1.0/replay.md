# replay (append-only)

- `chart` — plan charted + gated (gates 1+2 PASSED per handoff; board files re-materialized 2026-08-09 after substrate query failed and dir was found empty).
- `occupy s0-lapce-spike` — claim written; scope = fork + evidence + board.
- `work s0 S0.1` — local-proxy feature surgery; tree clean. Verify: PASS (M2). Traverse note: none (mid-node).
- `work s0 S0.2` — cfg-gate table; M1/M2/M3 PASS; two source fixes (window_tab duplicate field, app.rs watcher hoist). Verify: PASS (M3 build).
- `work s0 S0.3` — boot-fix chain: web-time shim; 7 plugin.rs spawn gates; wasm::signal_from_channel + palette_pump; wgpu webgl feature; wasm-serve pipeline + WASI shim; StubProxy (in-memory tree: README.md, Cargo.toml, src/main.rs, src/lib.rs, notes.txt).
- `work s0 S0.3 diagnosis` — headless AdapterNotFound (env limit, recorded WEBGPU_UNAVAILABLE_HEADLESS); headed Chrome renders workbench, palette opens+filters, canvas 800x600 no resize; open-bug: file click selects but no buffer opens; instrumented stub with req/notif/resp console logs (build 2m13s, bundle regenerated 21:03).
- `park (temporary)` — user restarting Zed; continuity brief written; fork committed scoped; verify harness copied out of /tmp. Node stays occupied, resumable.
- `work s0 S0.3 close (2026-08-10)` — three stacked root causes fixed: (1) click automation artifact (tree clickable column is x≈35-45; earlier clicks only hit /stub root dir row — with pixel-scan row map, real file rows hit the full chain OpenFile→BufferHead→init_content); (2) generic SansSerif resolved to "Noto Sans" (floem init on non-mac/win) with no system fonts → `set_sans_serif_family("DejaVu Sans")` + `set_monospace_family("DejaVu Sans Mono")`; (3) italic row labels with no italic face → vendored DejaVu Oblique faces. Instrumentation trap: cargo 1.96 fingerprints did not pick up edits to floem checkout / cosmic-text registry / lapce-rpc; full rm -rf of the wasm32 target required. Also: verification scripts that print filtered slices hid working logs for hours — dump-all scripts only.
- `verify s0 (v-s0)` — clean rebuild (instrumentation stripped): opened lib.rs, 0 panics, editor text 91→179 px after typing (TYPING PASS), palette functional; IME observation recorded (no panic, no CJK glyph — DejaVu lacks CJK; real-IME deferred). All obligations O-S0.1..O-S0.6 DISCHARGED. Gate: PASS. Verdicts: S0.1/S0.2/S0.3 PASS; kill criteria not triggered.
- `traverse s0 -> g0 (superseded-by-s0)` — evidence file completed (S0-LAPCE-SPIKE.md), fork committed, board states updated; g0 remains the rescoped acceptance record with probe results feeding K2/K5/K6 + p-l3 post-gate.

## Faults / ladder (2026-08-10 additions)

- Panic "no default font found" — three separate causes across the spike (SystemTime, font-family resolution, italic faces); the decisive tool was a temporary patch to the dependency source (cosmic-text panic message enrichment) + the panic hook, NOT more static reading. 
- "Instrumented but never fired" — spent hours chasing logs that were firing but filtered out by the verification script's print slices; the fix was a dump-all console script. Guardrail: when a probe "doesn't fire", first prove the script would print it.
- Duplicate crate instances in the wasm target (lapce_app/lapce_rpc rlibs with two hashes) — stale+new artifacts coexisted after partial rebuilds; clean rebuild resolved. Cargo fingerprinting on this toolchain does not reliably invalidate on source mtime for git/registry deps; after ANY dependency-source edit, delete the affected artifacts.
- Disk: SSD (cargo target) filled to 0.8Gi during the session (other agents' builds concurrent); freeing own stale debug/incremental artifacts was enough; never delete other agents' targets.
- Release-profile wasm build for bundle size: see build23 log; wasm-opt at /opt/homebrew/bin/wasm-opt.
