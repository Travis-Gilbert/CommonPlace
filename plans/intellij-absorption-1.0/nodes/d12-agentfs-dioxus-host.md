# d12 — AgentFS stays in Theorem with the Dioxus site (decision)

- kind: decision
- controller: agent
- gist: AgentFS (the OS filesystem) stays in Theorem and deploys with the Dioxus Rust site. It is not re-homed into CommonPlace console `/IDE`.
- provenance: 2026-08-16 user instruction after d11; amends d10 destination for this surface; amends dioxus-library d1-home's "product surfaces belong in CommonPlace / UI/ is throwaway" clause for this host.

## Question

Where does the AgentFS OS live as a product, and which site deploys with it?

## Resolve ladder evidence

1. d11: AgentFS POSIX + FUSE is the OS; Fly same-kernel is first-class; HostFs is fallback.
2. d10 chose CommonPlace-owned browser IDE behind `/IDE` because the frontend ownership fence puts all product UI in CommonPlace. That fence would move the AgentFS workbench out of Theorem.
3. dioxus-library d1-home (2026-08-09): kernel crates in Theorem `packaging/`; "user-facing product surfaces that consume them belong in CommonPlace; `UI/` sandbox remains throwaway." The live Dioxus work is already in Theorem `UI/` (`canvas-gallery`, `chrome`, `node-graph`, `record-table`) on dioxus `=0.7.10`.
4. User (2026-08-16): AgentFS "is intended to stay in theorem and be deployed with the Dioxus based rust site."

## Options

### A. Keep d10: re-home the workbench into CommonPlace `/IDE`; AgentFS remains a Theorem backend only

Evidence for: matches the 2026-08-11 frontend fence and the existing authenticated console door.

Evidence against: splits the OS from the Rust site that is meant to present it; moves user-facing AgentFS UI out of Theorem after the user ruled that it stays.

### B. AgentFS and the Dioxus Rust site stay in Theorem and deploy together

Evidence for: one repo, one Fly same-kernel machine class (Dioxus wasm/SSR + AgentFS FUSE + volume). Matches d11 and the existing `UI/` Dioxus tree.

Evidence against: named exception to the CommonPlace frontend fence; CommonPlace `/IDE` is no longer the AgentFS product door (it remains rollback for the current code-server host).

## Decision

Choose B.

- **Stay in Theorem:** AgentFS substrate (`rustyred-thg-agentfs`, `theorem workspace`, `fuse_host`, ide-proxy AgentFs backend) and the product site that opens that OS. Do not move AgentFS UI, loaders, or workspace chrome into CommonPlace.
- **Deploy with the Dioxus site:** Theorem `UI/` Dioxus surfaces (`canvas-gallery` and the dioxus-library crates it consumes: `chrome`, `node-graph`, `record-table`, `packaging/theorem-ui-core`). Hosted AgentFS is the same Fly kernel as that site (volume + `/dev/fuse` + process), not a CommonPlace edge proxy to a laptop path.
- **d10 amended, not erased:** CommonPlace still owns the console at `https://v2.theoremharness.com`. `/IDE` there stays the existing Studio/code-server rollback. It is not the AgentFS OS door. `console-host` must not re-home the AgentFS workbench. Public hostname for this Theorem Dioxus + AgentFS site is `https://apps.theoremweb.com`.
- **d1-home amended for this host:** `UI/` is the Dioxus product site for AgentFS, not throwaway sandbox. Library crates remain under `packaging/`. Other CommonPlace product UI is unchanged.
- **Lapce wasm spike** (`ide.theoremweb.com`) stays a Theorem workbench experiment. It is not a reason to copy AgentFS into CommonPlace.
- reversibility class: reversible with cost (restore d10 destination and the CommonPlace-only frontend fence)
- retraction path: revert this node and the AGENTS.md exception; leave AgentFS crates in Theorem
- state: done (2026-08-16)
- harness: `mem:doc:Travis-Gilbert:doc-9548f218feaae9b4`
