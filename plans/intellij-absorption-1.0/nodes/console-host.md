# console-host: CommonPlace-owned browser IDE behind `/IDE` (work, wave 6)

- kind: work
- controller: agent
- gist: Re-home the browser-rendering workbench source and loader into CommonPlace, emit an immutable wasm artifact, and serve it through the existing authenticated `/IDE` door against the Theorem IDE proxy/backend.
- provenance: wave-6 `console-host`, refined by `d10-console-host-boundary`.
- depends on: `d10-console-host-boundary` (done), `ide-proxy-fold` (parked), and a clean declared CommonPlace scope.

## Blueprint

1. CommonPlace owns every source file that paints the browser workbench, including the wasm entrypoint, loader, host page, theme bridge, and browser transport adapter. Preserve upstream license and fork provenance during the move.
2. Theorem retains `theorem-ide-rpc`, `theorem-ide-proxy`, storage, AgentFs, and the one-store backend seam. Cross-repo consumption uses a pinned, versioned contract rather than relative paths into a sibling checkout.
3. Build output is an immutable artifact set: wasm, generated JS glue, WASI shim assets, and a manifest containing source revision, protocol version, byte sizes, and SHA-256 digests. Working `wasm-serve` screenshots, node_modules, and debug output are never product inputs.
4. Keep the existing CommonPlace `/IDE` route and edge proxy as the product and rollback boundary. The production loader uses same-origin HTTP and WebSocket URLs. Workspace identity/root comes from the authenticated workspace service, never a browser-supplied absolute path.
5. Retoken the temporary S0 host chrome through the Console register or remove it; do not ship the spike's raw CSS/header. The workbench canvas itself remains flush editor material.

## Obligations

- O-CH.1: UI ownership and provenance are explicit: browser-rendering source lives in CommonPlace; Theorem-side dependencies are UI-neutral and pinned. Proof: source map, license ledger, and repository-path audit.
- O-CH.2: deterministic artifact contract. Proof: two builds from the same revision produce a manifest with matching protocol version and SHA-256 digests; artifact size recorded.
- O-CH.3: authenticated same-origin transport. Proof: `/IDE` serves the loader and upgrades its IDE WebSocket through the existing edge; no `ws://127.0.0.1` or client-selected absolute workspace path in production code.
- O-CH.4: local browser oracle. Proof: headed browser boots, connects, Initialize -> ReadDir succeeds, a file opens, and typing emits an Update without console panic.
- O-CH.5: CommonPlace gates pass for every changed package and route. Proof: scoped unit tests, sourcing/register gates, build.
- O-CH.6: live product oracle. Proof: signed-in `https://v2.theoremharness.com/IDE` boots the new host against the authenticated workspace service; current host remains the rollback until this receipt exists.

## Scope

Expected writes after occupancy: a new CommonPlace-owned IDE wasm source/packaging root, `packaging/workspace/`, the narrowly required `/IDE` edge/doctor files, provenance docs, and this plan's evidence. Avoid `apps/console/src/views/registry.tsx` and `apps/console/src/lib/console-host.ts`: `/IDE` is already a routed product door, not a new block descriptor. Exact paths must be declared before implementation because the current Console tree carries unrelated dirty work.

Do not modify or delete the protected Theorem/CommonPlace worktrees, the local-only fork history, or unrelated Console files. Do not cut over production before `v-console-host` accepts.

## Park (weather, resumable)

Reason: `ide-proxy-fold` cannot yet produce the integrated backend receipt because `rustyred-thg-mcp/src/lib.rs` is unparseable. The CommonPlace console also has 58 dirty paths owned by other work. Trigger: the manifest-path theorem-cli proof passes and the intended CommonPlace write scope is clean or explicitly reconciled. Resume by declaring exact source-move and host paths, then occupy this node.

- state: parked (2026-08-11)
