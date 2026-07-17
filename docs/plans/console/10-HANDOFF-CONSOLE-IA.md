# HANDOFF-CONSOLE-IA

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`. Register: execution handoff; named choices are requirements. Tenant slug casing is load-bearing: `Travis-Gilbert`. Companions in force: the composer and sidebar thinking ratified in session (structure from that exchange restated here as requirements), SPEC-HARNESS-MEMORY-PROJECTION (its console landing is I3), SPEC-CODE-SURFACE (tree and descriptor patterns), HANDOFF-CARDS-ACTIONS-MENTIONS (the Cards surface exists), SPEC-UI-SOURCING-ADDENDUM (Presence mark), 21st.dev subscription (components adopt-and-edit: reuno-ui ai-input, muhammad-binsalman glowing surface, builduilabs filesystem-item, isaiahbjork agent-plan as the styling reference).

Scope sentence: the console gains the navigation people are trained for (side, not top), a Chat surface where the composer is the centerpiece, the two state-driven companions, and the projection spec's file tree, so a person who has never seen the console knows where to click and where to type within five seconds.

## Named choices

1. Three organs, three names, permanent: the Search field (top toolbar), the Composer (the agent input), the Presence mark. The word omnibar retires from all future specs and code identifiers.
2. The stripe splits into two behavior groups. Upper group, Surfaces, radio behavior, switching the center screen by applying the seeded surface: Chat, Workspace, Index, Documents, Cards. Lower group, Companions, toggle behavior, panels that ride alongside any surface: Files, Context, Thread. `registerToolWindow` gains `role: 'surface' | 'companion'`. The toolbar layout switcher remains as the secondary path and stays in Command mode.
3. Dense horizontal artifacts are surfaces; sidebars hold navigation, context, and compact structure. The record table never mounts in a rail. The Workspace seed is revised accordingly (I5).
4. The Chat surface is the primary screen. Thread in a measured center column; the Composer centered in the lower third, wide not tall; the agent plan renders in-thread through assistant-ui primitives styled per the agent-plan reference (24px rows, mono tool names, Int UI status colors).
5. The Composer adopts the reuno ai-input mechanics (auto-grow 48 to 164, attach left, send right, active-tint toggle chips) and the binsalman surface material only: the angled-light sheen with a low-chroma stutter, rendered as a canvas layer per the canvas-grounds preference, bound to agent state (faint at idle, breathing while streaming, the commit flash the mark owns). The floating-button and docked-right patterns are banned by name: the Composer is never summoned from a button and never docks right. The Presence mark lives in the Composer; there is no other agent glyph on the Chat surface.
6. Capability is communicated by the input's physical presence: the Composer carries file attach, `@` object mentions resolved through the hosts (the round-2 Objects machinery), a model or mode select slot, and the `/do` entry from HANDOFF-CARDS-ACTIONS-MENTIONS when that lands. Ctrl or Cmd L focuses the Composer from anywhere. The toolbar island's Ask mode retires; the top field keeps Command, Search, and Objects, and its placeholder becomes "Search, or press Shift Shift."
7. On non-Chat surfaces the Thread companion docks right with a compact Composer at the dock's bottom. The same component at compact density; input never sits above output.
8. The sheen obeys the motion constitution: inventoried, reduced-motion renders it static, idle cost measured, and it never exceeds the ground canvas budget.
9. Empty states teach. The Chat surface's empty thread renders three starter suggestion chips derived from live tenant state (a recent record, a recent doc, a runnable action), each one press to send. No tour, no modal onboarding.

## Deliverables

### I1. Stripe navigation
Build: the two stripe groups with role-aware behavior (radio surfaces, toggle companions), separator between groups, `aria` semantics per role (radiogroup for surfaces, `aria-pressed` toggles for companions), keyboard map (Alt 1 to 5 surfaces, Alt Shift 1 to 3 companions), the layout switcher retained in the toolbar and Command mode, and per-surface arrangement snapshots continuing to hold across switches.
Acceptance: clicking a surface icon switches the center screen and the stripe reflects exactly one active surface; companion toggles persist per surface; every stripe action is keyboard reachable; the five-signature e2e gains the radio-versus-toggle assertion; a person shown the shell and asked "where do I go to see my documents" points at the stripe in a hallway test capture.

### I2. The Chat surface and the Composer
Build: the Chat seeded surface (thread center at a measured column, Composer lower third); the Composer component adopted from the two 21st sources and re-tokened (register paint, motion tokens, the material sheen canvas with the three state bindings); attach, `@` mentions, mode slot; Ctrl or Cmd L focus wiring; the island Ask retirement and top-field relabel; the in-thread agent plan styling pass; the mark mounted in the Composer (composing state) and removed from anywhere else on this surface; the empty-state starter chips from live queries.
Acceptance: a cold user typing Ctrl or Cmd L then a question gets a streaming reply with the mark composing in the Composer; the sheen states are on the interaction inventory and render static under reduced motion with measured idle cost; `@` inserts a resolvable object chip; the banned patterns are asserted (no floating summon button exists; the Composer's bounding box center sits in the lower third at 1280 and 1440); starter chips send on one press and disappear once the thread has a turn.

### I3. The Files companion (the projection spec lands here)
Build: the state-dependent file tree as the Files companion, re-targeting SPEC-HARNESS-MEMORY-PROJECTION deliverables 1, 2, 4, and 6 from `apps/web` paths to `apps/console`: the harness GraphQL HTTP client (tenant on the connection, tenant-unset refusal), the `itemsByKind(kind: "memory")` listing through the lean projection, the tenant-filtered changefeed proxy, and tree grouping by pinned `projection_path`. Three roots by workspace state: Project (code tree through the code host pattern when a project context exists), Harness Memory (the projection), Uploads. The reader is the existing `markdown.doc` descriptor: selecting a memory opens it as an editor tab through Galley, with the CM6 edit toggle rendering read-only-with-reason until MemoryPatch exists. The engine-side deliverables of the projection spec (lean projection, pinned path minting, changefeed emission) are referenced as their own dispatch to the Theorem repo and are prerequisites for the live states here; absent them, each root renders its named unavailable state.
Acceptance: with the engine deliverables live, every memory document appears in the tree, opens full-body as a Galley tab, retitles without moving, and a new memory from Claude Code appears without reload; tenant-unset renders the explicit refusal state; the filesystem-item reference's expand behavior is reimplemented on tokens (no vendored component); the tree virtualizes at 5000 nodes.

### I4. The Context companion
Build: the contextual graph as a companion: a hand-tuned D3 ego view keyed to the current selection (record, doc, or thread object), at most eight nodes plus up to two gold memory nodes, every edge carrying a reason in words, fed by the salience exact tier and existing graph edges, per the constellation sourcing rules (D3 for small annotated graphs, cosmos.gl reserved for deep exploration).
Acceptance: selecting a record populates the companion with its neighborhood and worded edge reasons; selection change re-derives within the wait-ladder budget; unconnected selections render an honest empty state; gold nodes open their memory atoms; deterministic layout for identical inputs.

### I5. Seed revisions
Build: Workspace re-seeded as document plus code tab plus thread companion (the record table leaves the rail); Index unchanged; Cards unchanged; the surface set registered in the stripe order Chat, Workspace, Index, Documents, Cards with Chat as the default surface on first run.
Acceptance: no seeded surface mounts a table in a side region; first run lands on Chat with the starter chips; all five surfaces switch from stripe, switcher, and Command mode identically.

### I6. Gates
Build: baselines for Chat (empty, streaming, with plan), the stripe groups, the Files tree states, and the Context companion; the keyboard reachability sweep (every surface and companion reachable without pointer); the banned-pattern assertions; the inventory scan extended to the sheen.
Acceptance: CI blocks merge on all; the hallway-test captures (I1, I2 cold-user flows) are attached to the PR as evidence, not gates.

## Verify first

- The engine-side projection deliverables' dispatch status in the Theorem repo (lean projection, pinned paths, changefeed); I3's live states depend on them and the handoff for that dispatch references the original spec verbatim.
- Project context detection for the Files companion's Project root (what marks a project open in the console today; if nothing does, the root renders its unavailable state naming the project layer as the missing capability, which is honest given the project subgraph is deliberately deferred).
- The 21st components' current code against the session's captures before adoption (both were fetched this session; re-pull at dispatch).
- assistant-ui's tool and plan primitive names at the installed version for the I2 styling pass.

## Out of scope

The project subgraph and project UI (deferred by decision; the Files companion's Project root degrades honestly until it exists), multibuffers (their own future descriptor), MemoryPatch write-through, co-browse, and the coloration work (its own handoff).
