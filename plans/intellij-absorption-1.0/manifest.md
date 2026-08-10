# intellij-absorption-1.0 — manifest

Destination: Lapce fork spike (`s0`) proving the forked `lapce-app` workbench compiles for wasm32 and boots in a browser against a stub proxy; supersedes the r0 greenfield register per HANDOFF-LAPCE-FORK-SPIKE-1.0.
Fixpoint: every node's obligations discharged with replayable evidence; S0 report (compile matrix, cfg-gate table, bundle size, IME observation, verdicts) committed in `Theorem/docs/plans/intellij-absorption/S0-LAPCE-SPIKE.md`.

## Nodes (gist tier)

| id | kind | controller | gist | state |
|---|---|---|---|---|
| g0-island-probe | probe | agent | Browser probe of the workbench at fork pin; six-point acceptance (IME first, shaping, GL fallback, one-frame keystroke budget, copy/paste/scroll, a11y decision). Rescoped: target is the forked lapce-app in browser, not bare floem island. | superseded-by-s0 (rescope recorded) |
| s0-lapce-spike | work | agent | Hard-fork lapce/lapce at c9e4c339 into apps/theorem-ide; sever lapce-app from lapce-proxy; compile wasm32; boot in browser vs StubProxy. S0.1 PASS, S0.2 PASS, S0.3 OPEN. | occupied |
| v-s0 | verify | agent | Runs the declared proof commands for s0 (compile matrix rows M1-M3, headed-browser acceptance, evidence file) and gates. | pending |
| p-l3 | probe | agent | K8 retargets onto Lapce's editor behavior layer (post-gate). | pending |
| theorem-proxy | work | agent | Fork lapce-proxy; WorkspaceBackend trait; AgentFs impl over AgentFsHost; fold into theorem binary (post-gate). | pending |
| d7 | decision | agent | Single text algebra: rustyred-thg-text-model re-backs on lapce-xi-rope; RopeDelta is wire/compute/rebase algebra; substrate owns durable delta encoding (post-gate). | pending |
| d8 | decision | agent | vfs/agentfs layering read + one-paragraph decision (post-gate). | pending |
| token-kernel | work | agent | Typed Space/Inset/Surface kernel; Int UI theme crate binding; generated Lapce theme file (post-gate). | pending |
| ws-integration | work | agent | Fork crates merge into rustyredcore_THG workspace as theorem-ide-app/rpc/proxy (post-gate). | pending |

## Edges

start -> s0 (handoff: HANDOFF-LAPCE-FORK-SPIKE-1.0; board amendments 1-5) -> v-s0 -> g0-island-probe (rescoped acceptance) -> p-l3; post-gate: theorem-proxy, d7, d8, token-kernel, ws-integration (chart as nodes; not executed in this wave).

## Budget clock

Sessions so far: 3+ (charting, S0.1/S0.2, S0.3 diagnosis). OOMs: 2 (both cargo target-volume on /Volumes/SSD Samsung; keep 20Gi+ free during builds).

## Provenance

Fork: lapce/lapce @ c9e4c33948033f10f003991a037d949a708eedf8, Apache-2.0, NOTICE retained, fork-with-modifications; ledger `apps/theorem-ide/PROVENANCE.md`. floem pin 31fa8f444c37f4c314f47d88c23ffdbc25f2ab53 (Lapce's own). Re-verify note (board amendment 5): the k11 floem closure claim (`Rc<dyn Document>` seam) was taken at floem 778bb5f; confirm at Lapce's pin — recorded as an open verification in S0 report.
