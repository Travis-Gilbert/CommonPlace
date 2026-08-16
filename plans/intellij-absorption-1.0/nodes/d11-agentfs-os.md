# d11 — AgentFS is the OS filesystem (decision)

- kind: decision
- controller: agent
- gist: RustyRed presents an OS-level POSIX filesystem. AgentFS + FUSE is first-class (Fly same-kernel is the hosted case). Host OS directories and unmounted MCP are fallback.
- provenance: 2026-08-16 user instruction after Fly theoremweb.com cutover; consumes d8 (vfs beside agentfs) and the Fly AgentFS FUSE same-kernel law already encoded for `travis-dsh-workspace`.

## Question

Is RustyRed's product filesystem the host machine's ordinary disk (`HostFs`, git checkout as the read path, unmounted `theorem exec` / `fs_*`), with FUSE as an opt-in acceleration — or is AgentFS the OS, with the host disk as fallback?

## Resolve ladder evidence

1. Substrate already ships the POSIX surface: `rustyred-thg-agentfs` (`AgentFsHost`, ino/`CHILD`/64KB CAS chunks, `fuse_host` behind `fuse-host`). `theorem workspace serve` mounts it. `infra/fly/dsh-workspace` boots that mount at `/workspace` on the same VM as the volume and the process.
2. d8 already said graph-native workspaces serve through agentfs and `fuse_host` is the LSP/PTY/git mount; HostFs is the host-directory path. What stayed inverted was CLI/product copy: workspace was "opt-in FUSE", ide-proxy defaulted to HostFs, and THEOREM-PROXY treated default builds as HostFs-stock.
3. Fly Linux gives `/dev/fuse` on the kernel that also holds the volume. That is the hosted first-class case. macOS without macFUSE, and any host missing `/dev/fuse`, cannot present that OS; they fall back.
4. Peer constraint already encoded: same-kernel law — do not remote-FUSE `travis-theorem-personal-store`; do not discharge via materialize copies. `/dev/fuse` presence is weather, not a reason to copy trees out.

## Options

### A. Keep HostFs / git checkout as the default read path; FUSE stays opt-in

Evidence for: local laptop agents already work in a checkout; `theorem ide-proxy` without `--agentfs` is HostFs; no `/dev/fuse` required.

Evidence against: contradicts the AgentFS design ("the filesystem is a view; the graph is the truth"); makes Fly a special case instead of the product host; leaves the public IDE (`ide.theoremweb.com`) on StubProxy/HostFs forever.

### B. AgentFS POSIX (FUSE when the kernel has it) is the OS; host disk is fallback

Evidence for: matches the crate, the Fly start script, d8's graph-native path, and the reason Fly hosting exists for this product. Laptop folder pickers become ingest (`--seed`, `theorem workspace ingest`, POSIX writes on the live mount), not the read path.

Evidence against: local macOS without macFUSE must keep a named fallback; `theorem ide-proxy` must not default to AgentFs on a checkout that still opens a second InMemory store (one-store fold / `serve_ws_with_backend`).

## Decision

Choose B.

- **First-class OS:** AgentFS. Graph is truth; POSIX is the view. On a kernel with `/dev/fuse` (Fly Linux same-VM as the volume and the process), `fuse_host` / `theorem workspace serve` is how other processes — LSP, PTY, git, dsh, a hosted IDE worker — see that OS.
- **Fallback:** HostFs, a git checkout as the read path, and unmounted MCP (`theorem exec` / `fs_*` over the data dir) when FUSE is unavailable (macOS without macFUSE, missing `/dev/fuse`) or when a task must edit the git tree itself.
- **IDE:** Product workspaces open into AgentFS. `theorem ide-proxy` defaults to AgentFs over the CLI engine store (`SessionAgentFsBackend` / `serve_ws_with_backend`, fold PR #545). `--hostfs` is the fallback. `--agentfs` remains valid and is the same as the default.
- **d8 unchanged:** vfs sits beside agentfs. vfs journals a real host FS when that fallback is in use.
- **Fly:** `infra/fly/dsh-workspace` is one consumer of the hosted OS, not a DeepSeek-only exception. The product host for AgentFS is the Theorem Dioxus site (`UI/`), same-kernel as FUSE (d12). CommonPlace `/IDE` is not that door.
- reversibility class: reversible with cost (restore HostFs-default copy and `--agentfs` opt-in)
- retraction path: revert this node, AGENTS.md rows, and CLI help; leave `fuse_host` and `dsh-workspace` in place
- state: done (2026-08-16)
- harness: `mem:doc:Travis-Gilbert:doc-d132dd6d13fd41ff`
- amended-by: d12-agentfs-dioxus-host (2026-08-16)
