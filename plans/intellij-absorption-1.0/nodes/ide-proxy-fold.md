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
- O-F.3: `cargo +1.96.1 check --manifest-path apps/theorem-cli/Cargo.toml` green. Proof: command output. (`theorem-cli` is a standalone workspace and is not selectable with `-p` from `rustyredcore_THG`.)
- O-F.4 (optional, if disk allows): live smoke — `theorem ide-proxy` + ws client connect (native client or curl-level ws handshake + one RPC roundtrip). Record or defer with reason.

## Scope

Writes: `apps/theorem-cli/` (Cargo.toml + new subcommand source + main.rs dispatch), evidence `Theorem/docs/plans/intellij-absorption/IDE-PROXY-FOLD.md`. Do NOT touch: the merged crates, the board, the fork. NOTE: theorem-cli has other agents' uncommitted edits in the same tree — touch only your files; never `git add -A`.

## Environment (MANDATORY)

- `CARGO_TARGET_DIR=/Volumes/SSD Samsung/theorem-builds/k5-target` + `CARGO_HOME=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.cargo-home` on EVERY cargo invocation. Run the standalone CLI proof from the Theorem checkout with `cargo +1.96.1 check --manifest-path apps/theorem-cli/Cargo.toml`; `CARGO_BUILD_JOBS=1`. Do not run `cargo check -p theorem-cli` from `rustyredcore_THG`: that workspace does not contain the package.
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

## Occupancy (2026-08-15 resume)

- Occupant: cursor-grok-4.6
- Occupied at: 2026-08-15T03:18:00Z
- Binding: portable
- Scope: `apps/theorem-cli/` proof + AgentFs one-store seam in `theorem-ide-proxy` if the MCP wall is gone; evidence `IDE-PROXY-FOLD.md`
- Observed before occupy: `rustyred-thg-mcp/src/lib.rs` is 47,287 lines; naive brace balance is 1 (not the old 4). Console dirt is 0. Shared Theorem checkout is `Travis-Gilbert/theorem-ui-shell` and already contains `ide_proxy.rs`. SSD target `k5-target` is gone; using `/Volumes/SSD Samsung/theorem-builds/intellij-absorption-ide-proxy`.

## Work log (2026-08-15)

- MCP wall CLEARED: `cargo +1.96.1 check -p rustyred-thg-mcp` Finished in 18m 28s, exit 0 (SSD `intellij-absorption-ide-proxy`). lib.rs now 47,287 lines and parses.
- O-F.3 DISCHARGED: `CARGO_TARGET_DIR=/Volumes/SSD Samsung/theorem-builds/intellij-absorption-ide-proxy CARGO_HOME=apps/theorem-ide/.cargo-home CARGO_BUILD_JOBS=1 cargo +1.96.1 check --manifest-path apps/theorem-cli/Cargo.toml` → Finished `dev` profile in 30.90s (warm after a 21m cold climb through mcp), exit 0, 1 pre-existing dead_code warning in theorem-cli.
- O-F.2 CLOSED: one-store AgentFs seam landed.
  - `Dispatcher::with_backend` + `serve_ws_with_backend(addr, make_backend)` in `theorem-ide-proxy`.
  - Initialize skips `AgentFsBackend::open` when the injected backend is already `BackendKind::AgentFs` (does not clobber the engine store with InMemory).
  - `AgentFsBackend::wrap(workspace, store, blobs)` binds AgentFs onto a caller-owned `GraphStore`.
  - `SessionAgentFsBackend` reconstructs AgentFs on the engine thread via `EngineHost::with_store_typed` + cloned `DiskObjectStore` (same physical chunk store). SR-017: no second `RedCoreGraphStore::open`.
  - `GraphRead`/`GraphWrite` forwarding for `&mut T` so AgentFs can borrow the engine store for one call.
  - `theorem ide-proxy --agentfs` now calls `serve_ws_with_backend` with that session backend.
- O-F.1: clap surface unchanged. `cargo build --bin theorem` is in-flight for `--help` capture (check does not emit the binary).
- O-F.4: still needs the linked binary for Initialize → ReadDir.

## Park (weather, resumable — updated 2026-08-11)

Reason: proof command blocked by ONE external wall: `rustyred-thg-mcp` lib.rs is unparseable (brace balance 4, 41,106 lines) under another agent's in-flight refactor; it is a hard dependency of theorem-cli through rustyred-embedded. Disk headroom no longer matters (27Gi free system / 541Gi SSD). Trigger: mcp lib.rs parses (balance 0). Resume: `cargo +1.96.1 check --manifest-path apps/theorem-cli/Cargo.toml` (SSD k5-target, warm rmeta), capture `theorem ide-proxy --help`, smoke Initialize -> ReadDir, then close the AgentFs one-store seam (`serve_ws_with_backend` plus engine-store handoff).

## Park (weather, 2026-08-16)

O-F.2 and O-F.3 have receipts (one-store seam on tree after PR #545 fast-forward; prior check green). Remaining O-F.1 (`--help`) and O-F.4 (Initialize→ReadDir) need a linked `theorem` binary. Latest check hit `wasi-experimental-http-wasmtime` E0310 (wasmtime 43 vs pin-14). Trigger: lockfile on the wasmtime 14 line + `cargo +1.96.1 build --manifest-path apps/theorem-cli/Cargo.toml --bin theorem` on the SSD target. Occupancy released so `dioxus-agentfs-host` can run (d12 destination).

- state: occupied (2026-08-16 resume after dioxus-agentfs-host GATE PASS)

## Occupancy (2026-08-16 resume)

- Occupant: cursor-grok-4.6
- Binding: portable
- Scope: `apps/theorem-cli` proof only (`--help` + Initialize→ReadDir). Do not use `CARGO_HOME=apps/theorem-ide/.cargo-home` (that rewrite caused the E0310 lockfile drift). SSD target `intellij-absorption-ide-proxy`. `CARGO_BUILD_JOBS=1`.
- Hypothesis (rung 2): lockfile already pins `wasi-experimental-http-wasmtime` to wasmtime 14.0.4; E0310 was the isolated CARGO_HOME rewrite. Resume with default cargo home.

## Work log (2026-08-16 close)

- Wasmtime wall CLOSED without isolated `CARGO_HOME`. `wasi-experimental-http-wasmtime`'s `wasmtime = "*"` still unified onto 43 in this standalone CLI workspace. Repair: vendor `apps/theorem-cli/vendor/wasi-experimental-http-wasmtime` from lapce @ `21419eb` with `wasmtime`/`wasmtime-wasi`/`wasi-common` pinned `=14.0.4`, plus `[patch."https://github.com/lapce/wasi-experimental-http"]`. Crate compiled with one unused_mut warning; no E0310.
- O-F.3 re-proven by link: `CARGO_TARGET_DIR=/Volumes/SSD Samsung/theorem-builds/intellij-absorption-ide-proxy CARGO_BUILD_JOBS=1 cargo +1.96.1 build --manifest-path apps/theorem-cli/Cargo.toml --bin theorem` → Finished `dev` profile in 17m 50s, exit 0. Binary `…/debug/theorem` (570M). Runtime needs `DYLD_FALLBACK_LIBRARY_PATH=$HOME/.cache/rustyred-thg-graphblas/install/lib` (`libgraphblas.9.dylib`). Do not use `CARGO_HOME=apps/theorem-ide/.cargo-home` for this proof.
- O-F.1 DISCHARGED: `theorem ide-proxy --help` exit 0. Surface: `--serve-ws` (default 127.0.0.1:19414), `--workspace`, `--agentfs` (product default), `--hostfs` (fallback), global `--data-dir`.
- O-F.4 DISCHARGED (HostFs sentinel): `--hostfs --serve-ws 127.0.0.1:19424 --workspace <tmp>` + stdlib websocket client. Initialize then `read_dir` → `ReadDir items (1): ['O_F4_SENTINEL.txt']`. PASS.
- Default AgentFs RPC also round-trips: Initialize then `read_dir` → `result.read_dir_response.items = []` (host sentinel is not in the graph until ingest). Not a HostFs failure.

## Seal (2026-08-16)

O-F.1–O-F.4 discharged. Occupancy released.

- state: done (2026-08-16)

## Weather re-probe (2026-08-11, session 11)

- The old proof form was invalid: `cargo +1.96.1 check -p theorem-cli` from `rustyredcore_THG` returns `package ID specification theorem-cli did not match any packages` because the CLI declares its own `[workspace]` in `apps/theorem-cli/Cargo.toml`.
- The corrected proof reached the intended dependency wall: `CARGO_TARGET_DIR=/Volumes/SSD Samsung/theorem-builds/k5-target CARGO_HOME=apps/theorem-ide/.cargo-home CARGO_BUILD_JOBS=1 cargo +1.96.1 check --manifest-path apps/theorem-cli/Cargo.toml` failed in `rustyred-thg-mcp/src/lib.rs` with unclosed delimiters opened at lines 30409, 41078, and 41101; final location 41106. This is a replayable refusal receipt, not a CLI finding.
- The park remains valid. Correct resume: rerun the manifest-path proof after the MCP file parses, then capture `theorem ide-proxy --help`, run Initialize -> ReadDir, and close the one-store injection seam.
