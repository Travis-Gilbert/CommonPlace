# ws-merge — fork crates into the substrate workspace (work, refine of ws-integration)

- kind: work
- controller: agent
- gist: Move + rename the fork's four crates into `rustyredcore_THG` as `theorem-ide-app`/`theorem-ide-rpc`/`theorem-ide-proxy`/`theorem-ide-core` with path deps; prune the fork workspace; point wasm-serve at the merged crate; register manifest amendment + provenance ledger completion; checks green for the light crates.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 post-gate item 5; parent: ws-integration (O-WS.1).

## Blueprint

Fork workspace members (verified): `lapce-app`, `lapce-proxy`, `lapce-rpc`, `lapce-core` (the last is a ~13-line re-export of floem_editor_core — merges as `theorem-ide-core`; deviation from the handoff's three-crate list recorded with reason: theorem-ide-app depends on it, and it must be a workspace member for the path dep to be clean).

1. **Move + rename**: to `rustyredcore_THG/crates/` as `theorem-ide-rpc`, `theorem-ide-proxy`, `theorem-ide-app`, `theorem-ide-core`. Package names + internal `use lapce_rpc::`/`lapce_proxy::`/`lapce_app::`/`lapce_core::` references swept across the four crates. Keep the `local-proxy` and `agentfs` features working.
2. **Workspace membership**: add the four crates to the rustyredcore_THG root `Cargo.toml` `[workspace]` members. Path deps: the existing `agentfs` feature's path dep on `rustyred-thg-agentfs` becomes a sibling member; declare `rustyred-thg-text-model` as a path dep where the merged crates actually consume it (record as remains if nothing consumes it yet — do NOT add unused deps).
3. **The floem pin travels**: the fork's `[patch]` / floem git pin (31fa8f444c37f4c314f47d88c23ffdbc25f2ab53) and any other patches MUST move into the substrate workspace's Cargo.toml with the app — the wasm frontend's rendering depends on it.
4. **Prune the fork**: remove the four crates from the fork workspace members; fork keeps wasm-serve, defaults, extra/fonts, verify harness, docs. Fork Cargo.lock regenerates.
5. **wasm-serve points at the merged crate**: build-wasm.sh + index.js build `-p theorem-ide-app` from rustyredcore_THG (bin rename included; wasm bin keeps working through the merged crate).
6. **Records**: register manifest amendment (the IDE register lane in `Theorem/docs/CLOSURE-MANIFEST-SKELETON-INTELLIJ-ABSORPTION-1.0.md` — record the fork-crates-merge + renames + name-collision resolution `theorem-ide-proxy`); provenance ledger completion (`apps/theorem-ide/PROVENANCE.md` — merged crates' provenance: upstream lapce SHA c9e4c339 + fork commits 96ba5b8/17ef8dd, Apache-2.0, NOTICE retained).
7. **Name-collision resolution (O-TP.5)**: the merged IDE proxy is `theorem-ide-proxy` (not `theorem-proxy`) — the model-path proxy `apps/theorem-proxy` keeps its name; recorded in the evidence.

## Obligations

- O-M.1: four crates merged + renamed + memberships + patches moved; fork pruned. Proof: workspace diff.
- O-M.2: light checks green: `cargo +1.96.1 check -p theorem-ide-rpc -p theorem-ide-proxy -p theorem-ide-core` in rustyredcore_THG.
- O-M.3: records complete (register manifest amendment, PROVENANCE.md, name-collision note, rename table). Proof: the files.
- O-M.4 (deferral allowed): theorem-ide-app native/wasm32 check — DEFER with named reason if disk (currently ~2.8Gi free) cannot hold a cold compile of floem; record the proof commands for the next wave.

## Scope

Writes: `rustyredcore_THG/` (crates moves + root Cargo.toml + Cargo.lock), the fork repo (workspace prune + wasm-serve updates), `Theorem/docs/CLOSURE-MANIFEST-SKELETON-INTELLIJ-ABSORPTION-1.0.md`, `apps/theorem-ide/PROVENANCE.md`, evidence `Theorem/docs/plans/intellij-absorption/WS-MERGE.md`. Do NOT touch: theorem-cli (ide-proxy-fold's scope), the board, other apps.

## Environment (MANDATORY — machine OOM'd twice; system disk ~2.8Gi free)

- `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target` + `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home` on EVERY cargo invocation.
- `cargo +1.96.1`, `cargo check` only, `-j 4`. Watch `df -h /`; after the rename, delete stale `lapce_*` fingerprint/artifact dirs under `.target/debug` (they are garbage post-rename — frees GBs). Never touch the SSD target or other agents' artifacts.
- NEVER `git add -A` in the Theorem repo (shared dirty tree) — stage explicit paths. No commits (leave for the head).

## Acceptance

O-M.1–3 discharged; O-M.4 deferral recorded with reason if taken.

## Discharge (2026-08-10)

- O-M.1 DISCHARGED: four crates moved + renamed (theorem-ide-rpc/proxy/app/core), workspace members registered, floem pin 31fa8f44 + [patch] entries traveled into the substrate workspace root; fork workspace pruned (comment block in fork Cargo.toml); wasm-serve re-pointed at `-p theorem-ide-app --bin theorem_ide_wasm` from the substrate.
- O-M.2 DISCHARGED: `cargo +1.96.1 check -p theorem-ide-rpc -p theorem-ide-proxy -p theorem-ide-core` GREEN (re-run by verify head; 1.59s warm). Syntax tests: `cargo test -p theorem-ide-core --lib syntax` → 2/2 pass.
- O-M.3 DISCHARGED: PROVENANCE.md merged-crate ledger (upstream c9e4c339, fork 96ba5b8/17ef8dd, Apache-2.0, NOTICE retained, rename table, collision resolution); CLOSURE-MANIFEST-SKELETON amendment note (hard-fork decision supersedes the "Lapce is not forked" NO-GO rows for the editor-view lane; IntelliJ-side NO-GO rows untouched); WS-MERGE.md evidence (rename table, patch travel, repair summary, deferrals).
- O-M.4 DEFERRED (recorded reason): theorem-ide-app native/wasm32 check deferred — floem cold compile too heavy for current disk (~4Gi free). Proof commands recorded in WS-MERGE.md §7 (native `cargo check -p theorem-ide-app` + the S0 wasm32 recipe via build-wasm.sh).
- Repair ladder (mid-merge breaks, all resolved): (1) tree-sitter 0.26.10 uses `StreamingIterator` for QueryCaptures/QueryMatches and QueryMatch copies are UB across advance — ported upstream tree-sitter-highlight's 0.26 wrapper (IdeQueryCaptures/IdeQueryMatch over the C cursor API) with the engine's Peekable iteration untouched; parse loop moved to parse_with_options + progress callback honoring the cancellation flag + 500ms guard. (2) wasmtime: git dep locked at pre-bump rev demanded the removed `runtime` feature — pinned rev 21419eb (lapce's proven pairing) + wasmtime/wasmtime-wasi/wasi-common 14.0.4 in the workspace root. (3) psp-types vs lsp-types 0.97 (renamed Url→Uri, hard-resolved by starlark_syntax/codex): vendored psp-types at `vendor/psp-types-lsp-types-097` (repo's existing vendor pattern; one line changed; lsp-types pinned to the proxy's 0.95.1 instance) — no `plugins` gate needed (psp-types is in the serve_ws critical path via ~50 catalog_rpc sites).

STATE: done. Parent: ws-integration (children ide-proxy-fold + g0-verify unblocked). Evidence: `Theorem/docs/plans/intellij-absorption/WS-MERGE.md`.
