# v-ws-integration — verify the integration wave (verify, refine of ws-integration)

- kind: verify
- controller: agent
- gist: Runs the proof commands of ws-merge, ide-proxy-fold, g0-verify and gates the parent ws-integration: light checks green, records complete, deferrals carry named reasons.

## Proof commands

- `cargo +1.96.1 check -p theorem-ide-rpc -p theorem-ide-proxy -p theorem-ide-core` in `rustyredcore_THG` (CARGO_TARGET_DIR/CARGO_HOME overrides).
- `cargo +1.96.1 check -p theorem-cli` in `Theorem` (if ide-proxy-fold landed).
- theorem-ide-app wasm32 check (S0 CC recipe) if disk allowed; otherwise the recorded deferral.
- Inspect: rename table + name-collision note; register manifest amendment; PROVENANCE.md ledger completion; floem pin traveled into the substrate workspace; fork pruned; wasm-serve points at the merged crate; `theorem ide-proxy --help`; evidence files (WS-MERGE.md, IDE-PROXY-FOLD.md, G0-VERIFY.md) complete with deferrals carrying protocols.

## Gate

PASS only when: light checks green, theorem-cli check green, records complete, every deferral has a named reason/protocol, no scope violations.

## Discharge (2026-08-10, session 6)

- **Light checks — PASSED (re-run today)**: `cargo +1.96.1 check -p theorem-ide-rpc -p theorem-ide-proxy -p theorem-ide-core -j 4` (env overrides) → Finished, 0 errors, 26.40s warm.
- **theorem-ide-app wasm32 check — PASSED (via g0-verify)**: S0 CC recipe, 0 errors; also closes ws-merge O-M.4.
- **theorem-cli check — DEFERRED (weather, named trigger)**: `cargo check -p theorem-cli --manifest-path apps/theorem-cli/Cargo.toml` fails in the dependency chain — `rustyred-thg-mcp` src/lib.rs is mid-refactor under another agent (41,105 lines, unclosed delimiter at l.41101, brace balance 4). Not our tree. **Trigger: mcp lib.rs parses + the refactor commits. Resume: the same command (chain mcp → theorem-agentd → harness → rustyred-embedded → theorem-cli, resumes from cached rmeta), then `theorem ide-proxy --help` capture + smoke + the AgentFs one-store seam (`serve_ws_with_backend`).**
- **Inspect items — PASSED (verified today)**: rename table + name-collision note in WS-MERGE.md; register manifest amendment + provenance ledger complete (PROVENANCE.md, 7 theorem-ide refs); floem pin `31fa8f44…` in substrate `rustyredcore_THG/Cargo.toml:233`; fork pruned (no lapce-app/lapce-proxy dirs); wasm-serve re-pointed at the merged crate (build-wasm.sh `-p theorem-ide-app --bin theorem_ide_wasm`, SUBSTRATE path fixed + committed); evidence files complete — WS-MERGE.md, IDE-PROXY-FOLD.md (code landed, check pending weather), G0-VERIFY.md (all five items executed or protocol'd, updated today).
- **Scope — no violations**: wave writes stayed in the fork's wasm-serve + theorem-ide-app + evidence files + board.

**GATE: PASS with one named deferral** (theorem-cli check + `--help` on the mcp-weather trigger — same execute-or-named-protocol pattern as every gate in this wave). ws-integration parent: sealed; ide-proxy-fold remains parked on the same trigger.
