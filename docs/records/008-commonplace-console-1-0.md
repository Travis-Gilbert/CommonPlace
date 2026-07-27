# Record 008: CommonPlace Console 1.0

Status: Implemented with recorded integration limits
Plan: `commonplace-console-1-0`
Run: `commonplace-console-1-0-7ee7`
Source: `/Users/travisgilbert/Downloads/SPEC-COMMONPLACE-CONSOLE-1.0 (1).md`

## Objective

Ship one read-only data console twice from one Rust behavior core: a pinned
GPUI operator application and a consent-installed CommonPlace web block. Both
realms must show the same seeded records, counts, receipts, standing-query
events, and deterministic graph positions through authenticated doors.

## Baseline, target, and Do Not Downgrade

Baseline evidence is recorded in
`.harness/baselines/commonplace-console-1-0.json`. Existing web snapshots cover
the warm paper shell at 1280 and 1440 widths in light and dark themes. There is
no native screenshot baseline because `apps/console-native` did not exist.

The target is five surfaces in both realms:

1. Store overview with type counts, generation, readiness, and v1 rate charts.
2. Golden-record browser with merge details and doppelganger candidates.
3. Receipt browser with typed filters and bounded pagination.
4. Watch inspector with requested subscriptions, bounded events, and rates.
5. Graph neighborhood with shared deterministic positions and realm paint.

Do not downgrade the registered web tokens, shell anatomy, keyboard operation,
reduced-motion behavior, contrast, or the rule that surfaces are registered
descriptors rather than route-only islands.

## Architecture decision

### Considered

- Share only wire shapes while implementing behavior once in Rust and once in
  TypeScript.
- Link the core directly to RustyRed for native speed and add a browser API for
  the web realm.
- Share one transport-free Rust core and compile it for native and WASM while
  keeping credentials, transport, and paint inside each realm.

### Decision

Use one standalone `crates/console-core` Cargo root with serde domain types,
typed request and response envelopes, formatting, diffing, watch inspection,
and deterministic graph simulation. The core has no dependency on RustyRed,
GPUI, React, a browser, or a network client. Native and web adapters add
authentication to their own GraphQL and subscription transports.

This preserves the spec's honesty constraint: neither console can gain a
privileged store bypass, and fixture equality exercises the same serialized
contract in both realms.

## UI dependency decision

The native application pins:

- `gpui-component` v0.5.1 commit
  `0f0ab35233212f8f3277028995caf0c41e13ee6c`
- GPUI v0.2.2 commit
  `69e2130295c2649963eb639fc70b4f2ee8ea1624`

gpui-component owns DockArea, tables, charts, tabs, lists, inputs, dialogs,
buttons, and normal shell controls. A custom GPUI element is allowed only for
the graph canvas because the library does not provide that paint primitive.
The web graph uses cosmos.gl and consumes final positions from the shared core.

## External contract status

Two backend dependencies are implemented on audited Theorem branches but are
not present on the current Theorem mainline:

| Contract | Audited commit | Current integration claim |
| --- | --- | --- |
| Plugin GraphQL and slot doors | `440987aeaa5c60bab02d169ea71a7a3e0a3b9e3a` | Client contract and fixtures only until the branch lands |
| Standing-query FL0 model | `9277f07b9ee0b8f77e9b3fec304b0f3809c8d312` | Shared model and fixture watch proof only; no live GraphQL subscription exists on mainline |

Adapters must return a typed `unavailable` error when these operations are not
served. They must never compensate with direct graph-store access.

## Delivery and proof status

| Slice | Runtime | Product | Proof |
| --- | --- | --- | --- |
| B1 shared core and doors | Implemented | Shared runtime substrate | Host tests, wasm build, raw wasm parity, and dependency tree passed |
| B2 deterministic simulation | Implemented | Consumed by both fixture products | Deterministic host and wasm equality, GPU fallback equality, and recorded 5,000-node cost passed |
| B3 watch inspector | Implemented | Consumed by both fixture products | Ordered live delivery, millisecond rate window, burst bound, pause, resume, caller selection, and unsubscribe passed |
| F1 native console | Implemented against fixture door | Local operator product; live backend unavailable on mainline | Eleven Rust tests, machine-readable contract smoke, pinned dependency tree, real macOS launch, and interactive visual review passed with one pinned-library limitation recorded below |
| F2 web block | Implemented against the shared WASM fixture | Installed browser product; live backend unavailable on mainline | Seven package tests, 12 host tests, five-surface browser behavior, and reviewed screenshots passed |
| F3 Your data entry points | Implemented | Fresh, installed, denied, and uninstalled profile flows pass | Appearance and Index Rules browser paths passed through the normal consent surface |
| Cross-realm honesty | Implemented | Fixture product equality proved | Native and wasm use the same 4,789-byte snapshot, entity identities, counts, ordering, and settled position hash |

Runtime complete, Product complete, and Vision complete are reported
independently. A passing fixture does not prove that branch-local GraphQL doors
are deployed.

| Completion layer | Result | Boundary |
| --- | --- | --- |
| Runtime complete | Yes | Shared core, native renderer, WASM renderer, consent controller, adapters, and tests are implemented |
| Fixture product complete | Yes | Both local products expose the five read-only surfaces against the canonical seeded door |
| Live product complete | No | The audited plugin and standing-query contracts are still branch-local and no live backend was available for this worktree |
| Vision complete | No | Deployment, live subscriptions, saved native screenshots, mutations, administration, cross-tenant views, and query authoring remain outside this delivery |

### B1 proof evidence

The first independent review rejected the initial generation because `Door`
only modeled unary reads and because wasm equality had not been executed. The
revised generation adds a realm-neutral subscription request, sink, and
drop-scoped handle. The fixture door replays ordered events and proves that
dropping the handle unregisters the subscription.

The revised proof set is:

```text
cargo test --manifest-path crates/console-core/Cargo.toml
cargo check --manifest-path crates/console-core/Cargo.toml --target wasm32-unknown-unknown
cargo build --manifest-path crates/console-core/Cargo.toml --bin fixture-json
cargo build --manifest-path crates/console-core/Cargo.toml --target wasm32-unknown-unknown --lib
node crates/console-core/scripts/check-wasm-fixture.mjs <wasm-artifact> <native-fixture-binary>
cargo tree --manifest-path crates/console-core/Cargo.toml
```

The raw wasm parity runner instantiates the compiled module in Node, invokes
serde serialization inside wasm, and byte-compares its 4,789-byte fixture JSON
against the native binary output. This proves equality for the canonical
fixture without requiring generated browser glue.

### B2 and B3 proof evidence

The deterministic force simulation uses Barnes-Hut repulsion and
velocity-Verlet integration with stable node ordering. The fixture fingerprint
is `5604591119938928748` across repeated runs and native and wasm positions
agree within the declared epsilon. The explicit GPU feature currently uses the
named CPU fallback and proves equal fixture output. A debug 5,000-node step was
observed between 19.3 and 51.6 ms; this is proving-ground evidence, not a
release performance target.

The watch inspector keeps a bounded event ring, owns the realm subscription,
and aggregates rate buckets by millisecond. An independent review rejected the
first whole-second implementation because it could include events older than
the exact rolling window. The revised tests prove ordered delivery, exact
window edges, burst drops, pause and resume, filtering, and registry release on
drop.

### F1 native proving-ground evidence

`apps/console-native` is a standalone locked Cargo workspace. The selected
dependency tree contains GPUI v0.2.2 at commit `69e21302` and gpui-component
v0.5.1 plus assets at commit `0f0ab352`. The host does not have Apple's optional
Metal Toolchain installed, so the exact GPUI pin uses its `runtime_shaders`
feature. The debug build also enables rust-embed `debug-embed` so the component
SVG assets remain available when the binary is relocated into an app bundle.

The native contract smoke reports three golden entities, four receipts, four
graph nodes, three ordered watch firings, and the five surfaces declared by the
realm-neutral shell registry. It does not claim to initialize GPUI or inspect
the live dock; the separate macOS launch and interactive review provide that
evidence.

An independent review then found that the first entity table exposed only
merge and candidate counts, the receipt table omitted its typed controls, and
the watch list did not let the operator choose a shape. The revised native
surface adds row-driven entity detail with merge receipts, candidates, and
related receipts; kind and subject filters with two-row bounded paging; and an
explicit standing-query selector that replaces the active subscription. Model
tests cover all three paths before the rereview.
Interactive macOS review proved:

- The overview, receipts, and watch docks render together through
  gpui-component.
- Emitting a scripted firing updates the visible ring from three to four
  retained events.
- The graph renders four nodes, pan and zoom controls, and an Ada selection
  resolves `golden:person:ada` in the entity card.
- Collapsing the receipts dock writes `right_open: false`; a second process
  restores that structural layout with the bottom watch dock still open.

The visual review found and fixed two application defects. An identity-less
standing-query node was highlighted when both its golden ID and the selection
were absent. Layout persistence also depended too narrowly on upstream dock
events, which omit standalone center-tab and fixed-dock resize changes. The
application now uses a serialized write-on-change snapshot during workspace
render and derives the footer surface from that live state.

One pinned-library limitation remains. gpui-component v0.5.1 serializes the
center active tab, but `DockItem::active_index` updates the wrapper field rather
than the live `TabPanel` during restore. Structural docks restore, while the
center surface returns to Overview. This is recorded rather than hidden or
worked around with a divergent local fork. The final screenshot files still
need to be saved after the macOS visual host is unlocked; the interactive gates
were completed before the host locked.

### F2 web block evidence

`packages/console-block` owns the shared TypeScript contract, GraphQL request
documents, capability metadata, fixture layout, typed door adapter, and WASM
loader. The browser adapter validates every response before exposing it and
returns typed protocol or unavailable errors. The React renderer receives only
the realm-neutral snapshot and never imports `apps/web`, RustyRed, GPUI, a
credential, or an arbitrary network endpoint.

The descriptor registry mounts `commonplace.console` as a normal console
surface. The five tabs expose overview counts and readiness, entity merge and
candidate detail, receipt filters and bounded pages, caller-selected watch
shapes with a bounded firing ring, and the graph neighborhood. The graph uses
`@cosmos.gl/graph` 3.1.0 with the core's fixed positions, lifecycle cleanup,
pan, zoom, selection, and an accessible node list. Version 3.1.0 is deliberate:
the repository pins luma.gl 9.2.6, while cosmos.gl 3.3 requires luma.gl 9.3.6
and failed at runtime under the repository override.

The release WASM artifact is 728K and has SHA-256
`b1089463dc284f563366f58a07b48e7bddb619cb20b4b5982f4d0a4c26be86ea` in
both the SSD Cargo target and `apps/console/public/wasm`.

### F3 consent and entry-point evidence

Appearance and Index Rules share one `YourDataEntry` controller. First use
shows the purpose, authenticated CommonPlace door, exact `corpus:read` grant,
read-only boundary, denied operations, Allow, and Deny before data mounts. The
tenant-scoped versioned store rejects a missing or `default` tenant, survives
storage errors, opens installed users directly, and unmounts the descriptor on
uninstall. Primary sidebar activation is immediate and the pathname effect is
idempotent, so the secondary descriptor does not revert to the prior route.

The serial browser acceptance uses one deterministic profile and proves fresh
install, every surface, direct reopen without a second dialog, uninstall and
unmount, the unavailable secondary surface, Index Rules discovery, and denial.
It passes with reduced motion enabled.

### Cross-realm and visual evidence

The canonical fixture serializes to the same 4,789 bytes in native and raw
wasm32 execution. It contains generation 42, seven known nodes, four receipts,
two standing-query shapes, and the same three golden entity identities in the
same order. The native and browser console seed settles to position fingerprint
`10496215397300334112`. The lower-level deterministic simulation fingerprint is
`5604591119938928748` in native and wasm.

The reviewed browser snapshots are:

- `your-data-overview-1440-dark-darwin.png` at 1440 by 1000.
- `your-data-graph-compact-dark-darwin.png` at 1024 by 768.

They preserve the registered shell hierarchy and prove the installed Overview
plus the interactive compact Graph with selected entity detail. Native visual
evidence is recorded in `.harness/evidence/native-console-visual-review.md`.
The final native screenshot files remain unavailable because the macOS visual
host locked after the interactive review.

### Final gate matrix

- Core: 23 passed, one explicit 5,000-node benchmark ignored by default.
- Native: 11 passed with exact gpui-component and GPUI revision evidence.
- Console block: TypeScript check passed and seven tests passed.
- Console app: 175 tests passed; 12 focused host tests passed.
- Browser acceptance: one serial full-lifecycle test passed with both visual
  snapshots matching.
- Console gates: import fence, registration, contrast, motion, icons, token
  manifest, and island geometry passed.
- Focused lint: no errors; the expected TanStack React Compiler compatibility
  warning remains.
- Full repository lint remains red on six pre-existing React effect findings.
  The Sidebar finding is present at the same line in `HEAD`; this change only
  adjusts its route activation branch.
- Full app typecheck remains red on pre-existing Harness route narrowing and
  Jotai state typing errors. No new console-block or Your data path appears in
  that error set.

## Out of scope

Operator mutations, bulk administration, cross-tenant views, a query editor,
the terminal `thg top` surface, extra charts, and any privileged data path are
not part of this record.

## Implementation notes

- Considered duplicated realm behavior, direct native store linkage, and one
  transport-free core.
- Chose the transport-free core because it makes behavior equality testable and
  preserves authenticated-door semantics in both realms.
- Chose exact git revisions for the native UI stack so upstream movement cannot
  silently alter the proving ground.
