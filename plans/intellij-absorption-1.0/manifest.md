# intellij-absorption-1.0 — manifest

Destination: Lapce fork spike (`s0`) proving the forked `lapce-app` workbench compiles for wasm32 and boots in a browser against a stub proxy; supersedes the r0 greenfield register per HANDOFF-LAPCE-FORK-SPIKE-1.0.
Fixpoint: every node's obligations discharged with replayable evidence; S0 report (compile matrix, cfg-gate table, bundle size, IME observation, verdicts) committed in `Theorem/docs/plans/intellij-absorption/S0-LAPCE-SPIKE.md`.

## Nodes (gist tier)

| id | kind | controller | gist | state |
|---|---|---|---|---|
| g0-island-probe | probe | agent | Browser probe of the workbench at fork pin; six-point acceptance (IME first, shaping, GL fallback, one-frame keystroke budget, copy/paste/scroll, a11y decision). Rescoped: target is the forked lapce-app in browser, not bare floem island. | superseded-by-s0 (rescope recorded) |
| s0-lapce-spike | work | agent | Hard-fork lapce/lapce at c9e4c339 into apps/theorem-ide; sever lapce-app from lapce-proxy; compile wasm32; boot in browser vs StubProxy. S0.1 PASS, S0.2 PASS, S0.3 PASS (2026-08-10). | done |
| v-s0 | verify | agent | Runs the declared proof commands for s0 (compile matrix rows M1-M3, headed-browser acceptance, evidence file) and gates. GATE PASSED 2026-08-10; verdicts S0.1/S0.2/S0.3 PASS; kill criteria not triggered. | done |
| p-l3 | probe | agent | K8 retargets onto Lapce's editor behavior layer; IdeaVim corpus map; K2/K5/K6 upgrade-decision probes. | done (2026-08-10; evidence P-L3-PROBE.md) |
| p-l3-exec | work | agent | Execute the K2/K5/K6 probes on the inherited Lapce behavior layer: matcher-gap fixtures, chord-semantics conformance, driver traces. Probes defined in P-L3-PROBE.md. | done (2026-08-11; K2 KEEP nucleo 84.9% register-relevant, K5 15/15 conformance, K6 rank 8/8 + typeahead PASS; evidence P-L3-EXEC.md) |
| token-kernel-binding | work | agent | floem Style-chain binding for the theorem-style kernel; CSS + Rust-constants dialects; light Lapce theme activation in the fork (bundled themes dir); kernel/binding unit tests. | done (2026-08-11; dialects css+rust with drift guard, light theme schema MATCH 165 keys, floem Style-chain binding + drift guards, user-data-dir activation; workspace tests 34/34) |
| console-host | work | agent | Console host consumes the wasm frontend (theorem-ide-app build artifact in the console surface). apps/console is under other-agent churn — weather. | charted (2026-08-10) |
| theorem-proxy | work | agent | WorkspaceBackend trait at dispatch.rs file layer; HostFs stock-preserving; AgentFs over AgentFsHost (handoff mapping table); LSP/PTY/git over fuse_host; fold into theorem binary at ws-integration. | done (2026-08-10; check + 14/14 tests; evidence THEOREM-PROXY.md) |
| v-theorem-proxy | verify | agent | Verify sibling for theorem-proxy: check green, mapping tests, evidence complete. | GATE PASSED 2026-08-10 |
| d7 | decision | agent | D7 single text algebra decision recorded + fleet manifest amendment row (ropey superseded by lapce-xi-rope, clause still satisfied). | done (2026-08-10) |
| d7m | work | agent | Text-model migration (shrink, not rewrite): re-back rustyred-thg-text-model on lapce-xi-rope; RopeDelta algebra; fixture suite is the gate; substrate-owned durable delta encoding. | done (2026-08-10; 16/16 tests) |
| v-d7m | verify | agent | Verify sibling for d7m: fixture suite green on xi-rope, encoding tests green, affinity decision recorded. | GATE PASSED 2026-08-10 |
| d8 | decision | agent | vfs/agentfs layering read + one-paragraph decision (under or beside agentfs for workspaces). | done (2026-08-10; BESIDE; consumed by theorem-proxy) |
| token-kernel | work | agent | Typed Space/Inset/Surface kernel (theorem-style, framework-free); Int UI theme crate binding; generated Lapce theme file; K1 token source seeded (int-ui-standalone home absent). | done (2026-08-10; schema MATCH 165 keys; evidence TOKEN-KERNEL.md) |
| v-token-kernel | verify | agent | Verify sibling for token-kernel: checks green, theme file valid against fork schema, provenance recorded. | GATE PASSED 2026-08-10 |
| ws-transport | work | agent | Websocket transport for RpcMessage/ProxyMessage: stdio.rs framing over ws; proxy serve_ws fronting Dispatcher; wasm web-sys client; browser smoke vs real proxy. | done (2026-08-10; smoke 5/5; evidence WS-TRANSPORT.md) |
| v-ws-transport | verify | agent | Verify sibling for ws-transport: native + wasm32 checks green, browser smoke recorded or named deferral. | GATE PASSED 2026-08-10 |
| ws-integration | work | agent | REFINED into ws-merge + ide-proxy-fold + g0-verify (+ v-ws-integration). Fork crates merge into rustyredcore_THG as theorem-ide-app/rpc/proxy/core; IDE proxy folds into theorem binary; g0 carry-forward verify items. | sealed (2026-08-10; children ws-merge + g0-verify done, ide-proxy-fold parked-weather, v-ws-integration gate PASS-with-deferral) |
| ws-merge | work | agent | Move+rename fork crates into rustyredcore_THG (theorem-ide-app/rpc/proxy/core); path deps; floem pin travels; fork pruned; wasm-serve re-pointed; register manifest + provenance records. | done (2026-08-10; checks + syntax tests green; app checks closed via g0-verify) |
| ide-proxy-fold | work | agent | theorem ide-proxy subcommand: CLI's store instance → AgentFsHost/HostFs → serve_ws; one store handle. Depends on ws-merge. | parked (weather: mcp tree unparseable + disk; code landed, check pending) |
| g0-verify | work | agent | g0 carry-forward items on the merged build: a11y decision, wasm Clipboard adapter, keystroke budget, GL fallback, real-OS IME protocol. Depends on ws-merge. | done (2026-08-10; O-G.1/2/5 executed, O-G.3 PASS median 9.9/p95 15.0ms, O-G.4 FAIL root-caused → d9-gl-fallback; app checks green) |
| d9-gl-fallback | decision | agent | GL fallback policy: the retry uses GLES-3.1 limits, not WebGL2-safe limits; a safe-limits live probe clears device creation but Vger requires vertex storage and TinySkia cannot reuse the WebGL-owned canvas. | done (2026-08-10; WebGPU required at floem 31fa8f44; future fallback is renderer architecture, not a limits patch) |
| v-ws-integration | verify | agent | Verify the integration wave: light checks, theorem-cli check, records, deferral protocols. | done (2026-08-10; GATE PASS-with-deferral: light checks green, theorem-cli check deferred on mcp-weather trigger) | |

## Edges

## Edges

start -> s0 (handoff: HANDOFF-LAPCE-FORK-SPIKE-1.0; board amendments 1-5) -> v-s0 -> g0-island-probe (rescoped acceptance) -> p-l3; s0 -> d7 -> d7m -> v-d7m; s0 -> d8; s0 -> theorem-proxy -> v-theorem-proxy; s0 -> token-kernel -> v-token-kernel; (theorem-proxy + d7m + token-kernel + ws-transport) -> ws-integration; g0-verify -> d9-gl-fallback -> terminal (decision sealed 2026-08-10: WebGPU required at current floem pin); ws-integration -> wave-6 chart (p-l3-exec, token-kernel-binding, console-host).

Post-gate wave claimed 2026-08-10 (per user: keep implementing the rest of the plan): p-l3, theorem-proxy, d7, d7m, d8, token-kernel claimed; verify siblings pending; ws-integration blocked on its dependencies.

## Budget clock

Sessions so far: 7 (through d9 decision closure). OOMs: 2 historical. Rechecked 2026-08-10 during d9: `/Volumes/SSD Samsung` has ~704Gi free; the system volume has ~4.8Gi free. Heavy builds must use an explicit SSD-backed `CARGO_TARGET_DIR` and `CARGO_BUILD_JOBS=4` max; do not follow the superseded system-disk instruction. The d9 probe used `/Volumes/SSD Samsung/theorem-builds/d9-gl-probe-target` successfully. Disk pressure is shared: clear only artifacts you own.

## Provenance

Fork: lapce/lapce @ c9e4c33948033f10f003991a037d949a708eedf8, Apache-2.0, NOTICE retained, fork-with-modifications; ledger `apps/theorem-ide/PROVENANCE.md`. floem pin 31fa8f444c37f4c314f47d88c23ffdbc25f2ab53 (Lapce's own). Re-verify note (board amendment 5): the k11 floem closure claim (`Rc<dyn Document>` seam) was taken at floem 778bb5f — CONFIRMED at Lapce's pin by the S0 spike (editor view working: buffer renders, cursor blink, typing lands; S0-LAPCE-SPIKE.md provenance notes).
