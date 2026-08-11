# d10-console-host-boundary: browser IDE ownership and host boundary (decision)

- kind: decision
- controller: agent
- gist: Resolve where the browser IDE UI source lives, how it enters the Console, and which production transport replaces the spike's local loopback.
- provenance: `console-host` was charted as a one-line manifest row without a blueprint or verify sibling. The 2026-08-11 re-entry found that direct artifact copying would contradict the current frontend ownership fence and the existing authenticated `/IDE` contract.

## Question

How should `console-host` consume the Lapce/Floem browser workbench while preserving CommonPlace frontend ownership, the authenticated `/IDE` product door, and Theorem's backend/protocol ownership?

## Resolve ladder evidence

1. Strategy consult: Theorem `AGENTS.md` assigns all user-facing frontend source to CommonPlace and retains engines, protocols, and non-UI clients. CommonPlace `apps/console/AGENTS.md` makes `v2.theoremharness.com` canonical and requires every surface to use the registered host/descriptor contracts.
2. Peer ask: inapplicable in this portable binding because no plan or coordination surface is available and no live occupant is declared for these plan files. The dirty Console files remain other heads' work and were not touched.
3. Research probe: `apps/console/scripts/edge-proxy.mjs` already owns authenticated WebSocket-capable `/IDE` routing to the workspace service. The current wasm spike loader under Theorem uses raw spike chrome, `ws://127.0.0.1:19414`, and a client-controlled `workspace` query parameter; it has no immutable artifact manifest or production same-origin contract.
4. Decide: option B below.

## Options

### A. Copy the current Theorem wasm-serve directory into Console static assets

Evidence for: shortest path to a visible canvas; the S0 browser oracle already boots it.

Evidence against: leaves user-facing source in Theorem, copies unversioned working output, bypasses the Console ledger, exposes a local-loopback transport assumption, and accepts a raw workspace path from browser input.

### B. Keep UI source and its loader in CommonPlace; consume a versioned Theorem IDE protocol/backend seam through the existing `/IDE` edge

Evidence for: satisfies both repository ownership fences; preserves the authenticated and rollback-capable `/IDE` route; makes the wasm artifact an immutable build output with provenance; keeps graph/store/proxy behavior in Theorem.

Evidence against: requires a source-ownership move and a same-origin transport adapter before the visual host can cut over.

### C. Supersede the Lapce/Floem console host and retain the existing Studio/code-server door indefinitely

Evidence for: current production route and rollback already exist.

Evidence against: abandons the charted absorption goal after the workbench, transport, and style binding have been proven.

## Decision

Choose B. `console-host` is refined as a CommonPlace-owned browser UI and host. Theorem supplies the versioned IDE RPC/proxy/backend capability, not product UI source. Production uses same-origin `/IDE` HTTP and WebSocket routing; browser code must not target `127.0.0.1` or choose an arbitrary server filesystem path.

- reversibility class: reversible with cost
- retraction path: do not remove or retarget the current `/IDE` upstream until the new verify sibling passes. If the new host fails, leave or restore the existing workspace IDE host variable and edge proxy target, then remove only the uncutover CommonPlace-owned wasm host files.
- state: done (2026-08-11)
