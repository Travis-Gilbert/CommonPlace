# p-l3-exec — Execute the K2/K5/K6 upgrade-decision probes (work)

- kind: work
- controller: agent
- gist: Execute the K2/K5/K6 probes on the inherited Lapce behavior layer: matcher-gap fixtures (nucleo), chord-semantics conformance (keypress.rs), palette driver ranking traces (browser). Probes defined in `Theorem/docs/plans/intellij-absorption/P-L3-PROBE.md` §3.
- provenance: wave-6 chart (2026-08-10) from sealed ws-integration; probe definitions from sealed p-l3.

## Blueprint

1. K2: run the transpiled IntelliJ `NameUtilMatchingTest` fixture set through the inherited matcher (nucleo 0.5, app config) via a thin probe crate; decide KEEP vs upgrade from the pass rate + gap table.
2. K5: conformance tests driving `KeyMapLoader`/`match_keymap` directly (chords, prefix semantics, mods normalization, count-vs-chord collision, when-gating, timeout table); decide KEEP vs upgrade.
3. K6: browser driver traces via theorem-browser against the merged wasm bundle + real proxy: rank-order identity vs an offline oracle + per-keystroke typeahead; decide KEEP vs upgrade.

## Obligations

- O-PE.1: K2 fixture run executed with a captured gap table; KEEP/upgrade verdict recorded with decision evidence. Proof: `Theorem/docs/plans/intellij-absorption/P-L3-EXEC.md` §K2.
- O-PE.2: K5 chord-semantics conformance tests green on the merged crate; timeout + collision findings recorded; KEEP/upgrade verdict. Proof: `cargo test -p theorem-ide-app --lib keypress` output + P-L3-EXEC.md §K5.
- O-PE.3: K6 driver traces (rank identity + typeahead) captured in the browser against the live proxy; KEEP/upgrade verdict. Proof: `wasm-serve/verify/p-l3-k6.js` run output + P-L3-EXEC.md §K6.

## Scope

Writes: the k2-probe crate (`apps/theorem-ide/k2-probe`, incl. `src/bin/palette_oracle.rs`), the K5 test module in `rustyredcore_THG/crates/theorem-ide-app/src/keypress.rs`, the K6 probe `lapce/wasm-serve/verify/p-l3-k6.js`, evidence `Theorem/docs/plans/intellij-absorption/P-L3-EXEC.md`, board records. Never touches the parallel agent's untracked `ide-absorb-*` crates or the mcp tree.

## Acceptance

All three obligations discharged with replayable proof; verdicts recorded; wave-6 node sealed with handoff to the board.

## Work log (2026-08-11)

- `occupy` — claimed; scoped as above.
- `work K2` — probe crate complete (fixtures.rs 269 lines transpiled from `~/Tech Dev Local/oracle/intellij-community` NameUtilMatchingTest; main.rs runs the app's exact matcher config). Run captured: raw 174/258 (67.4%); register-relevant 157/185 (84.9%); gap tables captured; verdict KEEP nucleo.
- `work K5` — read the merged keypress.rs (717 lines) + loader; wrote 12 conformance tests (hermetic loader over real defaults + fixture TOML; `()` and `TestFocus` fakes). First run: 3 failures, all real findings (`x` is bound → delete_forward; `0` is bound → line_start; z-command names center/top/bottom_of_window) — tests corrected to assert inherited truth. Final: **15/15 green** (12 new + 3 pre-existing). Two build fixes (SmolStr `.into()`, `KeyCode::Space` placeholder — winit pin lacks `Unidentified`).
- `work K6` — fixture workspace `/tmp/lapce-k6-ws` (22 files); offline oracle `palette_oracle` (exact filter_items replication); proxy restarted on 19414 over the fixture; probe `p-l3-k6.js` run twice. Rank identity **8/8** (Enter → NewBuffer paths == oracle top1); typeahead per-keystroke re-filter proven; count parity 4/9 exact with the rest ±1-2 (pixel-scan limitation + one >350ms final-keystroke render lag observed). Verdict KEEP.
- Repair ladder: K6 top1 "failures" were a regex bug in the probe (`path` follows `buffer_id` in the debug print) — fixed in the committed script; count "failures" were scanner artifacts — re-analyzed with band scans, documented as measurement limitation.

## Discharge (2026-08-11)

- O-PE.1 DISCHARGED — K2 run output (258 fixtures, 67.4% raw / 84.9% register-relevant, over/under tables, canonical gap table) captured into P-L3-EXEC.md §K2; verdict KEEP nucleo with the fixture set as upgrade seed. Proof: probe stdout in evidence; crate committed at `apps/theorem-ide/k2-probe`.
- O-PE.2 DISCHARGED — `cargo +1.96.1 test -p theorem-ide-app --lib keypress` → `test result: ok. 15 passed; 0 failed` (SSD target `theorem-builds/k5-target`, CARGO_HOME `.cargo-home`). Findings: all common-default chords are modal-gated and dropped in the default non-modal config (falsifies the pre-probe assumption); macOS meta+k chords survive non-modal; count/keymap collision on `0` resolved by the n==0 rule; timeout fixed 1000ms. Verdict KEEP. Proof: test output + P-L3-EXEC.md §K5.
- O-PE.3 DISCHARGED — `node verify/p-l3-k6.js` run 2x against live proxy; rank identity 8/8 via wire NewBuffer paths; typeahead traces monotonic per keystroke; verdict KEEP with the oracle pair as the upgrade seed. Proof: `/tmp/k6-verify/` (run.log, console.log, screenshots; shots copied to `evidence/p-l3-exec/`) + P-L3-EXEC.md §K6.

STATE: done. Gate: PASS (all obligations discharged, 2026-08-11).
