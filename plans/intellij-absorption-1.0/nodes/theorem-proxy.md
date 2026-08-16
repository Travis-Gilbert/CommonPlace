# theorem-proxy — WorkspaceBackend + AgentFs (work)

- kind: work
- controller: agent
- gist: Fork lapce-proxy (already inside the fork at `apps/theorem-ide/lapce/lapce-proxy`); introduce a `WorkspaceBackend` trait at the file layer of `dispatch.rs`; `HostFs` impl preserving stock behavior; `AgentFs` impl over `AgentFsHost` with the handoff mapping table; LSP/PTY/git against `fuse_host` when AgentFs-backed with mirror-to-directory as the no-FUSE fallback; git-status-over-FUSE measured, not assumed.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 post-gate item 1. Depends on `d8` layering decision (read `nodes/d8.md` if landed; else make your own determination from the same two crate reads and record it).

## Blueprint

Work happens inside the fork repo (`Theorem/apps/theorem-ide/lapce` — its own git repo, clean at 96ba5b8). Files of interest: `lapce-proxy/src/dispatch.rs`, `buffer.rs`, `watcher.rs`, `terminal.rs`, `lib.rs`, `bin/`.

### Mapping table (from the handoff — implement exactly)

| Lapce request | AgentFs impl |
|---|---|
| ReadDir | readdir plus getattr |
| NewBuffer | lookup plus read_at |
| Save / SaveBufferAs | handle writes with rev checks kept at the proxy layer |
| CreateFile / CreateDirectory / RenamePath | one-to-one |
| TrashPath | graph tombstones |
| DuplicatePath | metadata copy over shared chunks |
| watcher | replaced by store subscriptions |
| BufferHead | graph history when graph-native, git2 otherwise |

LSP servers, PTYs, and git run against the `fuse_host` mountpoint when AgentFs-backed; mirror-to-directory is the no-FUSE fallback; git-status-over-FUSE performance is measured, not assumed (record the measurement decision/result).

### Structure

- `WorkspaceBackend` trait at the file layer of `dispatch.rs` (dispatch consults the backend; stock behavior preserved behind `HostFs`).
- `HostFs` impl preserving stock behavior (default path — no behavior change when the workspace is a plain directory).
- `AgentFs` impl over `AgentFsHost` from `rustyred-thg-agentfs` (path dep into `Theorem/rustyredcore_THG/crates/rustyred-thg-agentfs`). If a clean seam suggests it, put the AgentFs impl in a new crate inside the fork workspace (e.g. `theorem-ide-backend`) so lapce-proxy's dep tree stays gated; the trait still lives in dispatch.rs's file layer.
- Feature-gate heavy native-only deps if needed for `cargo check` (mirror S0.1/S0.2 surgery style: feature or cfg gate, documented in the evidence table). wasmtime (plugin runtime) and git2 are the suspects — check `lapce-proxy/Cargo.toml` first.

### Name collision (record it)

`Theorem/apps/theorem-proxy` ALREADY EXISTS and is a DIFFERENT thing: the model-path proxy (Anthropic Messages / OpenAI Responses passthrough, SPEC-LOCAL-PROXY-MVP). The IDE proxy keeps the name `lapce-proxy` during this stage; the collision resolution (rename to e.g. `theorem-ide-proxy` at ws-integration) is recorded in the evidence file.

## Obligations

- O-TP.1: `WorkspaceBackend` trait at the file layer of `dispatch.rs`; dispatch compiles with the backend seam. Proof: `cargo +1.96.1 check -p lapce-proxy` green (CARGO_TARGET_DIR override).
- O-TP.2: `HostFs` impl preserving stock behavior. Proof: check green + diff summary shows no behavior change on the host path.
- O-TP.3: `AgentFs` impl over `AgentFsHost` implementing the mapping table. Proof: unit tests for the mapping against a stub/mock host (or the real `AgentFsHost` if light), listed in evidence.
- O-TP.4: LSP/PTY/git-over-`fuse_host` wiring decision recorded + mirror-to-directory fallback; git-status-over-FUSE measurement decision recorded (measured or explicitly deferred to a named wave). Proof: evidence file paragraph.
- O-TP.5: Name-collision note recorded in evidence. Proof: the paragraph.

## Scope

Writes: `Theorem/apps/theorem-ide/lapce/lapce-proxy/**` (+ optional new crate dir inside the fork workspace, + its own tests). Evidence: `Theorem/docs/plans/intellij-absorption/THEOREM-PROXY.md`. Do NOT touch: lapce-app, wasm-serve, the CommonPlace board, `Theorem/apps/theorem-proxy` (the other one), any other rustyredcore_THG crate.

## Environment (mandatory)

- `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target` — SSD target (global config) is 100% FULL; never build there. System disk ~31Gi free; `cargo check` only, `-j 4` max.
- `cargo +1.96.1`. The fork is its own git repo — you may NOT `git add -A` it (contains wasm-serve artifacts); stage specific paths only if you commit. Prefer leaving the tree for the head to commit.
- If the substrate path deps pull a huge dep tree, gate the AgentFs impl behind a feature so `cargo check -p lapce-proxy` default stays light; document in the evidence table.

## Acceptance

Trait + HostFs + AgentFs mapping implemented; `cargo check -p lapce-proxy` green; mapping unit tests green; evidence file complete (incl. name collision + FUSE wiring decisions).

## Discharge (2026-08-10)

- O-TP.1 DISCHARGED: `WorkspaceBackend` trait (14 methods, `Send + Sync`, `Arc<dyn WorkspaceBackend>` on Dispatcher) at `lapce-proxy/src/backend/mod.rs`; dispatch routes file-layer handlers through it (Initialize classification, NewBuffer, BufferHead, GetFiles, ReadDir, Save/SaveBufferAs, CreateFile, CreateDirectory, RenamePath, DuplicatePath, TrashPath, TestCreateAtPath). Proof: `cargo +1.96.1 check -p lapce-proxy -j 4` finished clean (re-run by verify head; 1m26s cold).
- O-TP.2 DISCHARGED: `HostFs` impl (backend/hostfs.rs) — verbatim moves (read_dir filter_map, ignore::WalkBuilder incl. `!.git/` override, git2 HEAD read, stock `Buffer::save` rev checks) + 4 parity tests — stock behavior preserved.
- O-TP.3 DISCHARGED: `AgentFs` impl (backend/agentfs.rs, feature-gated `agentfs`) over `AgentFsHost`: ReadDir→readdir+getattr ✓, NewBuffer→lookup+read_at ✓, Save/SaveBufferAs→write + rev checks at proxy layer ✓ (missing-file creation matches stock), CreateFile/CreateDirectory/RenamePath 1:1 ✓, TrashPath→unlink/rmdir + fsck passes ✓, DuplicatePath→metadata copy over shared chunks ✓ (chunk dedup asserted). Watcher→store subscriptions: RECORDED SEAM (agentfs exposes FsHostStatus + notify file_watcher, no consumer subscription channel — remains). BufferHead→graph history: RECORDED REMAIN (no per-file head on AgentFsHost; explicit error = non-git UX — remains). Proof: `cargo test -p lapce-proxy --features agentfs backend::` → 14/14 pass (re-run by verify head).
- O-TP.4 DISCHARGED: fuse wiring decision — fuse_host is the LSP/PTY/git mountpoint when AgentFs-backed, mirror-to-directory the fallback; actual mount wiring deferred to ws-integration (mount lifecycle is integration-layer; proxy talks only to AgentFsHost). git-status-over-FUSE: measured-not-assumed — explicit deferral to ws-integration with named measurement protocol (status wall-time vs mirrored tree, diff latency, read-amplification ≤10× baseline).
- O-TP.5 DISCHARGED: name collision recorded — `apps/theorem-proxy` is the model-path proxy (SPEC-LOCAL-PROXY-MVP); resolution (rename → `theorem-ide-proxy`) at ws-integration; no code-level collision (this node lives in the lapce fork).
- Environment note: `~/.cargo/registry` + git symlinked onto the 100%-full SSD — CARGO_HOME override to `apps/theorem-ide/.cargo-home` required for new crate fetches (recorded for future waves).

STATE: done. Verify sibling: v-theorem-proxy (gate PASSED 2026-08-10). Evidence: `Theorem/docs/plans/intellij-absorption/THEOREM-PROXY.md`.
