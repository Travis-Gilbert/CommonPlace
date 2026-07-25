# SPEC-COMMONPLACE-FILING-AND-INDEX-1.0: implementation plan

Register: execution handoff. Every checklist row below carries a backreference to
the spec section it implements. Spec sections with no row are a planning bug.

Source spec: `SPEC-COMMONPLACE-FILING-AND-INDEX-1.0`. Companions in force:
`apps/console/CLAUDE.md` (the console constitution and the library ledger),
`docs/plans/console/14-HANDOFF-CONSOLE-DIMENSIONALITY.md` (the register this
surface is styled in), `docs/plans/console/10-HANDOFF-CONSOLE-IA.md` (named
choice 2 already reserves Index as a stripe surface), `docs/architecture/api-topology.md`
(two doors, one store).

## Grounded findings that shape the plan

Confirmed against source before writing, per the spec's own instruction to
confirm every named crate, seam, and surface.

1. **The Index surface already exists as a seeded slot, wired to nothing real.**
   `apps/console/src/lib/workspace-seed.ts:174-188` seeds `console-index`
   (stripe order 3) with a `Destinations` rail (`index.rail`) and a
   `Triage stream` editor currently pointed at the `record.table` descriptor over
   5000 deterministic fixture records. `apps/console/src/views/DocListView.tsx:78`
   renders the rail as an explicit unavailable state naming its missing
   capability verbatim: *"destinations (connectors and the filing engine, out of
   scope this round)"*. This spec is the named missing capability. The work is a
   descriptor wiring pass, not a new page: per the console constitution, "the
   shell never grows a bespoke page; a new surface is a descriptor registration."

2. **`apps/web` is not the front end this ships on.** The spec's frontend section
   says "CommonPlace repo `apps/web`". `apps/console/CLAUDE.md:11-13` states the
   canonical product host is `https://v2.theoremharness.com` (this console) and
   that `apps/web` is a legacy frontend. A structural eslint fence plus
   `scripts/check-import-fence.mjs` makes `apps/web` imports a CI failure here.
   The user's instruction ("wired into the front end styled in the console
   dimensionality register") resolves the ambiguity the same way. **F1 through F5
   land in `apps/console`.** This is the spec's intent met on the real surface,
   not a reduction: nothing in F1-F5 is dropped.

3. **The engine crate path in the spec is correct and buildable.**
   `rustyredcore_THG/crates/rustyred-thg-filing` sits in the sibling `Theorem`
   repo. `rustyred-thg-mcp/Cargo.toml:26,30,43,50` already path-depends on
   `commonplace`, `rustyred-thg-intake`, `rustyred-thg-vfs`, and
   `rustyred-thg-resolve`, so the MCP door (B7) reaches the engine with no new
   plumbing. `CommonPlace/apps/commonplace-api/Cargo.toml` is a bare-`[workspace]`
   Cargo root that already path-deps across the repo boundary into
   `../../../Theorem/rustyredcore_THG/crates/*`, so the GraphQL door (B7) adds one
   more path dep in the same idiom.

4. **The two `commonplace` crates have diverged; the filing crate must not bind
   either.** `CommonPlace/crates/commonplace/src/collection.rs` carries five
   `CollectionKind` variants and eight `Collection` fields that
   `Theorem/rustyredcore_THG/crates/commonplace/src/collection.rs` does not.
   `commonplace-api` links the CommonPlace copy. If `rustyred-thg-filing` bound
   the Theorem copy, two incompatible `Collection` types would meet in one
   binary. **Mitigation, and it is also the cleaner design:** the filing engine is
   id-typed and substrate-level. It moves `NodeId` into `CollectionId`; it never
   passes a `Collection` struct across the door. The spec's own signatures already
   work this way (`destination: CollectionId`, `item: NodeId`), and `SourceRecord`
   is filing-owned so adapters take an envelope rather than a foreign pipeline type.

5. **Coordination.** The `Theorem` working tree is clean (0 dirty paths) but sits
   on `claude/search-stack-impl`, ten commits ahead of local `main`, carrying
   another head's `SPEC-COMMONPLACE-SEARCH-STACK-1.0` work including
   "feat(find): GraphQL and MCP doors onto the composed find backend". Filing
   branches off that branch rather than off `main`, so the two stack cleanly in
   one workspace `Cargo.toml` and one MCP tool registry. Build on its edit; do not
   clobber or wait.

## Repository split

| Deliverable | Repo | Path |
|---|---|---|
| B1-B6 engine | `Theorem` | `rustyredcore_THG/crates/rustyred-thg-filing` |
| B7 MCP tools | `Theorem` | `rustyredcore_THG/crates/rustyred-thg-mcp` |
| B7 GraphQL | `CommonPlace` | `apps/commonplace-api` |
| F1-F5 surface | `CommonPlace` | `apps/console` |

Branches: `claude/filing-and-index` in both, based on `claude/search-stack-impl`
(Theorem) and `claude/console-dimensionality` (CommonPlace).

## Design laws to hold, and where each is enforced

Spec section: Design laws. These are not prose; each has a gate.

| Law | Enforcement |
|---|---|
| The arrival state is sorted; "pending review" is not a state | B5 `file()` is the one write path and always returns a receipt; no filing API can produce an unfiled item |
| Undo over approval; no approval queues | B5 `undo()`; F1 undo toast; the only consent flow is agent-*proposed rules* (B7), never items |
| No unread counts; no badges anywhere | F1 acceptance: component-tree check for zero badge or counter elements, added to the console e2e suite; B6 has no counter state |
| Filing is presentation; Find is truth | F3 renders the one-line law on first use; retrieval is untouched by this spec |
| Nothing destructive is ever automatic | B5 moves presentation only; no delete, no lossy archive anywhere in the crate |

## Register conformance for F1-F5

The console dimensionality register (`14-HANDOFF-CONSOLE-DIMENSIONALITY.md`)
governs every pixel of the Index surface.

- **Named choice 4, explicit ladder slot.** Every Index region declares its
  background token. The rail, the ribbon, the digest, the receipt popover, the
  rules editor, and the urgent lane each assert one. The X2 paint audit fails any
  region resolving to default white or transparent-over-body.
- **Named choice 3, depth is value, seam, and header, never shadow.** Shelves are
  separated by `--ij-seam`; raised surfaces meet on `--ij-seam-raised`. The
  receipt affordance is the one transient popover, so it is the one place a
  shadow token is legal.
- **X3.2, tool window headers.** The Destinations rail and the urgent lane each
  get the Int UI header strip: 24px, 13px title in ink, chrome background, bottom
  seam, right-aligned action slot.
- **X3.5, density.** Shelf rows and ribbon rows sit on the 24px rhythm; every
  padding is on the 4px grid, per `rec-structural.css`.
- **Named choice 2, components may not mint register tokens.** The Index uses
  existing `--ij-*` and `--rec-*` names only. `npm run gate:tokens` fails on a
  minted token, so a new one would have to be a reviewed manifest diff with a
  provenance line. Plan of record: mint none.
- **X5, empty-state architecture.** The urgent lane's empty state is the designed
  norm, so it gets the full X5 treatment: header, bounded frame, calm sentence,
  zero fixture content. Same for a shelf with nothing in it and the ribbon after
  it has emptied itself.
- **Named choice 5, stripe grammar.** The Index stripe icon stays monochrome on
  the ink ladder at rest with a weak-fill selected state. No badge, no dot, no
  saturated tile. The design law and the register agree here, which is the point.
- **Ledger rule.** Nothing is hand-rolled. Ledger rows are added for each new
  frontend need before its code is written (see the ledger table below).

## Library ledger rows this work adds

Per `apps/console/CLAUDE.md`: "A need with no row is a spec gap: add the row, with
a named source, before writing code." Rows are added to that file in the same
commit as the code that consumes them.

| Need | Source | Owns |
|---|---|---|
| Drag-to-correct on the recently-filed ribbon | `@dnd-kit/core` (already a ledger row for the Goal Stack's deferred-affordance drag and drop) | pointer and keyboard drag of a filed item onto a shelf, with the accessible drag announcement |
| Receipt popover | Radix Popover (already a ledger row under Workspace substrate) | the focus-managed transient "why is this here" surface, the one place a shadow token is legal |
| Undo toast | `motion` (`motion/react`) entrance on the interaction inventory plus the register's transient surface | the time-boxed reversal affordance carrying the receipt |
| Rules predicate editor rows | `cmdk` for predicate selection, register controls for values | rule authoring without a bespoke form framework |

Any row proven unnecessary at implementation is removed from this table rather
than left aspirational.

## Deliverable checklist, with spec backreferences

Every row names the spec section it implements.

### Backend

- **B1** envelope and source adapters (spec: Backend deliverables / B1). Six
  adapters, per-record skip with a counted skip, mail seam against a fixture
  transport.
- **B2** tier 0 precedent, rules, Sieve compiler (spec: B2, named choice 1).
  Golden-entity filing history through `rustyred-thg-resolve`; `compile_sieve`
  refuses non-mail predicates with a typed error. Script *deployment* per host is
  documented, not automated: the spec says so explicitly.
- **B3** tier 1 learned head (spec: B3, named choice 2, membrane clause in Named
  choices). Burn, per tenant, online actor-weighted updates, generation-stamped
  weights.
- **B4** tier 2 escalation (spec: B4, named choice 3). Ambiguity band only,
  budgeted, constrained decode, exhaustion never blocks arrival.
- **B5** receipts, correction bus, undo (spec: B5, named choices 4 and 5).
  Dismissal republish included.
- **B6** urgency lane (spec: B6, named choice 7). No counter state.
- **B7** doors (spec: B7, named choice 8 on agent participation). GraphQL and MCP,
  behind existing auth and grants.

### Frontend

- **F1** the Index surface (spec: F1). Shelves, ribbon, drag-to-correct, undo
  toast, time-box expiry, calm at 10 and 10,000.
- **F2** digest on demand (spec: F2). Pulled never pushed.
- **F3** receipt affordance (spec: F3). Three tiers, correction from the receipt,
  first-use law line.
- **F4** rules surface (spec: F4). Sieve preview, pending-consent pattern.
- **F5** urgent lane (spec: F5). Empty state as the designed norm.

### Reporting

- Final report per the spec's Reporting section: scannable status per deliverable
  with acceptance verified or not and how, leading with what is not done or not
  verified, including the tier-1 baseline margin and the badge-absence
  verification.

## Out of scope, as the spec declares it

The JMAP intake spoke itself, OS-level notification capture beyond the adapter
seam, correction-bus consumers other than tier 1, spaced or scheduled review,
auto-archival, and Sieve script deployment automation. These are the spec's own
exclusions carried forward verbatim, not deferrals invented here. Nothing else is
deferred.
