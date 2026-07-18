# HANDOFF-PROACTIVITY-GRAPH

Register: implementation record, landed. Implements SPEC-PROACTIVITY-GRAPH-SURFACE
as `apps/console` surface `console-proactivity`, descriptor `proactivity.graph`.
The editable proactivity graph: one programming surface, two authors.

## What is real vs fixture

The kernel (SPEC-AGENCY-PROPOSAL-KERNEL) and aliveness engine
(SPEC-ALIVENESS-ENGINE) are ABSENT as built code in this checkout (verify-first
V4 through V9: no Stake, EffectContract, Grant, back-index, standing-program, or
Forme type exists; the Rust workspace does not build here because it path-depends
on the absent sibling `Theorem/rustyredcore_THG`). Per the spec's sequencing
note, the surface is built entirely in TypeScript against fixtures behind a
stable seam, and lights up unchanged when the substrate lands.

- The kernel vocabulary is modeled from its specified field sets in
  `src/lib/proactivity/model.ts` (Stake AK1, EffectContract AK2, Grant, the AE6
  standing-query family, the ATMS label AK5.4, the exact-approval fields). This
  is the kernel's vocabulary projected, not a parallel model.
- `src/lib/proactivity/fixtures.ts` is the spec's own five-minute test: a stake
  with four assumptions (one prunable), a bounded-label stake, the four life
  sources, derived and authored watches, a human-authored trio compiled from
  "tell me when anyone I owe work to goes quiet", a no-grant send-email response,
  a granted response, and an over-budget response.
- `projection.ts` (PG1) assembles the tenant's structure into the renderable
  graph: edges derived from structural fields, degraded propagation, and every
  response resolved against its EffectContract, Grant, and standing budget.
- `store.ts` owns the local mutations (disable, parameter edits, prune, intent
  commit) as receipted, reversible edits persisted to localStorage.

## The seam that lights up

`ConsoleBlockHost` routes `pg.*` queries to `ProactivityStore.query` and
`pg.*` actions to `ProactivityStore.emit` exactly as it routes `hunk` to the
Rust wire. When the kernel lands, point those two branches at `this.http` and
delete the store; the view layer is unchanged. `object-bridge.ts` is the one
place a real kernel wire shape would normalize (mirrors `hunks/hunk-contract.ts`).

## Safety, held structurally

- The graph programs attention, not capability. The store's mutation vocabulary
  is disabled / pruned / parameter patches only: there is no code path that
  writes a Grant or an EffectContract (PG7 gate 2, tested).
- An edit cannot exceed the standing budget: an over-budget action-class edit is
  refused with the budget named (PG7 gate 3, tested); a no-grant class is
  permitted and renders "will ask you every time" (PG4).
- Every read and write is tenant-scoped; a missing tenant refuses via the
  ObjectSet notes channel, rendered as the unavailable state (PG7 gate 4).

## Verify-first V11: the graph library

`elkjs` (Eclipse Layout Kernel, `layered` algorithm), added to the ledger. It is
layout-only: it returns coordinates and the canvas renders every pixel through
register tokens (no bespoke canvas styling). Sources and assumptions pin to the
first layer, responses to the last, so watches land where both streams converge
(the join, named choice 8). The whole graph altitude, and elkjs, are code-split
behind `next/dynamic`, so the sentence and card altitudes load with no graph
bundle (PG3, verified in the build chunk separation).

## The one follow-up: linux visual baselines

The gate-5 visual job runs on `ubuntu-latest` and compares against `-linux.png`.
This branch commits the local `-darwin.png` baselines for
`proactivity-1440-dark` and `proactivity-graph-1440-dark`. The authoritative
`-linux.png` baselines must be generated under Linux: run the first CI pass,
harvest the `-actual.png` from the `console-playwright-results` artifact, and
commit them as `-linux.png` (the repo's established cross-platform baseline
workflow). All other gates are green locally: fence, register, contrast, motion,
57 unit tests, the full 22-test Playwright suite on darwin, tsc, eslint, build.
