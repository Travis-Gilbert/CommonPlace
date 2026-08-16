# ws-integration — fork crates merge into the substrate workspace (work)

- kind: work
- controller: agent
- gist: Post-gate tight integration (decision of record): the fork's crates merge into the `rustyredcore_THG` workspace as `theorem-ide-app`, `theorem-ide-rpc`, `theorem-proxy` (IDE proxy — resolve the name collision with the existing model-path `apps/theorem-proxy`), taking path deps on `rustyred-thg-text-model`, `rustyred-thg-agentfs`, and the harness crates; `Theorem/apps/` keeps only thin binaries and deploy scaffolding; the IDE proxy folds into the `theorem` binary as a subcommand or service — one install carries the IDE backend, the harness, and the database in one process sharing one store handle.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 post-gate item 5 + styling amendment (tightest expression: the binary is the product).

## Blueprint

Dependencies: theorem-proxy (WorkspaceBackend/AgentFs), d7m (text-model on xi-rope), token-kernel (theme + kernel), websocket transport for `ProxyMessage` between the wasm frontend and the proxy (handoff post-gate item 2). None of those may be cut; this node consumes all of them.

Also owns: crate renames (anti-scope of the spike is lifted), register manifest amendment, provenance ledger completion, the real-OS IME browser verify (first item of the proxy wave), GL fallback exercise, one-frame keystroke budget, copy/paste/scroll measurement, a11y decision (g0 carry-forward items).

## Obligations

- O-WS.1: fork crates merged into `rustyredcore_THG` as `theorem-ide-app`/`theorem-ide-rpc`/`theorem-proxy`(IDE) with path deps; renames recorded; register manifest amended; provenance ledger completed. Proof: workspace manifest diff + compile of the merged crates.
- O-WS.2: IDE proxy folds into the `theorem` binary (subcommand or service), sharing one store handle. Proof: `theorem` binary accepts the IDE proxy subcommand/service and unit/integration tests pass.
- O-WS.3: Websocket transport for `ProxyMessage` between wasm frontend and proxy. Proof: transport tests + browser verify.
- O-WS.4: g0 carry-forward verify items executed or explicitly deferred with reasons (real-OS IME first). Proof: evidence file section.

## Scope

The entire integration surface: rustyredcore_THG workspace, fork crates, theorem binary, wasm frontend build, board. This is the last node of the plan before fixpoint review.

## Acceptance

One install runs IDE backend + harness + database in one process; the wasm frontend is a build artifact of its crate, consumed by the console host; all carry-forward items resolved or deferred with reasons.

## State: PENDING (not claimable until theorem-proxy, d7m, token-kernel, and the websocket transport land)
