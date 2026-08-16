# s0-lapce-spike (occupied)

Fork home: `Theorem/apps/theorem-ide/lapce` (own cargo workspace; NOT in rustyredcore_THG yet). Pins: lapce/lapce @ c9e4c339, floem @ 31fa8f44. Toolchain: `cargo +1.96.1` always; wasm32 target on 1.96.1.

## Obligations (acceptance from HANDOFF-LAPCE-FORK-SPIKE-1.0)

| # | Obligation | Proof command | State |
|---|---|---|---|
| O-S0.1 | `lapce-app` builds without `local-proxy`; tree shows no lapce-proxy/wasmtime/git2 | `cargo +1.96.1 tree -p lapce-app -e normal --no-default-features --features vendored-fonts` | DISCHARGED — M2/M3 PASS; evidence table in S0 report |
| O-S0.2 | `lapce-app` compiles for wasm32-unknown-unknown with every native offender behind cfg/feature; gates documented in one table | `cargo +1.96.1 build -p lapce-app --target wasm32-unknown-unknown --no-default-features --features vendored-fonts` with env recipe in Constraints | DISCHARGED — M3 PASS (0 errors); cfg-gate table in S0 report |
| O-S0.3a | Workbench renders in a browser (file tree = stub tree, a buffer opens) | Headed Chrome (Playwright) vs wasm-serve; pixel/console acceptance | DISCHARGED — clean-build acceptance run 2026-08-10: lib.rs opens (click→OpenFile→BufferHead→init_content), zero panics, editor renders buffer text |
| O-S0.3b | Typing works in the editor | Headed Chrome; type after opening a file | DISCHARGED — clean-build run: editor text pixels 91→179 after typing "hello from s0.3" (TYPING PASS) |
| O-S0.3c | Palette opens | Headed Chrome Ctrl+Shift+P | DISCHARGED — palette opens and filters (bbox [150,33,648,267]; diffs 10721/1203 px) |
| O-S0.4 | IME observation recorded (not a gate) | Synthetic composition events + note | DISCHARGED — compose() with editor focused: events dispatch, no panic, no CJK glyph (DejaVu lacks CJK; synthetic events lack real IME context). Recorded in evidence file; real-IME verification deferred to theorem-proxy wave |
| O-S0.5 | Evidence file complete: compile matrix, cfg-gate table, diff summary, bundle size, IME observation, PASS/KILL verdicts | Read `S0-LAPCE-SPIKE.md`; every section filled | DISCHARGED — all sections filled; bundle size: debug bundle ~69MB measured, release+wasm-opt number measured at gate (see evidence) |
| O-S0.6 | Board states + continuity brief updated | Read board | DISCHARGED — this write |

## Scope

`Theorem/apps/theorem-ide/**` (fork + wasm-serve + verify harness). `Theorem/docs/plans/intellij-absorption/S0-LAPCE-SPIKE.md`. Board `CommonPlace/plans/intellij-absorption-1.0/`. NOT: lapce-proxy/lapce-rpc source, floem, other repos.

## Claim

Occupant: zed head (s0.3 session). Started: after gates 1+2. Scope: as declared. Time: multiple sessions; OOM'd twice.

## Work log (replay tail)

- S0.1 done: `local-proxy` feature; lapce-proxy dep optional; tree clean of proxy/wasmtime/git2. PASS.
- S0.2 done: cfg-gate table for interprocess, notify, reqwest, tempfile, tracing-appender, alacritty_terminal, open, tar/flate2/zstd, rayon, updater (killed), floem feature lever, getrandom js. M1/M2/M3 PASS. `window_tab.rs` duplicate-field fix; `app.rs` watcher hoist.
- S0.3 boot-fix chain (each was a runtime panic in headed Chrome, fixed by cfg/feature gate or shim):
  1. `SystemTime::now` on wasm32 → `web-time` shim (`crate::wasm::time`) wired into config.rs/db.rs/keypress.rs/window_tab.rs.
  2. `thread::spawn` at boot (PluginData::new "FindAllVolts") → all 7 plugin.rs spawn sites gated with wasm fallbacks + app.rs `create_signal_from_channel` replaced by `wasm::signal_from_channel`.
  3. Headless `AdapterNotFoundError` → wgpu `webgl` feature on wasm deps (unifies into floem-renderer's wgpu 24.0.5, pulls wgpu-core/gles + wgpu-hal/gles). Headed Chrome (real WebGPU) resolves it — boot proceeds past adapter.
- S0.3 current finding: winit-web's `EventLoop::run_app` intentionally throws ("Using exceptions for control flow…") to unwind the wasm stack; index.js catches it and logs "boot failed" — EXPECTED, not a failure. Loop is scheduled before the throw (`runner.start` → `init()` delivers NewEvents/CreateSurfaces synchronously, then rAF loop). Success signal = canvas painted + event loop alive, NOT the "booted" logline.
- S0.3 evidence so far (headed Chrome, canvas 800x600 default, never resizes — observation for report): workbench renders (editor #282c34, panels #21252b per dark-theme.toml: `$black=#282C34` editor.background, secondary-background #21252B panels), explorer LEFT with stub tree rows, status bar, tab strip, palette opens+filters. Canvas does NOT follow window resize (inline 800px style never updated — observation, not gate).
- S0.3 open bug: clicking a file row selects/hovers but NO buffer opens (editor region stays text-free). Palette unaffected (no deadlock). Stub handles NewBuffer/ReadDir/etc. `file_explorer_double_click` defaults false → single click fires InternalCommand::OpenFile → `main_split.jump_to_location`. Diagnosis: instrumented stub (web_sys console logs of req/notif/resp) — build done 2m13s, bundle regenerated; next step: rerun acceptance and READ THE TRAFFIC.
- S0.3 open bug RESOLVED (2026-08-10 session). Three stacked root causes:
  1. Automation artifact, not app bug: Playwright clicks at x=80 missed the tree's clickable column (x≈35–45); earlier clicks only ever hit the `/stub` root row (dir → toggle_expand, no proxy traffic). Pixel-scan-driven row map (screenshots → row bands → click x=40) reached real file rows: full chain `on_click_stop` → `data.click` → `OpenFile` → `BufferHead` → `init_content` fired.
  2. Font panic #1: floem FONT_SYSTEM sets sans_serif_family("Noto Sans") on non-mac/win; browser has no system fonts → every generic SansSerif query missed → cosmic-text "no default font found" panic on first UI text shape. Fix (wasm-only, launch_wasm vendored block): `set_sans_serif_family("DejaVu Sans")` + `set_monospace_family("DejaVu Sans Mono")`. Evidence: faces=2, query(mono)/query(sans) = Some.
  3. Font panic #2: file-explorer unconfirmed rows render italic (`FontStyle::Italic`); no italic face in db → attrs.matches (style equality) excluded all faces → fallback exhausted. Panic captured via temp cosmic-text patch: `family=SansSerif style=Italic word="lib.rs"`. Fix: vendored DejaVuSans-Oblique.ttf + DejaVuSansMono-Oblique.ttf (DejaVu 2.37, Vera license) into extra/fonts/DejaVu/. Evidence: faces=4, italic face present.
  4. Instrumentation trap (recorded for next head): edits to dependency sources (floem checkout, cosmic-text registry copy, lapce-rpc) are NOT picked up by cargo 1.96 fingerprinting — full `rm -rf` of the wasm32 target + clean rebuild required before patches take effect. Also: verification scripts must DUMP ALL console lines; open5.js's filtered prints hid working logs for hours.
- Final clean-build acceptance (instrumentation stripped): opened lib.rs, init_content fired, 0 panics, editor text 91→179 px after typing, palette functional. Evidence: `wasm-serve/verify/accept-final.js`, `dumpall.js`, `af-*.png`, `da-final.png`.
- Post-gate (unchanged): floem pin seam re-verify recorded (holds at 31fa8f4 — editor view works at Lapce's pin), D7/D8 rows, theorem-proxy, token kernel, ws integration.

## Verify sibling

v-s0 (see nodes/v-s0.md).

## Evidence

`Theorem/docs/plans/intellij-absorption/S0-LAPCE-SPIKE.md` — complete: matrix M1–M3 PASS, cfg-gate table, diff summary, blocker register, bundle size (debug ~69MB measured; release+wasm-opt at gate), IME observation, S0.3 diagnosis log, PASS/PASS/PASS verdicts, floem-pin seam re-verify note. Verifier harness preserved in `apps/theorem-ide/lapce/wasm-serve/verify/`.
