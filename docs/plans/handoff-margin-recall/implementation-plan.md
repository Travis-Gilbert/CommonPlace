# HANDOFF-MARGIN-RECALL; implementation plan

Spec: `./HANDOFF-MARGIN-RECALL.md` (D1..D7). Layers on HANDOFF-COBROWSE-PRESENCE
(built here) and is the product UI of HANDOFF-AMBIENT-RECALL (upstream, absent).
Date grounded: 2026-07-13. Branch: `claude/handoff-margin-recall-spec-b19463`.

The markdown handoff is the human-readable view; this file is the executable
checklist. Substrate `plan` node not minted: remote coordination is
`remote_unavailable` and the Theorem substrate is absent (below), so the durable
plan surface is unreachable this session; the file projection is the plan.

## Verify-first findings (recorded before any code)

These are the spec's "Verify first" section, answered against THIS checkout.

- **VF1; Rust workspace does not build here.** Every crate path-depends on the
  sibling `/Volumes/SSD Samsung/var-18/Theorem/rustyredcore_THG`, which is
  **absent on disk**; `cargo metadata` fails. Consequence: no Rust task in this
  plan is `cargo`-verifiable in this checkout. Rust is authored to the vendored
  API + the TS contract and proven by the TS side; `cargo test` is a **named
  gap** on each Rust task, identical to how HANDOFF-COBROWSE-PRESENCE shipped
  (`docs/plans/cobrowse-presence/implementation-plan.md:32`). Node v22 + pnpm are
  present; the TS product layer is fully verifiable.
- **VF2; Rust spaCy port is ABSENT in checkout.** NER/sentence/noun-chunk live
  in the sibling substrate + a separate Python `research_api`. In-repo extractor
  primitives to bind D2's local tier to: `crates/commonplace/src/ingest.rs`
  `tokenize` (:1377), `extract_entity_mentions` (:1552), `resolve_entities`
  (:928). D2 uses these with honest degradation vs the sibling spaCy port.
- **VF3; AR0 (encode-path leak) has no referent in this repo.** No `AR0`, no
  ambient-recall stream, no encode-leak test anywhere. It is an upstream
  (HANDOFF-AMBIENT-RECALL) gate this checkout cannot close. **Honored, not
  cut:** the pipeline ships gated behind the recall dial (default **Quiet**) and
  the per-site policy; AR0 closure is named as the gate on Active / any
  user-reachable rollout. This is the one spec-imposed constraint we cannot
  discharge here; it blocks *rollout*, not *build*.
- **VF4; `extract_visible_text` returns flat `{url,title,text}`**
  (`apps/desktop/src/lib/commands.ts:141`). Resolving quotes→rects is a **new
  command family**, not an extension of that call. Because tabs are separate
  native Tauri `WebviewWindow`s ("no Servo sidecar",
  cobrowse-presence:10), in-page eval is the only geometry source for external
  pages; which is exactly the spec's permitted escape clause and keeps
  CDP-fallback parity (same geometry contract).
- **VF5; DATAWAVE is ABSENT in checkout** (`datawave` = 0 matches); reachable
  only as a sibling MCP tool. The exact field-fact tier degrades honestly (empty
  exact tier + named absence) when the substrate is not wired; the cosine tier
  (`apps/commonplace-api/src/discover.rs`, `block_view.rs`) is present and real.
- **VF6; the per-site capture policy D7 "binds to" DOES NOT EXIST.** No
  `SitePolicy`/`capturePolicy`, no per-origin gate. It is named as future work in
  `docs/plans/frontend-ownership-migration/implementation-plan.md:166`. **Built
  here, not deferred**; a per-origin policy store (SQLite kv + command pair,
  origin-keyed) is a task, because D7's acceptance ("per-site Off suppresses the
  pipeline for that origin") is otherwise unmeetable.
- **VF7; page-content hash cache is greenfield.** `blake3` is a declared-but-
  unused dep (`crates/commonplace/Cargo.toml`); blob hashing is sha256
  (`blob.rs:28`). BLAKE3 page hash is one call away; no result cache exists.
- **VF8; cold latency cannot be measured here** (no built local node). The
  salience route is instrumented so latency is recorded when the node runs;
  measurement itself is a named gap.

## Architecture decisions (owned, announced)

- **D-1 Two render paths, one geometry contract.** A shell-side React overlay
  cannot composite over an opaque native child webview, so: (a) CommonPlace's
  **own reader** (same-origin React DOM, `ReaderOverlay.tsx`) gets a true
  CommonPlace-owned overlay; (b) **external co-browse pages** get an in-page
  eval tint that extends the existing `tab_highlight` pattern. Both are
  positioned by the *same* D1 geometry contract, so the experience is
  engine-neutral exactly as the spec requires.
- **D-2 coannotate is the spine; the mount is new.** `packages/coannotate` is
  the headless framework-agnostic core (types, anchoring, cursor, GraphQL
  client) and paints nothing by design. The overlay *mount* (React, `apps/web`)
  that consumes it is the central greenfield component; D4/D5/D6 UI all hang off
  it.
- **D-3 Keeps + threads append to the carry bundle.** `handoff-carry` FD-C1
  names margin-recall as the upstream producer of "expanded highlights, Keeps,
  margin threads" consumed via the shared append API + one co-browse session id
  (`useCoBrowseSession.ts`, `lib/carry/bundle-store.ts`). D5/D6 Keeps/threads
  append there rather than inventing a sink.

## Named gaps (surfaced, not hidden)

1. `cargo test`/`cargo check` for every Rust task; blocked, sibling substrate
   absent (VF1). Proof = TS contract + vendored-API review.
2. AR0 closure + Active/user-reachable rollout; upstream, out of checkout (VF2).
3. Live end-to-end (real node + desktop shell + real page), cold-latency
   measurement (D2 acceptance), recorded live sessions; blocked, no built
   node/shell here (VF1/VF8). Proof = unit/contract tests + scripted fixtures.

## Checklist (stable ids; proof commands where runnable-here)

Proof shorthand:
`WEB` = `pnpm --prefix apps/web exec vitest run <file>`;
`WEBTC` = `pnpm --prefix apps/web exec tsc --noEmit`;
`CO` = `pnpm --prefix packages/coannotate run check && pnpm --prefix packages/coannotate run selfcheck`;
`RUST!` = `cargo test -p <crate> <name>`; **named gap (VF1)**, authored + reviewed only.

### D1; Contract additions (versioned command family)
Attach: `apps/desktop/src/lib/commands.ts` (contract), `apps/web/src/lib/desktop.ts`
(web bridge + guards), `crates/commonplace-desktop-runtime/src/lib.rs` (impl).

- [ ] **MR-D1-1** `resolveTextTargets(tabId, {quote, prefix?, suffix?, positionHint?}) -> RectSet[]`
  with per-result `confidence`. Contract in commands.ts (Rust name +
  eval-based impl comment), web guard in desktop.ts, honest mock. Acceptance:
  fixture page resolves known quotes to rects aligned with text. Proof: `WEB`
  (fixture resolver test), `WEBTC`, `RUST!`.
- [ ] **MR-D1-2** Viewport + scroll event stream (`marginrecall://viewport`,
  `marginrecall://scroll`) documented in commands.ts alongside the existing
  `cobrowse://*` events; injected listener → shell → web. Acceptance: an overlay
  rect stays glued to its passage across scroll. Proof: `WEB` (overlay-tracks-scroll test), `RUST!`.
- [ ] **MR-D1-3** `scrollToTarget(tabId, target)` command + bridge + mock. Proof: `WEBTC`, `RUST!`.
- [ ] **MR-D1-4** `pageIdentity(tabId) -> {url, title, contentHash(blake3)}`
  command + bridge + mock (VF7 blake3). Acceptance: identity stable across an
  unchanged revisit. Proof: `WEB`, `RUST!`.
- [ ] **MR-D1-5** Contract-parity test asserting the fallback (CDP) engine driver
  satisfies the same geometry contract (mock driver in TS). Proof: `WEB`.

### D2; Salience pipeline in the local node
Attach: new `apps/commonplace-api/src/salience.rs` (mirror `discover.rs`), wired
in `schema.rs` beside `discover` (:1805) + route in `serve.rs`; TS contract +
bridge in `desktop.ts`; extractor primitives from `ingest.rs`.

- [ ] **MR-D2-1** `SalienceCandidate { anchor(quote+position), tier(exact|semantic), explanation, score }`
  types; Rust + TS wire-parity. Proof: `WEBTC`, `RUST!`.
- [ ] **MR-D2-2** `salience.rs`: extraction (ingest.rs primitives, VF2) → IDF gate
  (in-repo term-frequency stub, honest-degrade vs Valkey) → semantic tier
  (cosine via `block_view.rs`/`discover.rs`) → exact tier (DATAWAVE seam,
  honest-degrade VF5) → scored candidates. Threshold + budget are config args,
  not constants. Acceptance: seeded-tenant fixture yields exact-tier candidates
  with complete explanations; no-connection page → zero candidates/zero UI.
  Proof: `RUST!` + TS contract test on the bridge mock (`WEB`).
- [ ] **MR-D2-3** Result cache keyed by page content hash (VF7). Acceptance:
  repeat visit to unchanged page hits cache. Proof: `RUST!`.
- [ ] **MR-D2-4** Latency instrumentation on the route (VF8, named gap for the
  measured number). Proof: code review.
- [ ] **MR-D2-5** AR0 gate honored: pipeline callable only when dial != Off and
  per-site policy allows; not auto-surfaced in Quiet (non-goal 4). Proof: `WEB`
  (gating test), cross-ref D7.

### D3; Annotation store (W3C Web Annotation shape)
Attach: `crates/commonplace/src/annotation.rs` + `store.rs`;
`packages/coannotate/src/types.ts` + `anchor-dom.ts` (lockstep wire-parity).

- [ ] **MR-D3-1** Extend `Anchor`/target to the W3C shape: source URL + quote
  selector + position selector + page content hash. Rust `annotation.rs` and TS
  `types.ts` in lockstep (VF: any drift breaks stored-JSON deserialization).
  Proof: `CO`, `RUST!` (`annotation.rs:159-303` seam).
- [ ] **MR-D3-2** Typed body (connection explanation | memory refs | model note),
  `motivation`, `actor`, timestamps on bitemporal edges (`store.rs` edge props,
  currently `json!({})`). Proof: `RUST!`, `WEBTC`.
- [ ] **MR-D3-3** Re-anchoring in `anchor-dom.ts`: exact hash match reuses stored
  rects; changed content re-resolves by quote with fuzzy position; below
  confidence → **orphan**. Acceptance: unchanged revisit survives; moved passage
  re-anchors; deleted passage → orphan (never a misplaced highlight). Proof:
  `CO` (extend `selfcheck-dom.ts`).
- [ ] **MR-D3-4** Orphan persisted in store + shown in the margin's collapsed
  session list, never highlighted. Proof: `RUST!`, `WEB`.
- [ ] **MR-D3-5** History replays from bitemporal edges. Proof: `RUST!`
  (`f3_api_acceptance.rs` seam).

### D4; Highlight overlay
Attach: new overlay mount (React, `apps/web/src/components/commonplace/margin/`)
consuming coannotate; reader surface `reader/ReaderOverlay.tsx`; external path
extends `tab_highlight` (`commonplace-desktop-runtime/src/lib.rs:668`). Tokens:
`--cp-tint-note` (gold), motion `commonplace-tokens.css:233`, reduced-motion hook
`usePrefersReducedMotion.ts`.

- [ ] **MR-D4-1** Overlay mount renders candidates as faint gold tint, fades in
  per motion tokens when the pipeline returns, no chrome until hover. Acceptance:
  highlights appear with no preceding loading indicator. Proof: `WEB`, `WEBTC`.
- [ ] **MR-D4-2** Budget cap (max 5) + exact-tier-first ranking. Acceptance:
  20-candidate fixture caps at 5. Proof: `WEB`.
- [ ] **MR-D4-3** Click-through: overlay intercepts input only on tinted regions +
  margin elements. Acceptance: interaction outside tinted regions unaffected.
  Proof: `WEB`.
- [ ] **MR-D4-4** Reduced motion renders static tint. Proof: `WEB`.
- [ ] **MR-D4-5** External-page path: extend `tab_highlight` to text-range tint
  from the D1 geometry (not element bbox). Proof: `RUST!`.

### D5; Margin notes and threads
Attach: overlay mount (margin surface); thread reuses
`views/AgentThreadView.tsx` + `lib/theorem-agent.ts` `runTheoremAgent`; data via
coannotate `annotation-client.ts` (`replyToAnnotation`, `annotationsForTarget`);
append to `lib/carry/bundle-store.ts` (D-3).

- [ ] **MR-D5-1** Each highlight owns a margin note in the physical margin when
  width allows; collapses to a gutter chip when not. Collapsed form = one line
  (the named connection). Acceptance: notes align across scroll + resize; narrow
  viewport degrades to chips without loss. Proof: `WEB`, `WEBTC`.
- [ ] **MR-D5-2** Replying continues an anchored thread via the chat agent route,
  with anchor + explanation as context; response lands in the thread, not a side
  panel. Proof: `WEB`.
- [ ] **MR-D5-3** Threads persist with the annotation + reappear on revisit.
  Proof: `WEB`, `CO`.
- [ ] **MR-D5-4** Margin overflow stacks into a compact per-page list ordered by
  document position. Proof: `WEB`.

### D6; Gestures and provenance expansion
Attach: overlay mount + cobrowse cluster reuse (`KeepToast.tsx`,
`ReceiptRail.tsx`, `useCoBrowseSession.ts`). Press-hold ring = net-new.

- [ ] **MR-D6-1** Hover → margin note preview (desktop); mobile tap → expand.
  Proof: `WEB`.
- [ ] **MR-D6-2** Short click → full connection: what/why (DATAWAVE explanation or
  memory atoms + edge path)/when, each referenced record openable (ReceiptRail
  pattern). Acceptance: complete openable provenance chain for both tiers. Proof:
  `WEB`.
- [ ] **MR-D6-3** Press-and-hold Keep with a progress ring filling ~450ms; release
  before fill cancels (no write); mobile long-press. Acceptance: interrupted hold
  does not write. Completion → gold graph-destination toast (reuse `KeepToast`).
  Proof: `WEB` (timer-driven ring test).
- [ ] **MR-D6-4** Dismiss affordance hides the highlight for this page + records
  the dismissal as a relevance signal (telemetry). Acceptance: dismissals land in
  telemetry. Proof: `WEB`.

### D7; Recall dial and per-site policy
Attach: dial mirrors `cobrowse/ControlSpectrum.tsx`; per-site policy store =
new (VF6) via SQLite kv + command pair (`commonplace-desktop-runtime/src/lib.rs`
`open_db`:1664, `harness_settings_set` pattern) + bridge; origin key
`apps/desktop/src/lib/routing.ts` `domainOf`. Params from `DiscoverConfig`.

- [ ] **MR-D7-1** Three-position dial Off / Quiet / Active (radiogroup, pointer-
  down, ARIA), default **Quiet**. Proof: `WEB`, `WEBTC`.
- [ ] **MR-D7-2** Positions change behavior: Quiet = exact tier only + higher
  threshold; Active = both tiers + standard threshold + one proactive margin note
  on highest-confidence connection (non-goal 4: only in Active, once/page).
  Acceptance: each position observably changes a fixture page. Proof: `WEB`
  (request-capture test modeled on `cobrowse.test.tsx`).
- [ ] **MR-D7-3** Per-site policy store (origin-keyed, durable). Dial binds to it;
  a site can be permanently Off. Acceptance: per-site Off suppresses the pipeline
  for that origin (verified by absence of node calls). Proof: `WEB`, `RUST!`
  (command pair).
- [ ] **MR-D7-4** Surface the dial + per-site control in the co-browse chrome +
  `DesktopSettingsView.tsx`. Proof: `WEBTC`.

## Non-goals (respected, from spec)
No editing/restyling page content (additive ink only); no cloud recall for local
tenants; no cross-user/shared annotations (single-tenant); no proactive margin
speech in Quiet (Active only, once/page).

## Session 1 status (2026-07-13)

Verified here (gate-exempt pure logic + contract):
- `packages/coannotate/src/text-quote.ts` (matchQuote / similarity / levenshtein /
  locateOffset): the D1/D3 geometry heart. PROVEN: `selfcheck:quote` green + `tsc`
  clean. Covers MR-D3-3's matching contract and MR-D1-1's resolver core.
- `apps/desktop/src/lib/commands.ts`: the D1 command family (resolveTextTargets,
  scrollToTarget, pageIdentity+blake3, `marginrecall://viewport|scroll` events) as
  typed contract + honest mocks (MR-D1-1..4). SOURCING-gated file was pre-existing;
  additive typed TS.
- `apps/web/src/lib/margin-recall/select.ts` (+ vitest): D4 selection (budget cap,
  exact-tier-first, orphan exclusion) for MR-D4-2. PROVEN via `node
  --experimental-strip-types` assert; the vitest is the project-convention harness,
  pending deps/disk (below).

New environment blocker; **VF9: machine disk is 100% full** (system 117Mi, SSD
4.0Gi free). `apps/web` npm deps are incomplete (`vitest/config` missing) so the
project vitest cannot start; pure logic was proven via node assert instead. Full
install/build and any cargo work need disk freed first. Same class as VF1.

Gated next (project design gate, `apps/web/CLAUDE.md`): the *visual* components
(D4 tint, D5 margin notes, D6 progress ring, D7 dial) are NEW visual surfaces; their
`.tsx`/`.css` require `superpowers:brainstorming` + design specialists + a design
proposal the user approves BEFORE code. Their *pure logic* (gesture reducers, dial
state → tier/threshold mapping, per-site policy resolution, salience/annotation wire
contracts) stays buildable + verifiable and is the next gate-exempt work.

## Session 2 status (2026-07-14)

Environment unblocked: ~84 GB reclaimed (VF9 cleared), `pnpm install` green, the real
toolchain runs. Design gate WAIVED by the user for this task, so the D4..D7 visual
components are now implementable without a design proposal.

Landed + verified this session:
- `packages/coannotate/src/quote-dom.ts` (+ `selfcheck-quote-dom.ts`): the D1 DOM half
  the matcher deferred to. `collectTextRun` / `rectsForMatch` / `resolveTextRects` /
  `browserTextNodes` / `resolveQuoteRectsInRoot` turn a matched quote into viewport
  rects over native `Range`/`TreeWalker`, through narrow injected interfaces (parity
  with `anchor-dom.ts`). PROVEN: `selfcheck:quote-dom` green, coannotate `tsc` clean.
  Completes MR-D1-1's resolver on the CommonPlace-owned reader path.
- Real vitest promoted: `select.test.ts` 5/5 in the project harness (MR-D4-2), no longer
  only node-assert. All 5 coannotate selfchecks green.
- Compliance: removed every em/en dash from this session's files (apps/web no-dash
  rule); every new `src` file carries a `SOURCING:` header.

Geometry spine of Slice A is COMPLETE + verified: `text-quote` (pure match) ->
`quote-dom` (rects) -> `select` (rank/cap/orphan-drop) -> `commands` (D1 contract).

Next (D4 overlay mount, ungated):
1. Bind coannotate into apps/web as `file:../../packages/coannotate` (matches the
   `block-view-contracts` pattern); confirm apps/web `tsc` follows its raw-`.ts`
   exports (`allowImportingTsExtensions` interaction).
2. `overlay-model.ts` (pure placement: compose `resolveQuoteRectsInRoot` +
   `selectHighlights`) + node `.test.ts`.
3. `MarginOverlay.tsx` + CSS module (faint `--cp-tint-note` gold, fade via motion
   tokens, reduced-motion static, click-through). Honest scaffold: NOT mounted into the
   live `ReaderOverlay` until D2 feeds real candidates (Slice C), per the no-fake-UI rule.

## Session 2 landed (2026-07-14)

Built + verified this session (all green: coannotate 6 selfchecks + tsc, apps/web tsc
0 errors, apps/web vitest 21/21 across select + overlay-model + hold):
- D1 DOM half `packages/coannotate/src/quote-dom.ts` (offsets to viewport rects)
  [MR-D1-1 TS resolver complete].
- D4 overlay: `apps/web/src/lib/margin-recall/overlay-model.ts` (placement: resolve +
  selectHighlights + clip) + `apps/web/src/components/commonplace/margin/MarginOverlay.tsx`
  + `MarginOverlay.module.css` (faint gold `--cp-tint-note` multiply tint, motion-token
  fade, reduced-motion static, click-through) [MR-D4-1..4 TS; MR-D4-5 Rust pending].
- D3 re-anchor `packages/coannotate/src/reanchor.ts` (unchanged-hash reuse /
  re-resolve-by-quote / orphan) [MR-D3-3].
- D6 hold reducer `apps/web/src/lib/margin-recall/hold.ts` (press/tick/release ->
  commit/cancel; an interrupted hold never writes) [MR-D6-3 safety core].
- coannotate bound into apps/web via `file:` dep + `allowImportingTsExtensions`.
- Every session file dash-clean; `SOURCING:` header on every new src file.

Verifiable-here remaining (NOT blocked): MR-D1-5 (CDP parity mock), MR-D4-1/3 WEB
tests for fade + click-through, MR-D3-1 (Anchor union `text_quote` variant; deferred
because it breaks consumer exhaustive switches, lands with the Rust store), D7
dial/policy pure logic, D5 margin-note placement math, D6 ring UI + provenance,
browser-preview of the overlay (needs D2 candidates to mount live per no-fake-UI).

VF1 RESOLVED (2026-07-14): the substrate was wired all along (symlink
`var-18/CommonPlace/Theorem` -> the real repo). The real blocker was one crate,
`rustyred-thg-reconstruct-fact`, present on Theorem `origin/main` but absent from the
local `Codex-Claude/joint-session` branch and used only by `commonplace/src/
reconstruction.rs`. Restored it from origin/main; `cargo check --manifest-path
crates/commonplace/Cargo.toml` compiles clean in 43.6s (target dir on the SSD). The
D1/D2/D3/D7 Rust is now cargo-verifiable here. Still to write: D4-5 external tint.

MR-D3-1 DONE (Rust + TS lockstep): `annotation.rs` gains `Anchor::TextQuote` +
`TextQuoteSelector` + `TextPositionSelector`; `types.ts` gains the matching variant
(snake_case `content_hash`) + parseAnchor/anchorLabel cases; `anchor-dom.ts`
resolveAnchorEl handles it. Wire-parity proven: `cargo test --lib annotation::tests`
4/4 (incl. `text_quote_anchor_round_trips_and_matches_ts_wire`), coannotate tsc +
apps/web tsc + 5 selfchecks all green.

MR-D1-4 primitive DONE: `commonplace/src/page.rs` `page_content_hash` (BLAKE3,
`blake3:<hex>`), the shared key for D1 pageIdentity + D2 cache + D3 anchor
`content_hash`. VF7 closed (blake3 dep was declared-unused). Proof: `cargo test --lib
page::tests` 1/1. Remaining D1 Rust: the `pageIdentity`/`resolveTextTargets`/scroll
Tauri commands in commonplace-desktop-runtime that wrap this + the coannotate geometry.

D7 site_policy WRITTEN (`commonplace-desktop-runtime/src/site_policy.rs`: `RecallPolicy`
+ origin-keyed sqlite CRUD + `resolve_effective` where site `Off` suppresses regardless
of dial; Tauri command pair `site_policy_get`/`_set`). Cargo verify surfaced two substrate
issues when building through commonplace-api: (1) FIXED, lockfile collision, our
`commonplace` bumped 0.1.0 -> 0.1.1 to disambiguate from the substrate's own `commonplace`
v0.1.0; (2) OPEN blocker, substrate crate `rustyred-thg-mcp` fails to compile (E0433
`HeadReliability` not found + E0308 type mismatch) on Theorem branch
`Codex-Claude/joint-session`. So `crates/commonplace` (D3) stays green, but
commonplace-api + desktop-runtime (D1/D2/D7 cargo) are blocked until `rustyred-thg-mcp`
compiles. site_policy logic is correct-by-inspection (standard upsert + unwrap_or), not
yet cargo-run.

MR-D3-2 DONE (green `crates/commonplace`): `annotation.rs` `BodyKind`
(connection_explanation | memory_refs | model_note) + `motivation` + Annotation
projection; `store.rs` `create_typed_annotation` (create_annotation delegates,
non-breaking). Proof: `cargo test --lib annotation::tests` 5/5. Green-crate D3
remaining (no substrate dep): MR-D3-4 orphan persist, MR-D3-5 history replay.

END-TO-END (substrate fully unblocked): MR-D3-4 DONE (annotation.rs `ORPHAN_KEY` +
`Annotation.orphan` + store.rs `mark_orphan`: orphan listed, never highlighted).
SUBSTRATE FIXED: patched 2 incomplete-edit compile errors in the Theorem repo
`rustyred-thg-mcp/src/lib.rs` `session_actor_head` (YOUR joint-session branch, fold into
your substrate work): (1) import `HeadReliability` (E0433); (2)
`capabilities: HeadCapabilities::from_labels(vec![..])` not raw `Vec<String>` (E0308).
Both evidence-backed (field types in agent_binding.rs + `charter_test.rs` oracle +
`from_labels` constructor). RESULT: `cargo test commonplace annotation` 6/6 +
`desktop-runtime site_policy` 2/2 GREEN. D1/D2/D7 cargo now UNBLOCKED; D7 VERIFIED.
Remaining Rust (unblocked): D1 Tauri commands (eval round-trip), D2 `salience.rs`
(unlocks overlay live render), MR-D3-5 history replay.

## Session 3 status (2026-07-16)

Substrate fully unblocked (prior session). This session drove the remaining unblocked work
end-to-end. All claims below are backed by a run, not inspection.

**D2 salience (DONE + verified).** New `apps/commonplace-api/src/salience.rs`: the pipeline
(passage segmentation with char offsets -> in-repo TF information gate -> exact tier = local
verbatim-title match, the DATAWAVE field-fact seam being the named-absent extension VF5 ->
semantic tier = `IngestPipeline::search` cosine with a lexical-overlap precision floor -> rank
exact-first, dedup by span, budget cap). Threshold + budget are `SalienceConfig` args;
`quiet()`/`active()` presets encode the D7 dial behavior (D7-2). Result cache keyed by page
content hash (D2-3) + compute-latency instrumentation (D2-4). Wired into `schema.rs` beside
`discover` as the `salience(pageText, mode, ...)` GraphQL query. TS wire contract + overlay
adapter in `apps/web/src/lib/margin-recall/salience.ts`. Proof: `cargo test commonplace-api
--lib salience` **7/7**; api crate compiles clean with the resolver (31s); `salience.test.ts`
**8/8**; apps/web tsc 0. [MR-D2-1..5]

**D3-5 history replay (DONE + verified).** `annotation.rs` gains `AnnotationEventKind` /
`AnnotationEvent` / `AnnotationReplay`; `store.rs` records an append-only, strictly-monotonic
`ANNOTATION_EVENT` edge on every create/reply/resolve/orphan transition, with
`annotation_history` + `replay_annotation(as_of_ms)` folding them. History replays from
bitemporal edges even though the comment item upserts to its latest state. Proof: `cargo test
commonplace --lib annotation::tests` **7/7** (incl. `annotation_history_replays_lifecycle_from_edges`;
the 6 prior tests unaffected). [MR-D3-5] D3 now complete (D3-1..5).

**D7 dial + per-site policy (DONE + verified).** Pure logic `recall-dial.ts` (RecallPolicy,
`resolveEffectivePolicy` mirroring the Rust `resolve_effective`, `recallBehavior` mapping each
position to run/mode/exactOnly/proactive), local dial store `recall-dial-store.ts`, `RecallDial`
component (radiogroup, pointer-down, ARIA, default Quiet) mirroring ControlSpectrum, desktop.ts
`sitePolicyGet/Set` bridge to the Rust `site_policy_*` commands, and a live "Recall" card wired
into `DesktopSettingsView`. Proof: `recall-dial.test.ts` in the margin-recall vitest **(6 files,
47 tests all green)**; apps/web tsc 0; Rust `site_policy` 2/2 (prior). [MR-D7-1..4]

**D5 margin notes (core DONE + verified; component scaffold).** `margin-notes.ts`
(`layoutMarginNotes`: order by doc position, anchor to highlight, stack on collision, chips when
narrow, spill overflow into a doc-ordered per-page list; `collapsedLine`) + `MarginNotes.tsx` /
CSS (honest scaffold, not mounted live until D2 feeds candidates, per no-fake-UI; impeccable
no-side-stripe honored). Proof: `margin-notes.test.ts` **9/9**; apps/web tsc 0. [MR-D5-1, MR-D5-4]
Remaining D5: MR-D5-2/3 (reply thread via the chat agent route + persistence) reuse the existing
AgentThreadView + coannotate annotation-client and are live-integration (named gap).

**D1 command impls (core DONE + verified; eval round-trip is the named gap).** New
`crates/commonplace-desktop-runtime/src/margin_recall.rs`: wire types (`Rect`/`RectSet`/
`TextTarget`/`PageIdentity`), `page_identity` wrapping `commonplace::page::page_content_hash`
(MR-D1-4, fully real: reuses the same server-side `fetch_text` source as `extract_visible_text`),
the injected-resolver builder `resolve_script` + `scroll_script` (self-contained DOM text search
-> `getClientRects` -> Tauri-IPC postback; MR-D1-1/3), and the `parse_targets_payload` sink.
Thin Tauri commands `page_identity` / `resolve_text_targets` / `scroll_to_target` /
`margin_recall_targets` registered in the shell. Proof: `cargo test commonplace-desktop-runtime
margin_recall` (5 pure tests). The eval dispatch + live-webview rect round-trip stays the RUST!
named gap (no webview here), exactly as VF4 anticipated.

**D4-5 external tint (FULL, closes D4).** `margin_recall.rs` `tint_script` extends `tab_highlight`
from an element bbox to a text-range tint over the D1-resolved rects (faint, click-through, mix-blend
multiply, tier-colored) + `clear_tint_script`; Tauri commands `tab_tint_targets` / `tab_clear_tint`
registered. Proof: `cargo test commonplace-desktop-runtime margin_recall` **7/7** (the 5 D1 tests plus
the two tint builders); desktop-runtime compiles clean. [MR-D4-5] D4 now complete (D4-1..5).

**D6-4 dismiss (FULL).** `apps/web/src/lib/margin-recall/dismiss.ts` reducer: hide-a-highlight-for-this-page
plus a page-scoped relevance signal, idempotent so telemetry never double-counts. Proof: `dismiss.test.ts`
**4/4** (in the margin-recall vitest sweep). [MR-D6-4]

**D6-1/2 gestures + provenance (core DONE + verified).** `interaction.ts` reducer (hover previews the
note, click or tap toggles the full connection, expanded outranks preview, and a stale leave cannot
blank the current preview) plus `provenance.ts` `connectionProvenance` (what it links to, why, and the
tier's evidence path, with an honest empty state when nothing is openable). `refs` now thread from the
salience wire through the adapter to the overlay candidate, so the openable chain actually reaches the
note (the adapter was dropping them; real gap, fixed). Wired into `MarginNotes`: hover to preview,
select to the expanded chain, each record openable through an `onOpenRecord` callback, with record
buttons rendered only when a real handler is supplied (no-fake-UI). Proof: `interaction.test.ts` +
`provenance.test.ts` **11/11**; apps/web **62/62** vitest (9 files) with tsc clean. [MR-D6-1, MR-D6-2]
Remaining for D6: the live demonstration (hover and click against a mounted overlay on real
candidates) and fetching each referenced record to show its `when` and title. Both are the standing
live-mount gap, not D6-specific work.

Named gaps unchanged from the spec's own list: live end-to-end (real node + shell + page),
cold-latency measurement (VF8), AR0 closure for Active rollout (VF3, upstream). The overlay +
margin notes remain type-clean scaffold, not live-mounted, until the desktop co-browse flow feeds
real D2 candidates.

## Execution slices (vertical, verifiable-first)
- **A; geometry + overlay spine**: D1 contract (MR-D1-*) + coannotate quote
  resolution + D4 overlay mount (MR-D4-1..4). Fully TS-provable here.
- **B; annotation store reshape**: D3 (types.ts/anchor-dom TS-provable; Rust authored).
- **C; salience**: D2 contract + bridge; overlay consumes candidates.
- **D; margin notes/threads**: D5 + carry append.
- **E; gestures**: D6 (press-hold ring, provenance, dismiss telemetry).
- **F; dial + policy**: D7 + per-site store; end-to-end gating.
