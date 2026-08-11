# ide-proxy-fold — IDE proxy folds into the `theorem` binary (work, refine of ws-integration)

- kind: work
- controller: agent
- gist: `theorem ide-proxy` subcommand in `apps/theorem-cli`: build the CLI's existing GraphStore/DiskObjectStore, construct `AgentFsHost` (or HostFs), run the merged `theorem-ide-proxy` `serve_ws` on one store handle — one install carries the IDE backend, the harness, and the database in one process.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 post-gate item 5 ("the tightest expression: the binary is the product"); parent: ws-integration (O-WS.2). Depends on ws-merge.

## Blueprint

- Binary: `apps/theorem-cli` (package `theorem-cli`, `[[bin]] name = "theorem"`). Read how the CLI constructs its store (engine_host.rs / graph_cmd.rs / main.rs patterns) and mirror it.
- Subcommand: `theorem ide-proxy [--serve-ws 127.0.0.1:PORT] [--workspace PATH] [--agentfs]`. Default backend HostFs (stock workspace dir); `--agentfs` builds `AgentFsHost` over the CLI's own GraphStore + DiskObjectStore instance — the SAME store handle the harness uses. This is the mechanism behind "pays for both": a keystroke becomes a delta in the store the agent heads read.
- Deps: add `theorem-ide-proxy` (+ `rustyred-thg-agentfs` for the AgentFs wiring) to theorem-cli's Cargo.toml.
- The websocket transport (ws-transport) is already the wire: serve_ws exists in the merged proxy; the fold is the subcommand wiring + store construction.

## Obligations

- O-F.1: `theorem ide-proxy` subcommand implemented (args, store construction per CLI patterns, serve_ws launch with backend selection). Proof: code + `theorem ide-proxy --help` output.
- O-F.2: one-store-handle claim: the CLI's store instance is the proxy's store (no second store constructed). Proof: code refs + evidence paragraph.
- O-F.3: `cargo +1.96.1 check -p theorem-cli` green. Proof: command output.
- O-F.4 (optional, if disk allows): live smoke — `theorem ide-proxy` + ws client connect (native client or curl-level ws handshake + one RPC roundtrip). Record or defer with reason.

## Scope

Writes: `apps/theorem-cli/` (Cargo.toml + new subcommand source + main.rs dispatch), evidence `Theorem/docs/plans/intellij-absorption/IDE-PROXY-FOLD.md`. Do NOT touch: the merged crates, the board, the fork. NOTE: theorem-cli has other agents' uncommitted edits in the same tree — touch only your files; never `git add -A`.

## Environment (MANDATORY)

- `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target` + `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home` on EVERY cargo invocation. `cargo +1.96.1`, check only, `-j 4`. Watch `df -h /` (~2.8Gi free; free stale `lapce_*` artifacts under .target/debug if needed).
- No commits.

## Acceptance

O-F.1–3 discharged; O-F.4 recorded or deferred with reason.

## Work log (2026-08-10)

- O-F.1 LANDED: `apps/theorem-cli/src/ide_proxy.rs` (clap derive, PortArgs house style; `theorem ide-proxy [--serve-ws ADDR (default 127.0.0.1:19414)] [--workspace PATH (default cwd)] [--agentfs]`), dispatched from main.rs (Command::IdeProxy, line 128 + arm 374). `--agentfs` writes the `.theorem-agentfs` marker via the proxy's exported AGENTFS_WORKSPACE_MARKER so the dispatcher switches backend at Initialize. Thin launcher — proxy owns dispatcher/transport.
- O-F.2 LANDED (partial proof): `run` constructs exactly ONE store — EngineHost::open → rustyred_embedded::Engine::open → RedCoreGraphStore::open + DiskObjectStore::from_chunk_store (rustyred-embedded/src/lib.rs:360-373), same store exec/acp/graph/sync use, process-lifetime; no second RedCore (SR-017); HostFs mode builds no store. HONEST GAP recorded: the merged AgentFsBackend::open (feature agentfs) opens its OWN session-scoped InMemoryGraphStore + blobs under `<ws>/.theorem-agentfs-store`; the merged proxy has no backend-injection seam (Dispatcher::new hard-codes HostFs; serve_ws takes no backend). Named remain: `serve_ws_with_backend`/`Dispatcher::with_backend` in theorem-ide-proxy, then ide_proxy.rs hands the engine store over — the "keystroke → delta in the harness store" wiring.
- O-F.3 NOT DISCHARGED — PARKED on weather (see below). The full dep tree compiled into the CLI graph (theorem-ide-proxy + agentfs, wasmtime 14 line, floem-editor-core, alacritty_terminal, vendored git2/OpenSSL, rustyred-thg-agentfs); lockfile fixed (wasi-experimental-http-wasmtime's wasmtime="*" pinned to the 14.0.4 line — the CLI graph's pre-existing wasmtime 43/47 made * pick 47 → E0310). Remaining walls: (1) another agent's in-flight rustyred-thg-mcp refactor (20 files, +2326/-6912, untouched since 11:53) leaves lib.rs UNPARSEABLE (unclosed delimiter at line 30409) — theorem-cli cannot check until it heals; (2) disk ENOSPC (0-120Mi free during the session). Module parse/resolve-clean under bare rustc.
- O-F.4 DEFERRED: smoke needs the built binary; same walls. Client contract documented (node ws 8.21.0: Initialize → ReadDir roundtrip, envelope per theorem-ide-rpc/src/parse.rs).

## Park (weather, resumable)

Reason: proof command blocked by external weather — (1) another agent's unparseable rustyred-thg-mcp lib.rs (must heal), (2) disk headroom ≥1.5Gi quiet needed for the theorem-cli check (resumes from cached rmeta; remaining chain: mcp → theorem-agentd → harness → rustyred-embedded → theorem-cli). Trigger: mcp tree green + `df` headroom. Resume: run `cargo +1.96.1 check -p theorem-cli` (overrides), capture `theorem ide-proxy --help`, run the smoke, then implement the AgentFs one-store seam (serve_ws_with_backend) and hand the engine store over.

## Weather re-probe (2026-08-11, session 10 — disk cleared, block narrowed)

- **Disk trigger CLEARED**: system 27Gi free, SSD 541Gi free (was 0-120Mi). Only the mcp parse block remains.
- **Backend crate checks GREEN independent of the weather**: `cargo +1.96.1 check -p theorem-ide-proxy -j 4` → Finished in 33.57s, 0 errors (SSD k5-target). The merged proxy crate compiles; the mcp parse break does not reach it.
- **Subcommand API surface statically verified against the checked-green crate**: `theorem_ide_proxy::serve_ws(&addr)` exists (lib.rs:165); `theorem_ide_proxy::backend::AGENTFS_WORKSPACE_MARKER` = ".theorem-agentfs" (backend/mod.rs:38); the dispatcher's AgentFs classification checks `workspace.join(AGENTFS_WORKSPACE_MARKER).is_file()` (backend/agentfs.rs:62) — exactly what ide_proxy.rs writes for `--agentfs`. The landed code is consistent with the crate as compiled.
- **The remaining wall is one crate**: `cargo tree -i` shows theorem-cli → rustyred-embedded → rustyred-thg-mcp (hard dep, cannot `--exclude` a path dep). lib.rs brace balance still 4 today (41,106 lines). The instant it parses: `cargo check -p theorem-cli` (warm rmeta) → `theorem ide-proxy --help` → smoke → AgentFs one-store seam.

## Park (weather, resumable — updated 2026-08-11)

Reason: proof command blocked by ONE external wall — `rustyred-thg-mcp` lib.rs unparseable (brace balance 4, 41,106 lines) under another agent's in-flight refactor; it is a hard dep of theorem-cli via rustyred-embedded. Disk headroom no longer a factor (27Gi free system / 541Gi SSD). Trigger: mcp lib.rs parses (balance 0). Resume: `cargo +1.96.1 check -p theorem-cli` (SSD k5-target, warm rmeta) → `theorem ide-proxy --help` capture → smoke (node ws: Initialize → ReadDir roundtrip) → AgentFs one-store seam (serve_ws_with_backend) + engine-store handoff.
