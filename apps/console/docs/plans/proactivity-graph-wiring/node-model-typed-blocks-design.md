# Node-model typed blocks — design proposal

Implements the "Node-model (typed blocks)" section of
`implementation-plan.md` (step 7) and the Claude.ai answer that resolved it.
Surface: `apps/console` proactivity graph. Register: Int UI (`--ij-*`), the
app's pinned visual world. The site parchment/rough.js aesthetic is banned here.

## The one idea

**A block is what a node is made of, and its vocabulary is fixed by the host
node kind.** The grammar forbids cross-type drops (you cannot put an `action`
block in a `judgment`). The constraint is the lesson: what the grammar forbids
teaches the concept better than the theming does.

Blocks are a **typed decomposition over the existing node fields, not a parallel
store.** `blocksForNode(node)` decompiles a projected node into typed blocks;
each block edit is one of the existing allowlisted field patches
(`node-actions.ts`). This keeps three invariants intact:

- **Fixture seam** (GW6.5): projection/store shape unchanged; the Rust
  projection satisfies the same signature at v1.
- **Grant boundary** (PG7 gate 2): a block cannot write a Grant or an
  EffectContract because it maps only to the existing safe field surface.
- **Sentence-outside / blocks-inside** (answer): the node's canvas label is the
  decompiled sentence (`sentences.ts`) of the same fields the block stack edits,
  so the three altitudes cannot drift.

## The grammar (block vocabulary by host kind)

| Host node | Legal block types |
|---|---|
| Watch | `match`, `threshold`, `and_or`, `not`, `stopping` |
| Judgment | `policy` |
| Response | `prepare`, `verify`, `action` |
| Stake | `stopping` |
| any | `custom` (deliberately unthemed) |

The two that matter in Response are **prepare** ("assemble the correspondence,
find the deadline") and **verify** ("check feasibility with the solver before
proposing"): verify puts the verified-cognition layer on the canvas, the one
thing in the stack nobody else has and that is invisible today.

## Clock source, not a cron block (aliveness named choice 3)

Time is a fact source, not a trigger. A fifth life source `life_clock` ("Clock")
sits beside Email/Calendar/Messages/Calls and emits temporal facts (staleness
threshold passed, cadence tick) that `feed` a watch like any other source. No
cron block: the manuscript's "weekly cadence" becomes a Clock-fed watch, one
mechanism, and the graph reads honestly. Everything downstream (edges, degraded
propagation) is already generic over sources, so this is additive.

## Custom is compiled from intent, not hand-written

`custom` blocks are unthemed (honest: the shape cannot tell you what arbitrary
logic does). The palette's `custom` entry and the compile-only watch types
(`and_or`, `not`, `stopping`) open the existing IntentComposer (Forme) scoped to
the node, not a blank editable row. Hand-writing custom blocks would rebuild n8n
inside a node; compiling from intent keeps the blank canvas closed.

## Commit-graph fork/merge for the Response stack

A block stack with if/then is fork-and-merge topology, which is exactly a git
graph, so the pinned jalco commit-graph node already carries it. A Response
renders `prepare → verify → action` as rail rows; a branch (`then`/`else` on a
step) forks the rail and the branches rejoin at the terminal `action` (the
merge). Still, no ambient motion (register rule): fork and merge read through
rails, borders, and dots only.

## Gate answers

1. **Routing intent** — `uiFoundation` (authoring/configuration surface inside
   existing IDE chrome), not a new canvas or shader.
2. **Rendering surface** — DOM/CSS block rows inside the existing React Flow
   node and the inspector aside. No new rendering surface.
3. **Visual vocabulary** — the pinned jalco `commit-graph.tsx` rail-and-entry
   and `repo-card.tsx`, re-skinned to `--ij-*`. Block row = rail dot + type chip
   + label + affordance.
4. **Layer stack** — unchanged: GroundCanvas behind, still chrome in front.
5. **Brand alignment** — continuous with the existing proactivity node (same
   `RAIL`/`KIND_META`/container classes); the theme is the type system rendered.
6. **Motion + performance** — none; the surface is still. Reduced-motion pass is
   identical by construction.
7. **Accessibility** — every block row has a text label and a type chip (never
   color alone); the palette is keyboard-reachable; the type chip names the
   block; `aria-label` on rows.
8. **Fallback** — the graph altitude is code-split and dynamic; the card and
   sentence altitudes read the same blocks with no graph bundle.
9. **Validators** — `gate:register`, `gate:contrast`, `gate:motion`,
   `gate:icons`, `gate:fence`, `test:e2e` (visual baselines).
10. **Library primitives** — no new library. Blocks reuse `@xyflow/react`
    node/handle, the existing controls, and the existing edit runner.

## Rail palette (block-type read), register-mapped, meaning-carrying

Color carries meaning, never decoration; within a node the host domain tint
dominates and block-type is a secondary read (chip label + rail-dot stop):

| Block | Rail dot token | Why |
|---|---|---|
| Watch `match` / `threshold` | `--ij-agent` | watch domain |
| Watch `and_or` / `not` | `--ij-ink-info` | logical, neutral |
| Judgment `policy` | `--ij-room` | judgment domain |
| Response `prepare` | `--ij-ink-info` | neutral preparation |
| Response `verify` | `--ij-accent` | a pending check (verified cognition) |
| Response `action` | gold / accent / error | the permission grammar |
| Stake `stopping` | `--ij-graph` | stake domain |
| `custom` | `--ij-ink-disabled` | unthemed, honest |

Eight hues, all register tokens: agent, room, graph, accent, gold, ink-info,
error, ink-disabled. `custom` is deliberately the disabled/neutral stop.

## Impeccable bans + AI-slop check

- No side-stripe borders, no gradient text, no glassmorphism, no hero-metric,
  no identical card grid, no modal (the palette is an inline popover). Pass.
- **First order**: "proactivity graph → typed blocks" does not imply an
  IntelliJ Int UI register with domain-tinted rails; the aesthetic is pinned,
  not a training-data reflex. Pass.
- **Second order**: even given "not a SaaS card", the fork/merge rail language
  is the git-graph primitive the ledger already names, not an editorial pivot.
  Pass.

## Screen archetype

Configuration/authoring: dense, edit-first, all states designed (default,
loading, empty, error, disabled, degraded). Progressive disclosure: the node
face is compressed (chips + terminal action), the inspector aside is the full
editable stack. Fitts: the block-add affordance sits at the foot of the stack,
near focus. Hick: the palette offers only the host kind's legal types (n ≤ 5).

## Build checklist (all real, no fake UI)

- [x] **TB1** `blocks.ts`: `PgBlockType`, `PgBlock`, `blocksForNode(node)`
  decompile (watch/judgment/response/stake), `legalBlockTypes(kind)`,
  `isCompileOnly`, pure + unit-tested (`blocks.test.ts`, 10 tests).
- [x] **TB2** Model: added optional `type?: ResponseBlockType` and
  `branch?: 'then'|'else'` to `ActionStep`; extended the store `isStepArray`
  guard to admit them with validated values; no other field widening.
- [x] **TB3** Clock source: `life_clock` life kind + labels + the Clock-fed
  manuscript watch (`cadenceDays`) in the fixture; projection/edges/degraded
  already generic over sources.
- [x] **TB4** `BlockRow` + `BlockStack` render (register-grounded), typed rows
  with chip + rail dot; Response then/else fork rejoining at the terminal action.
- [x] **TB5** Block palette: grammar-constrained add; prepare/verify add a typed
  step, compile-only types open the IntentComposer via a scoped hint.
- [x] **TB6** Wired into the commit node face (dense) and the graph inspector
  (full); card altitude left on its flat controls (same fields, no drift).
- [x] **TB7** Verified: tsc, lint, five gates, 91 unit tests, three proactivity
  e2e; darwin baselines regenerated (linux harvested from CI).

## Named gap (honest state, not this turn's scope)

The wiring spec's GW3 (SSE `/api/proactivity/stream`), GW4 (ACP compile via
`@commonplace/theorem-acp`), and GW5 (server-side tenant module) are **not built
as server surfaces**: mutations run through the client `ProactivityStore`
(localStorage fixture), the compile path is the `stubForme` client compiler, and
there is no `src/app/api/proactivity/` route. This is the fixture seam at v0 (the
plan's explicit position), not a regression, but it is not the server wiring the
spec's channels 3–5 describe. Typed blocks are client-side per the plan and do
not depend on those channels.
