# v-theorem-proxy — verify WorkspaceBackend/AgentFs (verify)

- kind: verify
- controller: agent
- gist: Runs the declared proof commands for theorem-proxy and gates: check green, mapping tests green, stock behavior preserved, evidence complete.

## Proof commands

- `cargo +1.96.1 check -p lapce-proxy` (with CARGO_TARGET_DIR override, run in the fork).
- `cargo +1.96.1 test` for the mapping tests (proxy or backend crate).
- Inspect: dispatch.rs seam (trait at file layer), HostFs diff preserves stock behavior, evidence file `Theorem/docs/plans/intellij-absorption/THEOREM-PROXY.md` contains mapping table results, name-collision note, FUSE wiring + measurement decisions.

## Gate

PASS only when: check + tests green, HostFs path unchanged in behavior, evidence complete, no scope violations (lapce-app/wasm-serve/substrate other crates untouched).

## Gate record (2026-08-10) — PASSED

Verify head re-ran: `cargo +1.96.1 check -p lapce-proxy -j 4` → Finished dev profile clean (1m26s cold); `cargo test -p lapce-proxy --features agentfs backend::` → **14 passed; 0 failed** (4 HostFs parity + 10 AgentFs mapping). Tree inspected: only `lapce-proxy/**` + Cargo.lock modified, `backend/` new, themes/ untracked pre-existing + theorem-int-ui.toml (token-kernel's, allowed). Evidence `THEOREM-PROXY.md` complete (mapping table, 3 decision paragraphs, cfg-gate table, CARGO_HOME note). Scope: lapce-app/wasm-serve/substrate-other untouched. GATE: PASS.
