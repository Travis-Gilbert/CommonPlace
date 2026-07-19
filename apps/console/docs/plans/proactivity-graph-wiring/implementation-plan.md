# Proactivity Graph Wiring — implementation plan

Implements SPEC-PROACTIVITY-GRAPH-WIRING (`~/Downloads/SPEC-PROACTIVITY-GRAPH-WIRING.md`)
in `apps/console` (deploy target v2.theoremharness.com). Companion to the shipped
surface on `claude/proactivity-graph-surface-ff36f5` (df79852) and to the
node-model answer (typed blocks). Branch: `claude/proactivity-graph-wiring`.

**Follow the spec.** The only reconciliation is the app it lands in.

## The one reconciliation: app home

The spec reads and targets `apps/web`. The surface and this wiring live in
**`apps/console`** instead, because console/00-DECISIONS.md #2 keeps `apps/web`
untouched (greenfield strangler; an eslint fence + CI gate forbid web edits) and
the console is the go-forward app (deploy alongside at v2.theoremharness.com,
decision #16). Everything the spec attributes to `apps/web` (React Flow, dagre,
next-auth-shaped tenant derivation, theorem-acp, block-view) is read as
"the app," and the app is `apps/console`. `apps/web` is never edited.

Two mechanical notes inside that reconciliation:
- **Layout: React Flow + dagre**, per the spec. The surface briefly used elkjs;
  it is migrated to `@dagrejs/dagre` (`views/proactivity/graph-layout.ts`), React
  Flow render unchanged. **Done.**
- **Tenant** derives server-side from the console's existing harness mechanism
  (the `src/app/api/harness/*` routes already do this), which is the console's
  equivalent of the spec's next-auth session-to-tenant map. No client tenant.

## The fixture seam (this is the point, not an anti-pattern)

The spec's fixture seam is the plan: `proactivityGraph` and the mutations resolve
against a **fixture at v0 and real harness objects at v1, identical shapes and
signatures, so the front end never changes**. This is fully wired end to end —
the surface reads the real projection channel, the resolver returns the fixture,
mutations flow through the real server actions returning receipts. That is the
opposite of fake UI: No-Fake-UI means *wire things end to end* (no dead buttons,
no inline mock arrays disconnected from a real path), which the seam satisfies.

Consequence: the harness not yet admitting a tenant is **not a blocker**. v0 is
fully buildable and validatable against the fixture; v1 swaps only the resolver's
backing when harness admission is resolved. `fixtures.ts` is the v0 backing.

## The four channels (spec, in console)

```
Browser (apps/console, React Flow + dagre)
  | client read ............ channel 1  proactivityGraph projection (fixture v0 / harness v1)
  | route handler (POST) ... channel 2  narrow enumerated mutations, receipts
  | EventSource ............ channel 3  /api/proactivity/stream, tenant-scoped relay
  | ACP client (hosted) .... channel 4  intent compile via @commonplace/theorem-acp
  v
Next.js server (apps/console, src/app/api/*)
  server-side tenant derivation (never client input) + server-only harness credential
  v0 fixture backing  ->  v1 harness (MCP HARNESS_URL/mcp + /api/theorem/* proxy)
  v  ONE projection fn (dual-door with the MCP tool)
```

## Deliverables (GW1–GW6, per spec; app = console)

- **GW1 projection read.** The `proactivityGraph` projection returns the
  denormalized render-ready graph (all six node kinds, edges, permission + budget
  resolved server-side, label-derived assumptions on stakes). One projection
  function; at v0 it reads the fixture, and its signature is the contract the Rust
  projection fn satisfies at v1. Tenant server-derived; refuses with no tenant.
  Client renders through React Flow + dagre, no client-side join logic.
- **GW2 narrow mutations.** Enumerated server actions / route handlers,
  zod-validated, tenant-derived, each returning a receipt, each reversible:
  `setNodeEnabled`, `setJudgmentClass`, `setJudgmentThresholds`, `setWatchSources`,
  `setWatchCondition`, `setResponseActionClass`, `pruneAssumption`,
  `commitCompilation`, `discardCompilation`. No generic patch. Selecting an
  ungranted action class succeeds -> `permissionState: ask-every-time`.
- **GW3 SSE overlay.** `/api/proactivity/stream` route handler (patterned on the
  existing `/api/harness/memory/stream`): authenticate, derive tenant, subscribe
  to the tenant proactive-event topic, relay `{firing_id, watch_id, fact_refs,
  touched_assumptions, stake_id, label_before, label_after, proposal_id?}`. Client
  `EventSource` lights the path from touched assumptions through watch, judgment,
  response. At v0 a fixture firing exercises the path.
- **GW4 intent compile.** Replace `forme.ts` `stubForme` compile with the real
  hosted ACP compile via `@commonplace/theorem-acp` `hosted-client` +
  `session-manager`, streamed through `state`, into a pending compilation reviewed
  before commit; commit/discard route to GW2.
- **GW5 tenant-derivation module.** The single server-side function mapping the
  session to a harness tenant + server-only credential, used by all channels. No
  channel accepts a client tenant; credential never serialized to the client;
  missing derivation -> harness-side refusal, not a default.
- **GW6 gates.** (1) no client tenant (structural), (2) no grant/effect-contract
  write on this door (structural), (3) credential containment (asserted), (4) one
  projection fn (asserted at v1; v0 signature contract), (5) fixture/real parity
  (the v0->v1 swap changes only the resolver's backing; client + channels
  byte-identical).

## Node-model (typed blocks) — carried alongside, client-side

- Blocks typed by host node (the grammar forbids cross-type drops): Watch =
  match/threshold/and-or/not/stopping; Judgment = policy; Response =
  **prepare/verify/action**; Stake = stopping; any = custom.
- **Clock source, not a cron block** (aliveness named choice 3): a Clock source
  beside Email/Calendar/Messages/Calls emitting temporal facts that join stakes.
- Custom blocks **compiled from intent** (Forme) by default, not hand-written.
- **Sentence-outside / blocks-inside:** the node label is the decompiled sentence
  of its block stack; the inspector shows the stack; edit either updates the other.
- **Commit-graph fork/merge** for the block stack (if/then is fork/merge topology).

## Sequencing

1. Layout to dagre (**done**), baseline regenerated.
2. GW1 projection read wired to `fixtures.ts` at v0 (surface reads the channel,
   not a direct import).
3. GW2 narrow mutations against fixture state, receipts, reversible.
4. GW5 tenant module (server-side) + GW6 structural gates.
5. GW3 SSE overlay (fixture firing at v0).
6. GW4 ACP compile.
7. Node-model typed blocks (design-gated for the block rendering). **Done.** The
   grammar (blocks typed by host kind), prepare/verify/action in Response, the
   Clock source (not a cron block), custom compiled from intent, sentence-outside
   / blocks-inside, and the git fork/merge for the response stack all ship as a
   pure decompile over the existing fields (`lib/proactivity/blocks.ts`,
   `views/proactivity/BlockStack.tsx`), so the fixture seam and the grant
   boundary hold. See `node-model-typed-blocks-design.md`. Verified: tsc, lint,
   five gates, 91 unit tests (10 new in `blocks.test.ts`), and the three
   proactivity e2e; darwin baselines regenerated (linux harvested from CI).
8. v1 swap: point the projection fn + mutations at the harness when admission is
   resolved. Front end and channels unchanged.
