# Planning-Theorem Artifact: CommonPlace Frontend Ownership Migration

## Executive Summary

- Goal: Move every user-facing frontend owned by Theorem into CommonPlace while preserving Theorem as the harness and native capability provider.
- Intent: Stop product work from landing in legacy Theorem shells, port supported behavior into CommonPlace porcelain surfaces, preserve public URLs, and remove obsolete frontend deployments after verified cutover.
- Summary of work: Freeze new frontend growth in Theorem, reconcile the complete git spine, port product and specialty-client surfaces into CommonPlace, preserve `theoremharness.com` as a standalone marketing page, validate live behavior, and delete legacy shells only after rollback artifacts exist.

## Current Condition

The source-of-truth audit used Theorem `origin/main` at `4e5dc0094748f616b24804b3be95c816a875bc3d` and CommonPlace `origin/commonplace-v2-porcelain-surface` at `05e825828fab2615917159b7bd1acca186a26ac6`.

Theorem still contains these browser-rendered surfaces:

- `apps/harness-console`, including product, administration, browser, workspace, and marketing surfaces;
- `apps/desktop/src`, the legacy Vite product shell around native Tauri commands;
- `apps/commonplace-clipper`, a full browser extension frontend;
- `apps/copresence-editor`, a Vite collaboration frontend;
- `apps/obsidian-sync`, including user-facing plugin settings;
- `apps/theorem-ios` and `apps/ios/TheoremKit`, including SwiftUI application and search surfaces;
- `rustyredcore_THG/crates/scene-os-web/web`, a rendered Scene OS web layer; and
- smaller browser-sidecar and test fixtures that require explicit classification.

The July 11 audit found 48 non-merge commits touching frontend delivery since June 1. The existing `docs/plans/harness-console-migration.md` covers an earlier 26-commit snapshot and does not include all recent drift.

Live route checks on July 11 established:

- `https://theoremharness.com` returns the standalone Theorem's Harness marketing page;
- `https://app.theoremharness.com/commonplace` returns the CommonPlace product;
- `https://app.theoremharness.com/v2` returns the CommonPlace v2 Index surface; and
- `https://app.theoremharness.com/` currently returns the personal-site root, so product-root routing must be treated as an explicit cutover condition rather than assumed correct.

The active Theorem pull request queue was clean at audit time: PRs 145, 165, and 189 contained no frontend changes. The ownership problem is merged history and absent prevention, not an active unmerged UI branch.

## Intent

CommonPlace is the single repository for user-facing frontend work. Theorem supplies harness capabilities through stable contracts, APIs, GraphQL, MCP, ACP, proxy, receiver, and native sidecar boundaries. RustyRed supplies durable graph storage and search.

The marketing landing page is a presentation exception, not an ownership exception. Its source moves to CommonPlace, it remains outside the authenticated product shell, and its canonical public URL stays `https://theoremharness.com`.

## Goal

- User-visible outcome: All product, administration, browser, marketing, mobile, extension, plugin, and collaboration interfaces are built and released from CommonPlace.
- System behavior: CommonPlace consumes Theorem and RustyRed through explicit versioned contracts without importing legacy UI code.
- Data and model changes: None are required merely to move UI ownership. Missing typed contracts discovered during ports are added at the Theorem or CommonPlace API boundary and proven independently.
- Operational impact: CommonPlace owns frontend builds and deployments. Theorem frontend services are frozen, archived, and removed after route parity and rollback gates pass.
- What must not regress: `theoremharness.com`, CommonPlace product routes, browser capture, agent actions, memory operations, skills, rooms, runs, provider administration, extension identity, native mobile flows, local desktop behavior, and durable receipts.

## Ownership Rules

1. CommonPlace owns every user-facing component, page, stylesheet, extension UI, desktop web layer, and marketing page.
2. Theorem may retain native engines, protocol implementations, Rust crates, command handlers, test fixtures, generated schema, and documentation.
3. Theorem must not retain a second product shell for diagnostics. Diagnostics are CommonPlace surfaces backed by Theorem contracts.
4. No CommonPlace surface may import directly from Theorem frontend directories.
5. Ports reimplement behavior in the CommonPlace object-contract and porcelain systems. They are not bulk cherry-picks of legacy shells.
6. Mock-only behavior may not become reachable in the CommonPlace product.
7. Deletion is allowed in frozen Theorem frontend paths. Additions and modifications require an explicit migration exception until the paths are removed.

## Marketing URL Contract

The marketing surface is migrated under these fixed rules:

- Source ownership moves from Theorem `apps/harness-console/src/app/(marketing)` and `src/components/marketing` into CommonPlace.
- The public URL remains `https://theoremharness.com` before, during, and after cutover.
- The page remains a standalone landing experience. It does not inherit the CommonPlace authenticated shell, product navigation, operator layout, or product route hierarchy.
- Calls to action route deliberately to the correct CommonPlace product or documentation destination. Legacy `/canvas` links are not preserved unless they resolve to a supported CommonPlace route.
- Existing metadata, social previews, fonts, analytics consent, accessibility, and search indexing are captured before cutover and compared after cutover.
- DNS and Railway ownership change only after the CommonPlace-hosted candidate passes direct-host and custom-domain checks.
- Rollback is a domain reattachment to the prior marketing deployment or a pinned prior artifact. Rollback must not redirect visitors to `app.theoremharness.com` by accident.

The target source location is CommonPlace `apps/theoremharness-marketing`, a dedicated workspace app with its own build and Railway deployment target. It may consume shared CommonPlace packages and design tooling, but it must not import or render the authenticated product layout.

## Product Route Matrix

The CommonPlace porcelain product entry is fixed for this migration:

| Public request | Required behavior |
|---|---|
| `https://app.theoremharness.com/` | Permanent redirect to `/v2`, preserving query strings |
| `https://app.theoremharness.com/v2` | Canonical CommonPlace porcelain entry, HTTP 200 |
| `https://app.theoremharness.com/v2/*` | Stable product deep links, HTTP 200 or product-owned not-found state |
| `https://app.theoremharness.com/commonplace` | Compatibility entry retained through migration |
| `https://app.theoremharness.com/commonplace/*` | Existing deep links remain functional until each has a tested `/v2` replacement |
| Auth callback and API routes | Preserve exact callback paths, methods, query strings, cookies, and server-only credentials |
| `https://theoremharness.com/` | Standalone marketing entry, HTTP 200, no CommonPlace product shell |

The personal-site root currently served at `app.theoremharness.com/` is not the intended product behavior and must be removed from that hostname during FO-110.

## Codebase Grounding

| Area | Current evidence | Target ownership |
|---|---|---|
| Product web | CommonPlace `apps/web/src/app/(commonplace)`, `apps/web/src/app/v2`, and `apps/web/src/components/commonplace` | CommonPlace |
| Product desktop | CommonPlace `apps/desktop` Tauri shell wrapping the Next.js CommonPlace app | CommonPlace |
| Object-contract surfaces | CommonPlace `crates/commonplace/src/block_view.rs` and `apps/web/src/components/commonplace/surface` | CommonPlace |
| Generated scenes | CommonPlace `apps/web/src/components/commonplace/scene-host` | CommonPlace |
| Product co-browser | CommonPlace `apps/web/src/components/commonplace/views/CoBrowserView.tsx` | CommonPlace |
| Product browser substrate | CommonPlace `crates/commonplace-browser-substrate` | CommonPlace |
| Legacy console | Theorem `apps/harness-console` | Port, then delete |
| Legacy desktop web layer | Theorem `apps/desktop/src` | Port, then delete |
| Servo engine | Theorem `apps/browser` and `apps/browser-substrate` | Theorem capability behind CommonPlace adapter |
| Browser extension | Theorem `apps/commonplace-clipper` | CommonPlace `apps/commonplace-clipper` |
| Collaboration editor | Theorem `apps/copresence-editor` | Absorb into CommonPlace `apps/web`, `apps/commonplace-collab`, and `packages/coannotate` |
| Obsidian client UI | Theorem `apps/obsidian-sync` | CommonPlace `apps/obsidian-sync` |
| Native iOS UI | Theorem `apps/theorem-ios` and `apps/ios/TheoremKit` | CommonPlace `apps/ios`, with reusable non-UI clients pinned as contracts |
| Scene OS web renderer | Theorem `rustyredcore_THG/crates/scene-os-web/web` | Reconcile into CommonPlace scene host |
| Harness backend | Theorem GraphQL, MCP, ACP, proxy, receiver, and native crates | Theorem |
| Durable memory | RustyRed graph and search contracts | RustyRed, consumed by CommonPlace |

## Orchestration Map

| Work type | Route to | Why |
|---|---|---|
| Product IA and porcelain | CommonPlace `apps/web` | Canonical user-facing surface |
| Desktop packaging and web layer | CommonPlace `apps/desktop` plus `apps/web` | One product shell across web and Tauri |
| Harness contract gaps | Theorem backend crates and APIs | Theorem remains capability authority |
| Browser engine work | Theorem `apps/browser` | Servo remains isolated and harness-native |
| Page capture adapter | CommonPlace `crates/commonplace-browser-substrate` | Product writes through explicit graph deltas |
| Marketing | CommonPlace `apps/theoremharness-marketing` | Shared repository ownership, separate public experience and deployment |
| Extension and plugin clients | CommonPlace app directories | They are user-facing CommonPlace clients |
| Storage and retrieval | RustyRed contracts | Avoid frontend-owned storage logic |

## Migration Waves

### Wave 0: Ownership Freeze and Evidence

Freeze new product frontend work in Theorem before porting. Record the full commit-to-surface ledger, current screenshots, live route responses, deployment identifiers, custom domains, environment contracts, and artifact locations.

The Theorem guard must reject additions or modifications in frozen frontend paths while allowing deletions and explicitly reviewed migration fixes. It must run on pull requests and branch pushes.

### Wave 1: Shared Contracts and CommonPlace Host Readiness

Prove CommonPlace can call every required backend operation through its existing server-side adapters. Promote opaque payloads to typed contracts where needed. Register target CommonPlace view descriptors and renderer entries before porting features.

No feature is considered ported if it uses fixture data on a user-reachable route.

### Wave 2: Harness Product Surfaces

Port or reconcile the legacy console's supported product behavior into CommonPlace:

- memory list, search, graph, cluster, read, edit, archive, and forget;
- skills list, authoring, publishing, application, and the July 11 pack registry;
- Theorem chat and omnibar execution;
- workrooms, presence, messages, and coordination feeds;
- run history, event ledger, replay, receipts, and approvals;
- inbox and task state;
- API keys, providers, connections, usage, and claim onboarding;
- item domain and live changefeed;
- coding workspace, ACP transport selection, progress, and receipts; and
- markdown and document reading where the feature is not already present.

Each port uses CommonPlace renderers and live contracts. Legacy shell layout, mock fixtures, duplicate tokens, and experimental browser wrappers do not move.

### Wave 3: Browser and Desktop Product UI

Move all visible Theorem desktop browser behavior into CommonPlace:

- omnibar and explicit Theorem or Web destination control;
- browser launch and sidecar readiness states;
- tabs, chat links, Keep, capture policy, and per-site overrides;
- intake and Bayesian review UI;
- markdown Open With behavior;
- local or hosted tenant status and sync controls; and
- agent presence, cursor, Scene OS, and browser receipt surfaces with the explicit acceptance gates in FO-042.

Theorem may retain the Servo sidecar, native browser-use driver, and Tauri-callable capability until a later engine ownership decision. CommonPlace owns the controls and consumes a versioned command contract.

### Wave 4: Marketing and Specialty Clients

Move the standalone marketing page into CommonPlace while preserving `https://theoremharness.com` exactly.

Move the CommonPlace clipper, copresence editor, and Obsidian client UI into CommonPlace. Preserve browser extension identifiers, permissions, local storage schemas, update channels, signing inputs, and user data. Retain only reusable protocol and substrate crates in Theorem.

Move SwiftUI application and search surfaces into CommonPlace `apps/ios`. Reusable transport or model clients may remain published from Theorem only when they contain no user-facing views and are consumed through an explicit version pin.

Reconcile Scene OS web renderers into the CommonPlace scene host. Theorem retains renderer-neutral contracts and acceptance fixtures only.

### Wave 5: Cutover and Theorem Teardown

Run parity checks against real CommonPlace routes and live backend services. Switch domains and release jobs only after every required surface passes. Archive rollback artifacts, then remove legacy Theorem frontend apps, deploy configurations, package locks, tokens, and documentation entries.

Keep the Theorem ownership guard after deletion so a new legacy shell cannot reappear.

## Checklist

| ID | Task | Codebase grounding | Dependencies | Acceptance criteria | Validation | Rollback | Observability | Migration risk | Status |
|---|---|---|---|---|---|---|---|---|---|
| FO-001 | Freeze and reconcile the frontend inventory | Current Theorem tree and artifacts; full relevant git history; existing CommonPlace migration ledger | None | Every current frontend root, shipped artifact, browser sidecar, native UI, extension, plugin, rendered fixture, and relevant historical commit has PORT, RECONCILE, DROP, or RETAIN-CONTRACT disposition and a CommonPlace target | Compare current-tree surface inventory, release artifacts, deploy services, package manifests, and path-isolated git spine; fail on undisposed paths | Revert ledger only; no runtime change | Audit report records source hashes, current roots, artifacts, services, and missing paths | Missing an old or untouched surface loses behavior | planned |
| FO-002 | Add Theorem frontend ownership guard | Theorem CI and frozen path list | FO-001 | Additions and modifications to legacy product UI paths fail CI; deletions and approved contract fixtures pass | Positive and negative fixture tests for changed-file scanner | Disable required check while retaining script | CI annotation names blocked path and CommonPlace target | A broad rule can block legitimate native or test work | planned |
| FO-003 | Lock the product route matrix | Live `app.theoremharness.com` baseline and CommonPlace `/v2` and `/commonplace` candidate routes | FO-002 | The Product Route Matrix is approved, every current deep link and callback has a disposition, and the candidate host passes the matrix without changing production routing | Candidate-host HTTP, browser navigation, auth callback, and deep-link suite plus production baseline capture | Revert candidate routing configuration | Candidate status, redirect target, callback result, and route-not-found counters | Redirect loops or broken saved links | planned |
| FO-010 | Prove CommonPlace live contract coverage | CommonPlace theorem clients, GraphQL proxy, control center, operator, agent routes | FO-002 | Every ported surface has a typed live read and mutation path with auth and tenant handling | Local contract tests plus authenticated staging schema introspection, representative reads, mutations, tenant-isolation checks, and receipt verification | Keep old surface live until contract passes | Route health, source mode, request ids, tenant ids, and receipt ids | Opaque payloads create silent UI drift | planned |
| FO-011 | Register CommonPlace target surfaces | Object-contract registry and renderer map | FO-010 | Every product surface has a descriptor, renderer, and honest empty state | Registry load and renderer resolution tests | Remove new descriptors | Renderer fallback and missing-contract logs | Parallel route pages can bypass the object contract | planned |
| FO-012 | Close durable browser capture | CommonPlace browser substrate, CommonPlace API adapter, RustyRed graph | FO-010 | A real loaded page writes durable RustyRed state, returns a provenance receipt, survives restart, and is queryable from CommonPlace | Capture, restart, query-back, policy, and receipt acceptance against real local RustyRed | Disable capture adapter while preserving prior graph state | Capture id, graph delta hash, receipt id, query hit, and write failure | UI parity without persisted data | planned |
| FO-020 | Port memory | Legacy console memory and graph; CommonPlace Notes and Graph | FO-010, FO-011 | Live list, search, graph, cluster, read, edit, archive, and forget work with provenance | Component, API, and browser acceptance on real records | Route back to legacy memory until parity | Mutation receipts and retrieval source indicators | Data mutation fidelity | planned |
| FO-021 | Port skills and pack registry | Legacy Skills page and July 11 `PackRegistryList` | FO-010, FO-011 | List, read, author, publish, apply, and pack distribution work in CommonPlace | Skill publish and apply round trips plus registry refresh | Keep legacy Skills read-only | Publish and apply receipts | Publishing wrong version or tenant | planned |
| FO-022 | Port Theorem chat and omnibar | Legacy Dynamic Island and CommonPlace chat/operator | FO-010, FO-011 | Theorem execution uses the live agent route; no hidden mock or legacy route remains | Browser submit, stream, error, and receipt tests | Feature flag back to current CommonPlace chat | Run id, provider route, and receipt state | Duplicate omnibar semantics | planned |
| FO-023 | Port workrooms, runs, inbox, and tasks | Legacy Rooms, Runs, inbox, task board | FO-010, FO-011 | Presence, feeds, run ledger, replay, approvals, inbox, and task mutations are live | Multi-actor fixture server plus real local harness smoke | Keep individual CommonPlace views disabled | Run, room, message, approval, and task ids | Coordination ordering and stale state | planned |
| FO-024 | Port administration cluster | Keys, providers, connections, usage, claim onboarding | FO-010, FO-011 | Key lifecycle, provider validation, connections, usage, and claim flows work without exposing secrets | Auth, key, provider, and tenant boundary tests | Keep existing settings surfaces | Validation result, tenant, and audit receipt | Credential disclosure or cross-tenant access | planned |
| FO-025 | Port item feed and live changefeed | Legacy item domain; CommonPlace Index and Tables | FO-010, FO-011 | Live items and changefeed update CommonPlace without duplicate substrate models | API, stream, reconnect, and dedupe tests | Disable live overlay and retain durable data | Stream cursor and reconnect counters | Duplicate or missed events | planned |
| FO-030 | Reconcile coding workspace and ACP UI | Legacy `CodeWorkspaceShell` and ACP commits; CommonPlace `CodeWorkspaceView` | FO-010, FO-011 | Missing behavior is ported; duplicates are documented and dropped; provider selection and receipts are live | Commit-by-commit comparison plus browser acceptance | Disable added controls | ACP connection, run progress, and receipt state | Divergent parallel implementations | planned |
| FO-031 | Preserve markdown-theory reader work | Existing markdown-theory package work and legacy reader evidence | FO-002, FO-010, FO-011 | Publish the required package version, lock CommonPlace consumers, register the CommonPlace document reader, and render real stored documents | Package contents, registry version, lockfile, renderer, and real document acceptance | Pin prior package and disable renderer descriptor | Package version, renderer id, document id, and render errors | Supersession silently drops reader behavior | planned |
| FO-041 | Stabilize CommonPlace to Servo command contract | Theorem Servo sidecar and CommonPlace Tauri runtime | FO-010, FO-011 | Versioned commands cover launch, open URL, readiness, capture policy, shutdown, and errors | Rust contract tests plus packaged CommonPlace smoke | Pin prior compatible sidecar | Command version and compatibility logs | Sidecar protocol drift | planned |
| FO-040 | Port browser and desktop chrome | Theorem `apps/desktop/src`; CommonPlace `apps/web` and Tauri shell | FO-011, FO-012, FO-041 | All visible browser, intake, reader, tenant, sync, and launch controls live in CommonPlace and operate on durable state | Desktop build, packaged sidecar smoke, browser interaction tests, and capture query-back | Retain old desktop artifact until signed candidate passes | Sidecar readiness, launch receipts, capture receipts, crash and exit status | Native and web release skew | planned |
| FO-042 | Port integrated agent browser interactions | Theorem copresence, browser agent, Scene OS, and receipt contracts; CommonPlace co-browser and scene host | FO-012, FO-040 | Agent presence, cursors, anchored suggestions, Scene OS composition, and browser receipts have explicit renderers and live data; none are deferred behind readiness language | Two-actor browser session, anchored reflow, receipt, reconnect, and remote-DOM isolation tests | Disable individual renderer descriptors without disabling browser navigation | Actor, cursor, anchor, scene, receipt, and reconnect signals | Visual integration can outrun policy and provenance | planned |
| FO-050 | Move marketing while preserving `theoremharness.com` | Theorem marketing route and components; CommonPlace `apps/theoremharness-marketing`; live public URL | FO-002 | CommonPlace owns source; page remains standalone; URL, metadata, content, CTA behavior, accessibility, and indexing remain valid | Screenshot comparison, link crawl, metadata diff, Lighthouse or equivalent, direct-host and custom-domain smoke | Reattach domain to prior Railway service or artifact | HTTP status, route latency, asset errors, CTA analytics | SEO loss, broken CTA, accidental product-shell coupling | planned |
| FO-060 | Move CommonPlace clipper | Theorem `apps/commonplace-clipper`; CommonPlace target `apps/commonplace-clipper` | FO-002, FO-010 | Source and release pipeline live in CommonPlace; extension identity, storage, permissions, capture, upgrades, and downgrade-state compatibility are preserved | Chrome, Firefox, Safari builds; upgrade and rollback tests across existing and candidate releases | Publish prior extension build after proving it can read candidate-migrated state or restore a pre-migration backup | Capture receipts, extension version, upgrade and rollback failures | Extension identity or local data loss | planned |
| FO-070 | Absorb copresence editor | Theorem `apps/copresence-editor`; CommonPlace `apps/web`, `apps/commonplace-collab`, and `packages/coannotate` | FO-010, FO-011 | User-facing editor behavior is integrated into CommonPlace; the standalone Theorem Vite shell is unnecessary; protocol and CRDT behavior remain compatible | Two-client collaboration, reconnect, and conflict tests | Serve prior editor artifact | Session, peer, sync, and conflict counters | CRDT version skew | planned |
| FO-080 | Move Obsidian client UI | Theorem `apps/obsidian-sync`; CommonPlace target `apps/obsidian-sync` | FO-002, FO-010 | Plugin UI and packaging live in CommonPlace; vault state, sync compatibility, and downgrade-state compatibility are preserved | Plugin build, settings migration, vault smoke, reconnect, upgrade, and rollback tests | Restore a pre-migration vault and settings backup before reinstalling the prior plugin when backward reads are not guaranteed | Plugin version, sync cursor, migration version, and error receipts | Vault corruption or settings loss | planned |
| FO-085 | Move native iOS frontends | Theorem `apps/theorem-ios` and `apps/ios/TheoremKit`; CommonPlace `apps/ios` and `apps/mobile` | FO-002, FO-010 | Every SwiftUI application and search surface has a CommonPlace disposition; retained Theorem Swift modules contain no views; user flows and local state migrate without loss | Swift build and tests, simulator flows, state migration, deep links, and CommonPlace mobile regression | Retain prior signed build and state backup | App version, migration version, route, and crash reports | Duplicate mobile products or lost local state | planned |
| FO-090 | Reconcile Scene OS web rendering | Theorem Scene OS web layer; CommonPlace scene host | FO-011 | Product renderers live in CommonPlace; Theorem retains contracts and fixtures only | Scene package and renderer acceptance tests | Keep old renderer package unpublished but available | Renderer id, fallback, validation, and error state | Renderer contract mismatch | planned |
| FO-100 | Validate complete CommonPlace parity | All migrated CommonPlace surfaces | FO-020 through FO-090, including FO-031, FO-042, and FO-085 | Required routes work against live services with no legacy frontend dependency | Full web, desktop, iOS, extension, collaboration, plugin, accessibility, visual, durable-write, and live-contract suite | Stop cutover and keep legacy services read-only | Cross-surface release dashboard and receipt index | False parity from fixture or cached data | planned |
| FO-110 | Cut over product and marketing deployments | Railway, custom domains, CommonPlace releases | FO-003, FO-100 | `theoremharness.com` serves standalone marketing and `app.theoremharness.com` matches the complete Product Route Matrix | DNS, TLS, headers, redirects, deep links, assets, auth, and rollback drills | Restore previous domain attachments and artifacts | DNS, TLS, HTTP, redirect, route, auth, and asset monitors | Domain misrouting and cache persistence | planned |
| FO-115 | Cut over specialty-client distribution | Extension stores, plugin update channel, mobile distribution, copresence deployment | FO-060, FO-070, FO-080, FO-085, FO-100 | Current public or production channels serve CommonPlace-built artifacts; installs, upgrades, state migration, and rollback use those channels successfully | Install and upgrade from each real channel, verify source revision and signing identity, then execute rollback drill | Republish or restore prior signed artifacts and state backups | Store version, update URL, signing identity, install source, migration result, and crash state | Channels continue serving Theorem artifacts after source deletion | planned |
| FO-116 | Observe production cutover | Product, marketing, desktop, extension, plugin, mobile, and collaboration production channels | FO-110, FO-115 | Post-switch production samples complete with zero automatic rollback triggers and no dependency on a legacy Theorem frontend | Repeat the closure sample set against production domains and real distribution channels after cutover | Execute the named rollback operator actions from FO-110 and FO-115 | Production route, auth, capture, channel, crash, and receipt monitors | Pre-cutover tests miss production routing or distribution behavior | planned |
| FO-120 | Delete legacy Theorem frontends | Frozen Theorem UI paths and deploy services | FO-116 | Legacy apps, deploy configs, locks, and docs are removed after archive; backend contracts remain | Theorem workspace checks, doc drift check, CommonPlace regression suite | Restore archived source tag and deployment artifact | CI ownership guard and missing-import scan | Deleting a hidden consumer | planned |
| FO-130 | Close migration and retain prevention | Both repositories and harness memory | FO-120 | Maps, records, release docs, and ownership rules are current; no open UI PR targets Theorem | Repo audit and open-PR path scan | Reopen migration plan | Scheduled boundary audit result | Ownership drift returns later | planned |

## Dependency Order

1. FO-001 and FO-002 stop new drift.
2. FO-003 locks public product routing.
3. FO-010, FO-011, and FO-012 establish live CommonPlace contracts, rendering hosts, and durable browser capture.
4. FO-020 through FO-042 port the main product, reader, and browser surfaces.
5. FO-050 through FO-090 move marketing, iOS, and specialty clients.
6. FO-100 proves parity across the actual product surfaces.
7. FO-110 performs product and marketing route and domain cutover.
8. FO-115 switches specialty-client production channels to CommonPlace artifacts.
9. FO-116 proves the post-cutover production state with zero rollback triggers.
10. FO-120 removes legacy Theorem frontends.
11. FO-130 closes the migration and retains the ownership guard.

## Test Strategy

- Preflight checks: Record source commits, clean worktrees, open PRs, deployment ids, DNS, TLS, route status, extension ids, and current release versions.
- Focused tests: Renderer, component, contract, mutation, stream, command, extension, plugin, and CRDT tests beside each port.
- Integration tests: CommonPlace API to Theorem and RustyRed, CommonPlace Tauri to Servo, marketing direct-host to custom-domain, and upgrade paths for extension and plugin clients.
- Regression tests: Existing CommonPlace web, desktop, mobile, and API suites; Theorem backend and Servo suites.
- Type and static checks: CommonPlace TypeScript, lint, Rust checks, dependency boundaries, secret scans, and changed-path ownership guard.
- Manual smoke checks: Real CommonPlace product routes, packaged desktop browser launch, `theoremharness.com`, extension install and upgrade, two-peer collaboration, and Obsidian vault sync.
- Performance and security checks: Route startup, sidecar readiness, asset load, memory graph scale, auth boundaries, CSP, secret handling, extension permissions, and CRDT reconnect behavior.

## Cutover Closure and Automatic Rollback

FO-110 may start only after the release candidate records all of these samples without a critical failure:

- 100 consecutive HTTP and browser probes across the Product Route Matrix;
- 20 authenticated sign-in and callback cycles across fresh and existing sessions;
- 20 browser capture, restart, query-back, and receipt round trips against durable RustyRed state;
- upgrade and rollback fixtures for each supported extension, plugin, and native mobile state schema;
- direct-host and custom-domain marketing checks with matching metadata, assets, links, and screenshots; and
- packaged desktop launches covering current supported architecture and sidecar version combinations.

The cutover PR must name the release operator, rollback operator, prior deployment ids, prior artifacts, domain attachments, state backup locations, and the command or control-plane action for each rollback.

Rollback starts immediately if any of these conditions appears during the cutover probes:

- DNS or TLS resolves to the wrong service or certificate;
- `theoremharness.com` renders the product shell or changes its canonical URL;
- `app.theoremharness.com` violates the Product Route Matrix or loses query strings;
- an authentication callback fails, loops, or crosses tenant boundaries;
- a durable capture cannot be queried back with its receipt;
- an extension, plugin, or mobile migration loses state or cannot follow its tested rollback path;
- a packaged desktop cannot resolve or start its compatible Servo sidecar; or
- a required route serves fixture data, a personal-site page, or a legacy Theorem frontend.

After FO-110 and FO-115 switch production, FO-116 repeats the same sample set against the public domains and real distribution channels. Legacy source deletion is forbidden until those post-switch samples complete with zero rollback triggers.

## Production Gates

- [ ] The complete frontend git spine has a disposition and target.
- [ ] Theorem rejects new legacy frontend additions and modifications.
- [ ] CommonPlace routes use live data and honest empty states.
- [ ] No CommonPlace product surface imports Theorem frontend code.
- [ ] `https://theoremharness.com` remains the standalone marketing URL.
- [ ] Marketing metadata, indexing, links, and accessibility match or improve on the baseline.
- [ ] `app.theoremharness.com` matches the complete Product Route Matrix.
- [ ] Browser sidecar compatibility and packaged launch are proven.
- [ ] Extension, plugin, and copresence upgrade paths preserve user state.
- [ ] Production extension, plugin, mobile, and copresence channels serve CommonPlace-built artifacts.
- [ ] Post-cutover production samples complete with zero rollback triggers.
- [ ] SwiftUI and CommonPlace mobile ownership is reconciled with tested state migration.
- [ ] Durable browser capture survives restart and query-back.
- [ ] Rollback artifacts and domain reattachment steps are tested.
- [ ] Legacy Theorem frontends are removed only after live parity.
- [ ] Documentation and harness decisions encode the final ownership boundary.

## Epistemic Ledger

| Primitive | Entry | Evidence | Confidence | Action |
|---|---|---|---|---|
| Fact | CommonPlace is the canonical frontend repository | CommonPlace README and `docs/browser-migration.md` | high | Enforce in CI and plans |
| Fact | Theorem still contains multiple user-facing frontends | July 11 path and history audit | high | Port or delete each surface |
| Fact | New UI landed in Theorem on July 11 | Commits `03802716d` and `4e5dc0094` | high | Add to migration ledger and guard immediately |
| Fact | `theoremharness.com` is the live marketing page | Live HTTP response and user confirmation | high | Preserve exact URL |
| Fact | `app.theoremharness.com/commonplace` serves CommonPlace | Live route response | high | Retain and define canonical product entry |
| Gap | `app.theoremharness.com/` currently serves the personal-site root | Live route response | high | Resolve during FO-110 |
| Inference | A dedicated CommonPlace marketing entrypoint reduces product-shell coupling | Existing route groups and user requirement | medium | Validate deployment shape in FO-050 |

## Explicit Non-Goals

- Rebuilding Theorem or RustyRed backend capabilities merely because their UI moves.
- Cherry-picking legacy Next.js or Vite shells into CommonPlace.
- Redesigning the entire CommonPlace porcelain system as part of migration.
- Changing the public marketing URL.
- Folding the marketing landing page into the authenticated product shell.
- Deleting a legacy surface before its required behavior and rollback path are proven.

## Execution Instructions

- Start with FO-001, then land FO-002 before another product UI change can merge into Theorem.
- Preserve these invariants: CommonPlace owns all frontend source; Theorem owns harness and native capabilities; RustyRed owns storage and search; `theoremharness.com` remains standalone marketing.
- Use separate pull requests for the ownership guard, shared contracts, each product surface cluster, each specialty client, marketing cutover, and final deletion.
- Keep Theorem and CommonPlace base branches explicit. Do not stack UI ports on unrelated backend branches.
- Reconcile each task with evidence before changing its status.
