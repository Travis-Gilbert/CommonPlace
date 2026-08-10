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
