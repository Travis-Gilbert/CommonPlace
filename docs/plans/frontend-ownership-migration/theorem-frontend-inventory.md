# Theorem Frontend Ownership Inventory

## Audit Scope

This ledger is the FO-001 evidence artifact for the CommonPlace frontend
ownership migration. It classifies current Theorem frontend roots, native UI,
browser-rendered artifacts, extensions, plugins, fixtures, release artifacts,
and deployment services as `PORT`, `RECONCILE`, `DROP`, or
`RETAIN-CONTRACT`.

- Theorem tree audited: `origin/main` at `4e5dc0094` before the FO-002 guard
  merge. The guard subsequently merged as PR 190 at `30d1a976e`.
- CommonPlace deployment baseline audited: `origin/main` at `a027d5389`.
  Migration targets were reconciled against
  `origin/commonplace-v2-porcelain-surface` at `05e825828` as recorded in the
  canonical implementation plan.
- Historical window: path-isolated, non-merge commits from 2026-06-01 through
  2026-07-11, plus older roots still present in the current tree.
- Local-only code is not treated as shipped. It is identified separately.
- Deployment and release observations were captured on 2026-07-11.

## Live Delivery Baseline

| Delivery surface | Observed state | Migration significance |
|---|---|---|
| Railway `harness-console` | Online; deployment `cf4e7c52` succeeded on July 11; serves `https://theoremharness.com` | Marketing is live but coupled to the legacy console image |
| Railway `CommonPlace Web` | Online from deployment `3068d2c2` on July 10; three July 11 deployments failed; serves `https://app.theoremharness.com` | Cutover must use a known-good candidate and prove the route matrix |
| Railway `RustyRedCore - Theorem` | July 11 deployment succeeded | Durable graph service is available for live contract and capture tests |
| Railway `theorem-gateway` | Online on an older image; the current July 11 deployment series failed | Scene and browser contracts must be tested against the actual running revision |
| CommonPlace Desktop | Development-signed prerelease DMG, tag `commonplace-desktop-v0.1.0-devsigned.20260624` | Released desktop predates the current Servo sidecar configuration |
| Servo browser workflow | July 11 macOS build succeeded in Actions run `29161925632`; artifact is not in a released DMG | FO-041 must bind the sidecar contract before FO-040 packaging parity |

## Disposition Ledger

| Source surface or artifact | Current delivery truth | Disposition | Exact CommonPlace target and closure condition |
|---|---|---|---|
| `apps/harness-console` operator routes | Next 16 and React 19 Railway application; user-reachable because it shares the live marketing image | `PORT` | Register product renderers in `apps/web/src/components/commonplace/surface/surface-renderer-map.tsx`; route supported behavior through `apps/web/src/app/v2`; delete the wrapper after FO-100 and FO-116 |
| `apps/harness-console/src/app/(marketing)` and marketing components | Live landing page bundled into `harness-console` | `PORT` | Move source to `apps/theoremharness-marketing`; preserve `https://theoremharness.com` as a standalone deployment with no authenticated product shell |
| Legacy console `browser`, `canvas`, `workspace`, and `/Commonplace` preview routes | Experimental routes deployed incidentally with the console | `DROP` | First reconcile unique behavior into `apps/web/src/app/v2/{canvas,graph,work}` and the browser tasks; then remove duplicate routes |
| `apps/desktop/src`, `index.html`, design assets, public assets, and Vite manifests | Parallel Vite/React UI; current Tauri configuration consumes an external static export instead | `RECONCILE` | Use `apps/web/scripts/desktop-export.mjs` and `apps/desktop`; remove the parallel React shell after desktop parity |
| `apps/desktop/src-tauri` | Tauri 2 native runtime for local node, proxy, watcher, receiver, file-open behavior, and Servo sidecar | `RECONCILE` | Move surviving commands and packaging into `apps/desktop/src-tauri`; retain no Theorem-owned presentation layer |
| `apps/browser` | Rust Servo v0.3 executable and Tauri sidecar; Actions artifact only | `RETAIN-CONTRACT` | Keep the engine in Theorem; consume its versioned command contract from `apps/desktop/src-tauri/binaries/theorem-browser-*` and the CommonPlace Tauri adapter |
| `apps/browser-substrate` | Servo-free page, search, and session contracts; no independent user artifact | `RETAIN-CONTRACT` | Keep in Theorem; expose through the typed gateway consumed by `apps/web/src/lib/theorem-gateway.ts` |
| `scripts/dev/browser-sidecar` | Express and Playwright Chromium development fallback; no production deployment | `RETAIN-CONTRACT` | Keep as a test oracle; CommonPlace-owned acceptance fixtures belong under `apps/web/tests/browser-sidecar` |
| `apps/commonplace-clipper` | WebExtension plus Chrome, Firefox, and Safari build paths; local builds only; upstream Obsidian identities remain | `PORT` | Move to `apps/commonplace-clipper`; establish CommonPlace-owned store identities, signing, upgrade, and rollback workflows before deletion |
| `apps/copresence-editor` | Standalone Vite/Tiptap/Velt/Yjs prototype; not deployed | `RECONCILE` | Absorb supported UI into `apps/web/src/components/commonplace/compose/CommonPlaceEditor.tsx`, `apps/commonplace-collab`, and `packages/coannotate`; retain compatible CRDT contracts |
| `apps/obsidian-sync` | Installable Obsidian plugin with committed `main.js`, manifest `0.3.1`, and no marketplace release automation | `PORT` | Move packaging and UI to `apps/obsidian-sync`; preserve Theorem `upsert_note` and graph contracts as backend capabilities |
| `rustyredcore_THG/crates/scene-os-web/web` | Committed esbuild/D3 bundle embedded by Servo and `theorem-gateway` | `RECONCILE` | Move product renderers to `apps/web/src/components/commonplace/scene-host`; Theorem retains renderer-neutral scene contracts and acceptance fixtures |
| `rustyredcore_THG/crates/scene-os-web` Rust wrapper | Native scene packaging and rendering contract | `RETAIN-CONTRACT` | Keep in Theorem after the web presentation bundle is reconciled |
| `apps/theorem-gateway` scene service | Axum GraphQL and `GET /scene/{id}`; Railway is serving an older image | `RETAIN-CONTRACT` | Consume through `apps/web/src/lib/theorem-gateway.ts` and `apps/mobile/src/api/scene.ts`; fix deployment health separately from UI ownership |
| `apps/theorem-ios` SwiftUI application | SwiftPM and XcodeGen app with TestFlight shipping script; first upload recorded in `89bfe935` | `RECONCILE` | Port user flows into `apps/mobile/src/{app,api,notifications}`; retain the signed build and state backup until FO-085 and FO-115 pass |
| `apps/ios/TheoremKit/Sources/TheoremUI` and SwiftUI theme/resources | Older parallel SwiftUI implementation; no app release flow; last touched before June 1 | `DROP` | Extract required wire and scene contracts into `apps/mobile/src/api/{types,scene}.ts`; remove the UI target after parity |
| `apps/ios/TheoremKit` networking, reprojection, and wire models | Reusable non-UI Swift code | `RETAIN-CONTRACT` | Keep only modules still consumed through an explicit version pin; remove unconsumed duplicate implementations during FO-085 |
| `apps/theorem-harness-swift` | Rust UniFFI, SwiftPM library, generated XCFramework, and smoke apps; no hosted binary release | `RETAIN-CONTRACT` | Keep in Theorem; future CommonPlace native module target is `apps/mobile/modules/theorem-harness` |
| `rustyred-web/src/serp.html` and SERP examples | Embedded RustyWeb search visualization served by Servo and RustyRed | `RECONCILE` | Product presentation belongs in `apps/web/src/components/commonplace/views/LiveResearchGraph.tsx`; keep search and result contracts in Theorem |
| `design-check` self-contained HTML report | CLI/MCP report artifact, not a hosted app | `RETAIN-CONTRACT` | Keep report generation in Theorem; display receipts through `apps/web/src/components/commonplace/views/HarnessLivePanel.tsx` |
| Browser-rendered and static fixtures | Clipper templates, Scene OS harnesses, RustyWeb crawl fixtures, Servo parity JSON, and documentation screenshots | `RETAIN-CONTRACT` | Keep fixtures beside their owning contract tests; CommonPlace-only copies live below the relevant `__tests__/fixtures` root |
| Local-only `rustyredcore_THG/crates/commonplace-web` | Untracked React/Jotai/XYFlow, fixture-backed bundle; absent from `origin/main` and never deployed | `RECONCILE` | Do not ship another app; map any unique behavior into `apps/web/src/components/commonplace/surface` and then discard the local-only wrapper |

## Historical Commit Spine

The following path-isolated commit sets are the migration comparison spine. A
hash may appear in multiple groups when a change crossed surface boundaries.
The lists intentionally include review fixes and substrate changes that altered
the corresponding delivered surface, not only feature-title commits.

| Surface group | Non-merge commits since 2026-06-01 |
|---|---|
| Harness console and marketing | `4e5dc0094 03802716d ae43532ba fd459f2c8 fbcf9963a 538f7f84b ccd69699c 92be8ec27 cd21ba807 6a6750337 75140059c 756d61029 d79c215d4 9e7d0e4cb aa46e6805 9c7de1c31 78867f425 de97c7526 7d9dabf8b 2bf417353 82a21881d b41b694f0 80a91e392 1d39ab412 f2d32ccf7 c981032d7 239a2ab14 668a7d494` |
| Desktop web and native shell | `674c3f301 33d6e2305 e0fdb5345 5451994e9 0475e7425 92be8ec27 cd21ba807 55dd74af8 dab994b24 f4b521194 7858b6e4c 7d9dabf8b 82a21881d d98a22048 c2771d245 171ba25e0 c069995e0 eaaaeb5bf 887027eeb 0553a3f8e d7d694a4d 1c65be2ae` |
| Servo browser, substrate, and sidecar | `df8b7ebea 207fb7d97 674c3f301 8f34be9f3 b41b694f0 00012870d 1fd442a4f d7d694a4d a671692ad` |
| Clipper | `301fc37ca` |
| Copresence editor | `b41b694f0` |
| Obsidian plugin | `7679d4da1 27c1a3fb0 daa6d2c51 d1be40c6d 2af89aa42 146c69d5f` |
| Native iOS and Swift harness | `887027eeb e5c6856d3 e36c1f6f3 f003992a4 6b28b84cb ab7dc4f03 b74becf26 89bfe9356 aa050038b 7f117d4ba 03c8e04e4 1d7434f0d af166ab49 10a6fe520 10c1c4be4 6ce6ebc71 adcc153e8 dd33d9e74 7457b4e02 d86a07af4 24f21dbb0 74c71330a 51146906a 7b4f5cf9a 8f47672e4 26778f97f 179037a81 4faa0cd38 5d23c28f5` |
| Scene OS and gateway | `9c9f35205 7d9dabf8b 7679d4da1 08978704c 0588a74d9 42cb4539e` |
| RustyWeb and Design Scout rendered artifacts | `e49952a3d a4b2f22be 15cb40c54 756d61029 6fa455fd0 d1fd6b1dd f8c7dc912 170594c14 8fc845471 688181f43 03bed323a 2b70423e2 7d9dabf8b 31d60b1f8 c75042a8a f88ce814c 79bec6959 0d574f442 9c6a29514 a35fa73c7 42cb4539e 3bd2f250c 403a4c954 4dc7bbfa8 0c15f3144 887027eeb 00012870d 1fd442a4f 6f383275a d7d694a4d 77e1c0bfc a671692ad dd896774a bc6f04d72 9567e7d4c 9673fd651 6f088370c 113891d09 0bf9f6dac e75191170 f87c783b0 0e32ef511 1743b6771 5d1ca6527 5b929037e` |

The older `apps/ios/TheoremKit` root was inspected separately because its last
surface commit predates the June 1 window. Its older UI cannot be omitted merely
because it was untouched during the recent migration period.

## Validation and Follow-through

- FO-002 landed in Theorem PR 190 and blocks additions or modifications in the
  classified legacy UI roots while allowing deletions and non-UI contract work.
- FO-003 must capture every public route and callback before changing routing.
- FO-010 and FO-012 must use the actual running gateway and RustyRed revisions;
  the newest source revision is not necessarily the deployed revision.
- FO-041 must account for the released desktop tag predating the current Servo
  sidecar contract.
- FO-050 must split marketing source and deployment without changing its public
  URL.
- FO-115 must create real release automation for the clipper, Obsidian plugin,
  and mobile application before their Theorem sources are removed.

This ledger is append-only for newly discovered surfaces. A disposition may be
changed only with the replacement target, evidence, and closure task recorded in
the same change.
