# Search stack: reconciliation against the specs

Reconciled against `SPEC-COMMONPLACE-SEARCH-STACK-1.0` and `HANDOFF-SEARCH-CONSTELLATION`.
Branches: Theorem `claude/search-stack-impl`, CommonPlace `claude/search-stack-impl-dcddc3`.
Nothing is committed on either branch.

## Verified done

| Item | Where | Proof |
|---|---|---|
| B1 trigram candidate index | `rustyred-thg-core/src/index/trigram.rs`, `IndexKind::Trigram`, registered in `AccessMethodRegistry::with_native_defaults` | 11 tests, clippy clean |
| B2 exact lane | `rustyred-thg-find/src/exact.rs` | byte-identical to naive scan; zero store reads on empty candidates, proved by a read counter |
| B3 composed find | `rustyred-thg-find/src/{compose,lanes}.rs`; affordance `find.compose` in `theorem-harness-core/src/affordances.rs` | lane and scope attribution, lane disable isolation, stable ordering |
| B3 WebLane seam | `rustyred-web/src/find_lane.rs` | 7 tests; find crate has no dependency on rustyred-web |
| B4 graph relation annotation | `rustyred-thg-find/src/classify.rs` | contradiction edge returned; orphan on no connection; count identical before and after |
| B5 scatter + labelers | `rustyred-thg-find/src/{scatter,label}.rs` | k capped at 8; lambda moves mean pairwise centroid distance 0.50 to 0.83; scene renders through `scene_os_web::render_scene`; modelless run labels every node |
| B6 frontier PPR | `rustyred-web/src/frontier/{scorer,model,mod}.rs` | pop order matches precomputed PPR; budget exhaustion emits a complete `CrawlReceipt` |
| D1 constellation payload | `rustyred-thg-find/src/constellation.rs` | every edge carries reason type, worded text, evidence refs; caps hold; no similarity-only edges |
| F1 Find overlay | `apps/web/src/components/commonplace/find/`, mounted in `CoBrowserView.tsx` | scope stepper, byte-range to `TextTarget` conversion, highlight bridge, Escape |
| F4 one-click save (UI) | `find/SaveUrlButton.tsx`, mounted in `CoBrowserView.tsx` | renders the real collection name from the receipt, explicit error state otherwise |
| D2/D3/D5 constellation renderer | `apps/web/src/components/commonplace/scene-host/renderers/ConstellationRenderer.tsx`, registered under `force_graph` | deterministic layout, streaming without reshuffle, caps, gold memory nodes, five states, keyboard reachable |

Totals: `rustyred-thg-find` 69 tests + clippy clean under `-D warnings`; `rustyred-web` frontier 21 and find_lane 7; `commonplace-api` 43; `apps/web` 90.

## Not done

| Item | State | What remains |
|---|---|---|
| B7 GraphQL surface | **Partial.** Engine module `apps/commonplace-api/src/find.rs` compiles and passes 3 tests; `rustyred-thg-find` is wired into `Cargo.toml` and `lib.rs`. | The `find` query resolver, the `saveUrl` mutation, the `scatter`/`expand` resolvers, the `schema.rs` to `schema/mod.rs` rename, and the HTTP smoke tests. `rustyred-web` is not yet a dependency, so `web_consume_to_graph` is unreachable. |
| B8 MCP tools | **Not started.** | `find` and `scatter` tools in `rustyred-thg-mcp`: schema entry, `output_schema_for_tool`, `open_world_hint_for_tool`, dispatch arm, parity test against the GraphQL shape. |
| F2 scatter SERP wiring | **Done.** `apps/web/src/components/commonplace/serp/ScatterSerp.tsx`, mounted in `CoBrowserView.tsx`; store at `apps/web/src/lib/search-stack/store.ts`. | Backend `scatter` / `expand` resolvers (B7). |
| F3 lambda dial | **Done.** `serp/LambdaDial.tsx` on Base UI Slider, persisted per user via the store's zustand `persist` partialized to `lambda`. | Nothing. |
| F5 list page (layer two) | **Done.** `serp/AspectList.tsx`, mounted through the renderer's `listSlot`; one `FindResponse` feeds both the scene and the list. | Backend `find` resolver (B7). |
| D4 session start and docked map | **Done.** `serp/DockedMap.tsx` in `SessionRail`'s new `mapSlot`; origin written by `setBundleOrigin` in `apps/web/src/lib/carry/bundle-store.ts`. | Backend resolvers (B7). |

## Consequence worth stating plainly

F1, F2, F3, F4, F5 and D4 are mounted and tested, but the GraphQL `find` query, the `scatter` and `expand` queries, and the `saveUrl` mutation they call do not exist yet. `apps/web/src/lib/search-stack/client.ts` posts those documents unconditionally: there is no fixture mode and no mock-mode flag, so an unreachable backend renders the surface's honest error state rather than invented data. `fixtures.ts` is a test-only module, and `apps/web/src/lib/search-stack/__tests__/fixture-containment.test.ts` scans the tree to keep it that way. The UI is real and wired; the backend half of B7 is the gap.

## Named deviations from the specs

1. `find`, `scatter`, and `expand` take an execution context as their first argument. The spec writes `find(req)` / `scatter(query, k, lambda)`, which cannot reach a store, an index, or a Web lane; B2 and B4 both take the store explicitly, so the composed calls follow the sibling signatures.
2. `rustyred-thg-core/src/` is flat, so `src/index/` was created as a new module to honor the spec path `src/index/trigram.rs`.
3. `CanonUrl` and `LinkGraph` did not exist; both were introduced in `rustyred-web/src/frontier/`. `PprPrioritizer` was not rewritten on top of `PprFrontier` because two acceptance tests build `url` nodes with no `url` property; its per-node full-PPR-recompute bug was fixed in place with a memo instead.
4. llguidance has no in-repo wire format (`grammar: false` on every backend, zero `set_constraint` call sites). `MistralLabeler` sends the JSON schema as OpenAI-compatible `response_format` and re-validates the reply on receipt, falling back to `DeterministicLabeler` on any failure, never to a placeholder.
5. Scatter quantizes scores to 1e-4 on entry because `personalized_pagerank` is not bit-reproducible. Any code that hashes or caches a PPR-derived score in this substrate inherits the same trap.
6. Page facts (favicon, description, authors, citations, entities) are absent from `rustyred-web` today. D1 reads them from graph node properties when present and omits the field when absent rather than inventing one. Until a fact-extraction pass writes them, a live constellation connects results by domain and existing graph edges only.
7. F1 lands in `apps/web` rather than the spec's `apps/browser`: Theorem's `apps/browser` is a chrome-free Servo embedder with no UI layer, and `apps/desktop/src/*` is demoted by its own README. The live chrome is `apps/web` at `/commonplace`.
8. In-page anchoring is character-offset with prefix and suffix, not byte ranges. The conversion is a pure, unit-tested module at `apps/web/src/lib/search-stack/byte-range-target.ts`.

## Skipped by instruction

The hallway-test captures in HANDOFF-CONSTELLATION and HANDOFF-CONSOLE-IA, and any acceptance criterion requiring the user present.
HANDOFF-CONSOLE-IA was treated as a verification oracle only, per instruction; `apps/console` was not modified.
