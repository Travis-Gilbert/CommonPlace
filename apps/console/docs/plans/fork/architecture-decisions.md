# SPEC-COMMONPLACE-FORK-1.0 architecture decisions

Date: 2026-07-27

Scope: `Travis-Gilbert/CommonPlace`, `apps/console`, FK1 through FK11.

Status: decisions recorded. Implementation and acceptance remain open. See
`acceptance-ledger.md` for evidence state.

## Source anchors

These decisions are grounded in the current local source, not only in the
handoff:

- `packages/block-view/src/types.ts` already defines `ViewSourceMode` with
  `fork` and requires `ViewDescriptor.source`.
- `packages/block-view/src/registry.ts` resolves descriptors by object shape,
  identifier, and block placement. It does not need to own a web route.
- `apps/console/src/app/v/[viewId]/page.tsx` still implements view-instance
  routing. It is a retirement target, not evidence that the fork routing is
  complete.
- `apps/console/src/views/registry.tsx` already registers the first modality
  surfaces, including records, model, canvas, thread, hunk review, and files.
- `apps/console/playwright.config.ts` and tracked snapshots establish an
  existing visual baseline. They do not establish fork parity.
- The current `rustyred-thg-catalog` migrations cover tenants, projects,
  billing accounts, auth principals, and cold index rows. They do not cover the
  full session, invite, role, membership, and API key model supplied by the
  fork.
- The current `commonplace-api` GraphQL schema exposes ingest through
  `IngestPipeline`. This branch upgrades its retrieval graph arm to core PPR
  and exposes the measured delta beyond flat candidates. The RustyRed product
  server on port 8380 exposes broader HTTP, gRPC, MCP, graph, vector, and PPR
  primitives, but does not invoke `IngestPipeline`.

## AD1: Keep Prisma for the first identity slice

Decision: keep the forked Express server's Prisma layer, pointed only at real
Postgres through PgBouncer. Do not point Prisma at RustyRed. Rust services keep
using `rustyred-thg-catalog`.

Reason:

1. The fork already implements multi-user auth, sessions, roles, invites,
   membership, and API keys through Prisma.
2. The current Rust catalog does not yet implement that whole model.
3. Removing Prisma now would require a new network API plus a full identity
   port before the fork can preserve its strongest inherited capability.

This is a shipping decision, not a permanent endorsement of two identity
clients. Re-evaluate after FK8 is live.

Migration rule: one owner per table. Before any migration runs, compare the
forked Prisma schema with `CATALOG_MIGRATIONS`. Catalog-owned tables must not be
created or altered by Prisma. Fork-only identity tables remain Prisma-owned.
Any overlap requires an explicit mapping or rename before deployment.

### Storage matrix

| Data | Postgres identity tier | RustyRed content tier | Rule |
| --- | --- | --- | --- |
| Users, auth accounts, sessions | yes | no | Login must not depend on graph availability. |
| API key hashes and scopes | yes | no | Secrets and identity claims stay outside user content. |
| Tenants and workspace identity | yes | scope reference only | Postgres owns membership. RustyRed owns the admitted `ScopeRef`. |
| Memberships, invites, roles | yes | no | Authorization is enforced before a graph request is made. |
| Billing | yes | no | Billing is identity administration. |
| Documents, extracted text, source metadata | no | yes | All uploaded material is user content. |
| Blobs, embeddings, collections, tags, graph edges | no | yes | `IngestPipeline` owns this write path. |
| Chat messages and conversation history | no | yes | Conversations are content and must survive an identity service restart. |
| Harness memory, plans, runs, receipts | no | yes | These are graph-native operational content. |
| UI preferences | preference-only local cache allowed | optional durable layout object | Local storage never becomes a work or content tier. |

### Outage states

| Postgres | RustyRed | Required behavior |
| --- | --- | --- |
| healthy | healthy | Full authenticated workspace flow. |
| healthy | unavailable | Login and membership checks work. The console renders workspace identity plus an honest content-degraded state. Content reads and writes are refused, not silently queued. |
| unavailable | healthy | New login, session validation, invites, and user content writes are refused because authorization cannot be proven. Graph state stays intact. A separately authenticated operator recovery path remains available. |
| unavailable | unavailable | The console reports both failures independently. No cross-tier repair or destructive migration is attempted. |

## AD2: One configurable content transport seam

Decision: the adapter depends on one `ContentTransport` boundary with two
operations: scoped ingest and scoped retrieval. Namespace resolution happens
before this boundary and supplies a server-derived tenant plus workspace scope.

Current driver: HTTP GraphQL to the configured `commonplace-api` content
endpoint. Current source shows that this is the only network surface that
directly invokes `IngestPipeline`; the branch now composes PPR retrieval there.
The endpoint and driver are configuration, not constants in
`server/utils/vectorDbProviders/rustyred/index.js`.

Current safety rule: the GraphQL driver refuses scoped ingest, count, and
retrieval unless `COMMONPLACE_UNSAFE_ALLOW_UNSCOPED_GRAPHQL=1` is set
explicitly. This is intentional. The current `commonplace-api` API key gate
does not yet consume the adapter's admitted scope headers, so the fallback is
only acceptable for single-scope validation and fixture work.

Future drivers:

- RustyRed HTTP or gRPC on port 8380 after scoped ingest and retrieval contract
  parity is proven there.
- Pgwire on port 6543 after the knn access method is wired and the result typing
  is sufficient for the adapter.

The adapter never reimplements embedding, classification, auto collection,
blob storage, entity resolution, or similarity edges in JavaScript. Retrieval
returns real passages, provenance-bearing sources, and the PPR-expanded result.
The flat top-N result is retained only as an evaluation comparator.

## AD3: The collector is a parsing peer

Decision: the collector stays a separate peer service. It parses bytes into
text and metadata. It neither authenticates end users nor writes RustyRed.

Inherited constraint: AnythingLLM Express and collector share the upload hot
directory, collector output storage, and a rotating RSA integrity keypair.
Express hardcodes the collector host, and development skips integrity
verification. The peer split therefore requires adaptation.

Request boundary:

1. The browser uploads to the Express server.
2. Express authenticates the user, authorizes workspace membership, and
   derives the tenant and workspace identifiers.
3. Express calls the collector over the private service network with
   service-to-service authentication and an immutable request correlation id.
4. The collector returns extracted text, metadata, and source facts.
5. Express calls the AD2 content seam, which invokes `IngestPipeline` with the
   server-derived scope and collector provenance.

The collector must reject unauthenticated peer calls and must not trust a
browser-supplied tenant or workspace. FK7 must make the collector URL
configurable, choose shared-volume semantics or a byte/blob upload protocol,
and replace implicit key-file sharing with explicit credential distribution.
The inherited `X-Integrity` contract can survive only if key rotation is made
stable across independently restarted services.

## AD4: The harness presents three bounded affordances

Decision: remove `aibitat` and expose exactly three harness affordances to the
model, regardless of tenant tool count:

| Affordance | Behavior |
| --- | --- |
| `catalog` | Returns a bounded, paginated set of capability summaries after tenant policy and suppression filtering. It is backed by Harness tool search, not eager `listTools()` flattening. |
| `describe` | Returns the input and output contract for one allowed capability identifier. |
| `invoke` | Re-checks tenant scope and suppression, invokes one described capability, and returns its result plus receipt metadata. |

The internal broker may enumerate provider tools for discovery, but it never
flattens every discovered tool into the model prompt. Existing
`@@mcp_{name}` naming remains, so the three visible names are
`@@mcp_catalog`, `@@mcp_describe`, and `@@mcp_invoke`. Existing per-tool
suppression is enforced inside all three operations, including immediately
before invoke. A harness chat turn also produces a run receipt; a tool result
alone is not that receipt.

## AD5: Pages route, blocks compose

Decision: App Router pages own URLs, auth boundaries, loading states, and page
regions. Blocks resolve through the descriptor registry and compose inside
those regions. A descriptor never creates or owns a route.

Page order:

1. Login and Invite
2. Onboarding
3. Workspace chat
4. Workspace settings
5. Admin
6. Surviving General Settings

The existing `apps/console/AGENTS.md` rule that a new surface is always a
descriptor is superseded only for route ownership by this spec. The block
contract, source ledger, register, materials, and persisted surface tree remain
in force inside pages.

`/v/[viewId]`, seeded view-instance navigation, and the palette as a page
navigator retire after each deep link has a page disposition. The palette may
still add or switch blocks inside the active page. Split geometry is content
layout and must persist through the surface object contract, not as an
unreceipted local-only work record.

## AD6: Fork attribution is explicit

Decision: every descriptor-derived component copied from
`Mintplex-Labs/anything-llm` declares `source.mode: "fork"` and records the
upstream repository, pinned import commit, and original path. Page, service,
and utility files that have no descriptor carry the same facts in the FK1
inventory and retain applicable MIT attribution in surviving files.

All imported UI is re-tokened to the console register. Attribution does not
permit upstream palette literals, provider selection UI, or a second design
system. No source file arrives before FK1 assigns it a verdict.

## AD7: Ordered modality surfaces

The order favors existing, testable contracts before new renderers. A source
file being present is not fork acceptance.

| Order | RustyRed modality | Console surface | What document-and-chat alone cannot show | Current truth |
| --- | --- | --- | --- | --- |
| 1 | Relational | `RecordTableView` | Typed columns, sorting, filters, groups, and record-level actions over a resolved object set. | Source exists and is registered. It is the first surface. Fork parity is not run. |
| 2 | Graph and schema | `ModelView` | Declared types, observed types, relations, and schema drift. | Source exists and is registered. |
| 3 | Spatial composition of graph objects | `CanvasView` | Persistent placement, typed relations, and multiple objects arranged as one surface. | Source exists and is registered. |
| 4 | Graph conversation | `ThreadView` | A conversation as linked content with objects, receipts, and provenance rather than a transcript blob. | Source exists and is registered. |
| 5 | Relational change and provenance | `HunkReviewView` | Typed field-level changes, source comparison, and receipted review decisions. | Source exists and is registered. |
| 6 | Hierarchical projection | `FilesView` | A project-aware projection of graph-backed objects and source paths. | Source exists and is registered. |
| 7 | Full text | Harvested Index search block | Ranked lexical evidence, query scopes, aspects, and a result constellation. | Blocked on CN5 harvest and live backend proof. |
| 8 | Vector plus graph rank | Retrieval neighborhood block | Flat similarity hits compared with PPR expansion, including score and provenance differences. | Design only. FK2 fixture and measurement are missing. |
| 9 | Temporal | Temporal slice block | Valid-time and event-time windows, change sequences, and state at a chosen instant. | No fork surface verified. |
| 10 | Geographic spatial | Spatial result block | Geometry, within and nearby relations, map extent, and location-aware evidence. | No fork surface verified. |
| 11 | Tensor | Tensor inspection block | Shape, axes, slices, and value structure that cannot be reduced to prose without loss. | No fork surface verified. |

## AD8: Harvest before retirement

CN5 is a hard precondition for FK11:

1. Record a verdict for every source in FK1.
2. Harvest `apps/web/components.json` behavior into a console-owned shadcn
   setup, re-tokened to the register.
3. Harvest the search frontend and its tests from the recoverable search-stack
   history.
4. Evaluate the porcelain OKLCH derivation without importing porcelain
   components or styles into the console.
5. Use the CN1 audit to harvest any `apps/web` view that is materially ahead of
   its console counterpart.
6. Build and test every harvested artifact in `apps/console`.
7. Audit browser-native, desktop, mobile, and collaboration consumers for
   runtime imports and parity tests tied to `apps/web`.
8. Only then remove `apps/web`, its service, old routes, and stale package
   references. Redirect and deployed browser behavior require separate live
   proof.

Current local precondition evidence:

- The CommonPlace search worktree exists at
  `/Volumes/SSD Samsung/var-18/CommonPlace/search-stack-impl-dcddc3`. It is
  clean and detached at `985fcc6`; the named branch points at `24d4b9b`.
- The Theorem branch `claude/search-stack-impl` exists, but no registered
  worktree is attached to it. The local branch is nine commits behind the
  cached `origin` ref. This blocks a claim that the original working tree was
  preserved.
- `apps/web/components.json` exists. `apps/console/components.json` does not.
- `apps/web` and `/v/[viewId]` still exist. Retirement has not started.

## UI visual milestone

### Baseline

The current console has tracked Playwright snapshots for workspace, chat,
files, hunk review, cards, proactivity, search field, appearance, and Goal
Stack states across relevant macOS and Linux baselines. A production
signed-out baseline captured from `https://v2.theoremharness.com/` at 1440x900
is filed at `evidence/production-signed-out-1440x900.png`. Authenticated,
populated, target, and do-not-change capture sets remain open.

### Vision delta

Target: preserve the existing IntelliJ shell, material register, mature chat,
and graph-native blocks while adding the inherited login, invite, onboarding,
workspace, settings, admin, upload, and embed workflows.

Current: the mature console routes and descriptors exist, but the inherited
pages, Express service, collector, and embed widget are not present in this
worktree. View-instance routing still exists.

The next implementation slice can establish inventory, service seams, and one
page composition. It will not establish end-to-end auth, durable upload and
chat, outage behavior, or visual parity.

Primary downgrade risks are replacing mature console surfaces with generic
fork UI, deleting `apps/web` before harvest, treating a nonblank page as
product parity, and confusing fixture-backed screenshots with live behavior.

### Reversible boundary

Keep the current route and renderer baseline available while each new page is
ported behind its API and content seams. Land page shell, data adapter, block
composition, visual parity, route switch, `/v` retirement, and `apps/web`
deletion as separate boundaries. The old path retires only after the new path
is equal-or-better for its workflow and the before, after, and target evidence
has been reviewed at matching states.
