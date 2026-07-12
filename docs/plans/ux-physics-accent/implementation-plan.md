# UX Physics + Accent: Execution Plan

Grounded execution plan for three linked specs, reconciled against the live monorepo
(`apps/web`, `apps/mobile`, `apps/desktop`, `crates/`) by three read-only scouts on
2026-07-11. The harness plan substrate was `remote_unavailable` this session, so this
file is the source-of-truth projection (per project convention "Plans Live On Disk").

## Sources (a spec tree, not three flat lists)

1. `docs/specs/SPEC-UX-PHYSICS-AND-ACCENT.md` (parent) — deliverables **UX-D1 .. UX-D8**.
2. `HANDOFF-MOTION-TOKENS.md` (child of parent D5) — **MT-D1 .. MT-D5**. Owns the motion numbers.
3. `HANDOFF-WAIT-LADDER.md` (child of parent D4 + D7) — **WL-D1 .. WL-D5**. Owns wait tiers + long-run jobs.

Where a child overlaps the parent, the child is authoritative: MOTION-TOKENS owns every
duration/curve that parent D5 gestures at; WAIT-LADDER owns the loading branch of parent D4
and extends parent D7's CI. The reconciliation below de-duplicates those overlaps so the
loading path and the motion vocabulary are each built once.

## Governing principles (from the parent, binding on every task)

Latency is the product (<100ms instant, <400ms flow). Local-first reads, network in the
background. Optimistic mutation, undo over confirm. Five states always (empty/loading/partial/
error/success). One accent: oxblood asks (action + pending decision), gold shows (harness
learned something), no third accent.

---

## Reconciliation snapshot (current state, file:line evidence)

| Deliverable | State | Key evidence |
|---|---|---|
| **UX-D1** accent resolution | **PARTIAL — token layer DONE this session** | `commonplace-tokens.css` + `-neutral.css` now resolve `--cp-accent`→oxblood (light) / oxblood-light (dark), interaction tokens repointed. Mobile `tokens.ts` already correct (`primary`=oxblood; `burntOrange` consumed by 0 components). REMAINING: action-surface components still on `--cp-red`/hardcoded `#A65324`; lint rule not added. |
| **UX-D2** local-first reads | **MISSING (mostly AWAITS-NETWORK)** | `commonplace-api.ts:135` `cache:'no-store'`; `useApiData:987` starts `loading=true`, no seed. v2 Index seeds a *fixture* (`index-queries.ts:382`), not a user replica. Studio editor is the only true offline-durable web read (Yjs+IndexedDB `Editor.tsx:378`). Mobile react-query SWR in-session but **no persister** (cold launch blocks). |
| **UX-D3** optimistic + undo | **PARTIAL** | Optimistic: web capture (`CommonPlaceSidebar.tsx:107`) + mobile capture SQLite queue (`capture/queue.ts:109`, strongest). MISSING: edit/approve-deny/pin-forget/swipes all await. **No rollback anywhere; no undo-toast** (sonner present, no action toasts). **graph-version inverse ops ABSENT on client** (only remote MCP via `commonplace-desktop-runtime/src/lib.rs:900`; core `block_view.rs:964` marks delete `Deferred` to an unimplemented host undo layer). |
| **UX-D4** five-state union | **MISSING** | No shared union. Best partial: `RecordSurface.tsx:24` (loading\|error\|ready). **No `partial` state anywhere.** WeaveSpinner duplicated on web. `v2/ledger/page.tsx` renders static SEED mock rows with no states. |
| **UX-D5** interaction crispness | **MISSING (superseded by MT)** | Nothing fires on pointer-down (all release). `--cp-spring-ease` defined (`:220` = `cubic-bezier(0.34,1.56,0.64,1)`) but barely used. `withSpring` = 0 hits on mobile. Reduced-motion solid on web/desktop (`usePrefersReducedMotion` in 28 files), thin on mobile (only `WeaveSpinner.tsx:35`). |
| **UX-D6** virtualization | **PARTIAL** | Web virtualized: IndexList, record-table, studio tables/timeline (`@tanstack/react-virtual`). NOT: `v2/ledger`, `v2/workrooms` feed, `networks/InboxFeed`, commonplace `ProjectListView`/`NotebookListView`/`TimelineView`/`AgentThreadView`. Mobile: virtualized via `FlatList`/`SectionList`; **FlashList dep absent**. |
| **UX-D7** latency budget in CI | **MISSING** | Only workflow is `rustyred-source-update.yml`. No Playwright, no web-vitals/INP, no size-limit. Vitest present. |
| **UX-D8** steal IA per screen | **MISSING (1 label)** | Only `TemporalEvolutionView.tsx:11` names an archetype ("Monitoring"). Run "Ledger" = Workrooms (`AgentWorkroomControlCenter.tsx:308`, fixture-backed), NOT `/v2/ledger`. Receipts + Approvals exist in Workrooms (`ApprovalCard`, `Receipt`), fixture-backed. No Linear/Railway/Stripe/PR-card naming. |
| **MT-D1** motion token source×3 | **MISSING** | No numeric motion scale in web CSS or mobile `tokens.ts`. Mobile inlines curves (WeaveSpinner 4 curves). No Reanimated presets module. |
| **MT-D2** consumption sweep + lint | **MISSING** | Components use ad-hoc `cubic-bezier`/durations. No motion lint. |
| **MT-D3** WeaveSpinner consolidation | **MISSING** | 3 copies: `island/WeaveSpinner.tsx`, `commonplace/views/WeaveSpinner.tsx`, `mobile/components/WeaveSpinner.tsx`. |
| **MT-D4** scroll conformance | **MISSING** | No `overscroll-behavior:contain` policy on panels/drawers/rails audited; verify no scroll-hijack lib in product routes. |
| **MT-D5** reduced-motion audit | **PARTIAL** | Web/desktop honor it; mobile gap. No screenshot audit in a visual suite (no visual suite exists yet). |
| **WL-D1** tier helper | **MISSING** | No T0/T1/T2/T3 helper. |
| **WL-D2** narration inventory | **MISSING** | No narration string module. Depends on external HANDOFF-AGENT-VOICE (linter) + HANDOFF-COBROWSE-PRESENCE (shared intent strings) — not provided this session. |
| **WL-D3** job conversion + run-ledger | **MISSING (backend partial)** | Harness emits run structure server-side; no client job card binding to `harness_step`. Mobile notifications module at `apps/mobile/src/notifications/index.ts` (verify caps). |
| **WL-D4** streaming discipline | **PARTIAL** | Ask/agent already streams via SSE (`ask-theseus.ts`, operator route). No T1→T2 pre-stream tiering; TTFT not recorded in receipts. |
| **WL-D5** CI extension | **MISSING** | Depends on UX-D7 trace job existing first. |

---

## Decisions (resolved 2026-07-11)

1. **Desktop accent register — UNIFY to oxblood** (user call). Repoint the `apps/desktop`
   `--accent` family (`--accent`, `--accent-soft`, `--accent-strong`, `--accent-memory`, light +
   dark blocks) to oxblood so oxblood owns action/focus there too; keep `--accent-agent` (ochre)
   as the machine/"shows" channel (it already plays gold's role) and `--danger` crimson unchanged.
   `--focus-ring: var(--accent)` follows automatically. Adds task **UX-D1.5**.

2. **Undo mechanism — implement real deletion + a reversible tombstone layer in the crate** (user:
   "we should probably allow for deletion"). `crates/commonplace/src/block_view.rs:964-979` returns
   `Deferred` for `Delete`/`Unlink`; the `Move` handler at `:985` already models the tombstone
   pattern (`{"detached": true}` + `ordered_children` skips it). Implement `Delete`/`Unlink` as real
   reversible tombstone ops returning `Applied` with an inverse descriptor; that inverse *is* the
   graph-version-style operation client undo restores from. Reshapes **UX-D3** (adds crate task
   UX-D3.0). Client undo then builds on real inverse ops, not only captured state.

The remaining choices keep their announced defaults (announce-and-proceed):

3. **Mobile FlashList (UX-D6).** RN `FlatList`/`SectionList` already windowing-virtualize the
   mobile feeds; the spec names `@shopify/flash-list`. **Default: adopt FlashList for the
   tens-of-thousands surfaces** (home feed, data lens list, room feed) per spec, since it names
   the tool and it meaningfully improves large-list perf. Announce-and-proceed unless objected.

4. **Motion easing redefinition (MT-D1).** MOTION-TOKENS sets `--cp-ease-out` =
   `cubic-bezier(0.2,0,0,1)` (current value is `cubic-bezier(0.16,1,0.3,1)`) and makes
   `--cp-spring-ease` an alias of `spring-snappy` (current `0.34,1.56,0.64,1`). Existing
   consumers shift. This is the handoff's explicit intent; **default: apply the redefinition**
   and record the old values. Announce-and-proceed.

5. **WL-D2 external dependencies.** Narration voice-linter (HANDOFF-AGENT-VOICE) and co-browse
   intent strings (HANDOFF-COBROWSE-PRESENCE) are referenced but not provided. **Default: build
   the inventory module + strings now**, wire the voice-linter interface as a stub that the real
   linter drops into, and note co-browse reuse as a follow-up when that handoff lands.

---

## Task ledger

Each task: spec backreference, current state, action, files, acceptance (from the spec), proof
command, risk. IDs are stable aliases (substrate ids would be minted on `plan create` when the
substrate is available).

### UX-D1 — Accent resolution corrected  (spec §D1, build-table row 1)

- **UX-D1.1 Token patch (web)** — *DONE this session.* Both `commonplace-tokens.css` and
  `commonplace-tokens-neutral.css`: `--cp-accent`→oxblood (dark register uses `--cp-oxblood-light`
  for ground visibility), added `--cp-accent-*` group, repointed `--cp-focus-ring`,
  `--cp-skeleton-shine`, `--cp-search-focus-border`, `--cp-ask-glyph`, `--cp-ask-save[-bg]`.
  Proof: grep shows `--cp-accent` defined only in the two token files (no shadowing). ✅
- **UX-D1.2 Mobile audit** — *DONE.* `tokens.ts` `primary`=oxblood; `burntOrange` unused. ✅
- **UX-D1.3 Action-surface component migration.** Move interactive-role consumers off
  `--cp-red`/hardcoded `#A65324` onto `--cp-accent`. Curated set (machine-signal usages stay
  burnt-orange): `commonplace.css` `.cp-btn-accent-dot:379`, save buttons `:9524-9526`, slider
  thumb `:2993`, toggle checked track `:3101`, primary/CTA `:882,:1029,:2989,:3283`, drag-drop
  targets `:1534,:3002,:3108,:6252`; components `InquiryBar.tsx:247` + `CommandBar.tsx:505`
  (capture focus stroke), `ObjectRenderer.tsx:200` (Pin), `ConnectionComposer.tsx:260`,
  `ObjectRow.tsx:194`, `BoardCanvas.tsx` focus glow, `AssumptionRegister.tsx:179/205`,
  `ArtifactBrowserView.tsx:33/539` action button. Leave: `--cp-type-person`, discovery, search
  chrome fill, error-red usages. Acceptance: action surfaces resolve #7A2733, machine surfaces
  #A65324, the two hues never on the same control. Proof: `npm run quality:commonplace` +
  targeted grep. Risk: over-migration of machine-signal usages — err toward leaving ambiguous.
- **UX-D1.4 Lint rule.** Add a `fail`-severity axis to `apps/web/scripts/commonplace-quality-audit.mjs`
  (`auditRawColors` already has the file-walk + allowlist machinery) forbidding
  `--cp-burnt-orange` / `#A65324` / `var(--cp-red)` on interactive-role selectors. Acceptance:
  lint fails a reintroduced alias on an action selector. Proof: add a fixture, run
  `npm run quality:commonplace`, expect exit 1; remove fixture, expect 0.
- **UX-D1.5 Desktop accent unification** (Decision 1). In `apps/desktop/src/styles/tokens.css`,
  repoint `--accent`/`--accent-soft`/`--accent-strong`/`--accent-memory[-soft]` in both the light
  `:root` and the `@media (prefers-color-scheme: dark)` block from burnt-orange to oxblood (light
  `#7A2733` family; dark uses a brightened oxblood meeting the file's stated dark contrast target,
  as the file already brightens its accent for the dark ground). Keep `--accent-agent` ochre (the
  "shows"/machine channel) and `--danger` crimson unchanged; `--focus-ring: var(--accent)` follows.
  Update the file header comment to describe oxblood as the action pencil. Audit `apps/desktop/src`
  for any hardcoded `#A65324` on action surfaces. Acceptance: desktop action/focus resolve to
  oxblood; agent/ingestion stay ochre; destructive stays crimson. Proof: grep + visual check in the
  Tauri dev shell.

### UX-D2 — Local-first read contract  (spec §D2, row 2)

- **UX-D2.1 Persisted read cache + SWR in `useApiData`.** Add an IndexedDB-backed last-value
  cache keyed by request; `useApiData` seeds from cache synchronously (`loading=false` when a
  cached value exists) and revalidates in the background without clearing/jumping. Files:
  `commonplace-api.ts:127` (`_doFetch` cache), `:987` (`useApiData`). Acceptance: with network
  delayed 2s, listed surfaces open + are interactive within one frame; refresh does not clear/jump.
- **UX-D2.2 v2 Index real replica.** Replace the static fixture seed (`index-queries.ts:382`)
  with the persisted replica from UX-D2.1 (removes fixture-as-seed; honors no-mock rule).
- **UX-D2.3 Mobile react-query persister.** Wire `persistQueryClient` with the already-present
  AsyncStorage at `apps/mobile/src/app/_layout.tsx:33`. Acceptance: cold launch renders cached
  feed within one frame, then revalidates.
- **UX-D2.4 Data lenses / room feed / coordination SWR.** Route `ClusterLens`/`TimelineLens`/
  `VectorSpaceView`, `CoordinationView`, `workrooms`, `operator` reads through the cached path.
- **UX-D2.5 Studio settings reads.** Make the SSR settings reads stale-while-revalidate (render
  cached, refresh) or document why config pages are exempt. Acceptance per spec: every listed
  surface interactive in one frame on local data under a 2s network delay.

### UX-D3 — Optimistic mutation and undo  (spec §D3, row 3)  [Decision 2: real deletion + tombstone]

- **UX-D3.0 Reversible deletion + tombstone layer (crate).** In `crates/commonplace/src/block_view.rs`,
  implement `ObjectAction::Delete` (`:964`) and `ObjectAction::Unlink` (`:972`) as real reversible
  tombstone writes instead of `Deferred`, modeled on the existing `Move` detach pattern (`:985`,
  `{"detached": true}` + `ordered_children` skip). Delete tombstones the object and its incident
  edges; Unlink tombstones the single edge. Each returns `Applied` with an inverse descriptor
  (the un-tombstone op) so the host/client can restore exact prior state. Add crate tests for
  delete→undo and unlink→undo round-trips. Proof: `cargo test -p commonplace`,
  `cargo clippy -p commonplace --all-targets --no-deps -- -D warnings`. Risk: GraphStore has no hard
  edge delete by design — tombstone (soft-delete) is the intended mechanism; keep it soft.
- **UX-D3.1 Optimistic mutation helper.** A shared apply-locally-then-reconcile wrapper capturing
  prior state for rollback, and (for delete/unlink) carrying the crate inverse descriptor from
  UX-D3.0. Files: new helper in `apps/web/src/lib/`; mobile equivalent.
- **UX-D3.2 Migrate mutation paths to optimistic + rollback.** capture (add rollback to
  `CommonPlaceSidebar.tsx:107`), edit (`ObjectTasks.tsx:211-282`), approve/deny (move local apply
  before await, `PromotionQueueView.tsx:70-94`), pin/forget (`commonplace-api.ts:856-888` callers),
  mobile swipes (`app/(tabs)/index.tsx:127`, `object/[id].tsx:184-191`). Acceptance: offline edit
  applies instantly and drains on reconnect; forced sync failure rolls the row back with a reason.
- **UX-D3.3 Undo-toast for destructive actions.** sonner action toast with a bounded window;
  delete/discard captures prior state and restores it exactly on undo (no confirm dialog). Files:
  `app/(commonplace)/layout.tsx:12` (Toaster), delete paths, `studio-draft-buffer.ts`. Acceptance:
  delete shows undo; undo restores exact prior state. Note: graph-version-backed inverse is a
  named backend follow-up (Decision 2).

### UX-D4 — Five-state discipline as a type  (spec §D4, row 4)

- **UX-D4.1 Shared discriminated union.** `ViewState<T> = empty | loading | partial | error |
  success` + a designed component per state, composing existing designed states
  (`RecordSurface.tsx`, `SearchLoadingStates.tsx`, `theseus/explorer/SkeletonRows.tsx`). Web + mobile.
- **UX-D4.2 Adopt across list/detail surfaces.** Wire the union into Index, feed, lenses, room,
  Studio panels, Ledger, mobile lists. Skeleton for known-shape sub-second; WeaveSpinner only for
  unknown-duration (this is refined by WL-D1's tiers). partial renders what exists while the rest
  streams. Acceptance: each primary surface renders all five states from fixtures; no raw spinner
  for a known-shape load; no undesigned empty.
- **UX-D4.3 Remove Ledger SEED mock.** `v2/ledger/page.tsx` renders real data or an honest empty
  (no-mock rule). Depends on UX-D2.

### UX-D5 — Interaction crispness  (spec §D5, row 5)  [numbers owned by MT]

- **UX-D5.1 Press-down activation.** Fire primary controls on `onPointerDown` (web) / `onPressIn`
  (mobile) where semantically safe (FAB open, tab switch, primary buttons). Files: `CaptureButton.tsx:96`,
  `RecordSurface.tsx:138`, `TabBarWithFab.tsx:112`, lens tabs. Acceptance: press-down measurably
  ahead of a click baseline (measured in UX-D7 trace).
- **UX-D5.2 Interruptible gesture springs.** Apply the MT spring presets to gesture surfaces
  (drags/sheets/swipes); no non-interruptible ease curve on a gesture-driven surface. Mobile:
  `withSpring` via MT presets on `ReanimatedSwipeable` rows. (Implemented against MT-D1 tokens.)
- **UX-D5.3 Reduced-motion parity.** Add the mobile reduced-motion gate (covered by MT-D5 audit).

### UX-D6 — Virtualize long surfaces  (spec §D6, row 6)  [see Decision 3]

- **UX-D6.1 Web virtualization.** `useVirtualizer` (`@tanstack/react-virtual`, already a dep) on
  `v2/ledger/page.tsx`, `v2/workrooms/page.tsx`, `networks/InboxFeed.tsx`, and commonplace
  `ProjectListView`/`NotebookListView`/`views/TimelineView`/`AgentThreadView`. Acceptance: 10k-row
  fixture scrolls at steady frame rate; memory flat.
- **UX-D6.2 Mobile FlashList.** Add `@shopify/flash-list`; migrate home feed (`(tabs)/index.tsx`),
  data lens (`data.tsx`), room feed (`room/[id].tsx`). Acceptance: 10k fixture steady on a mid device.

### UX-D7 — Latency budget in CI  (spec §D7, row 7)

- **UX-D7.1 INP / frame-timing instrumentation.** Track interaction latency on capture submit,
  tab switch, object open, approve; 200ms budget. Web via `web-vitals` onINP; RN/Tauri frame-timing
  equivalent.
- **UX-D7.2 Bundle-size budget.** `size-limit` on `apps/web`, budget set and passing.
- **UX-D7.3 Playwright interaction traces.** Playwright config + traces on the three headline flows
  (capture submit, object open, approve).
- **UX-D7.4 CI workflow.** GitHub Actions job running lint + vitest + quality:commonplace +
  a11y:commonplace + size-limit + Playwright traces; a synthetic 250ms handler regression fails CI.
  Acceptance: baselines set; 250ms regression fails; bundle budget passing.

### UX-D8 — Steal IA per screen  (spec §D8, row 8)

- **UX-D8.1 Archetype naming + doc.** Each primary screen names its reference archetype in a
  header comment + `docs/plans/ux-physics-accent/archetypes.md`: object lists → Linear
  row-and-drawer; run/decision Ledger (Workrooms) → Railway/Vercel deploy-log; receipts → Stripe
  drawer; approvals → PR-review-card.
- **UX-D8.2 Targeted refactor to match hierarchy.** Bind existing data into these structures;
  reskin with tokens. Not a rebuild. Acceptance: each primary screen matches its named archetype's
  information hierarchy; a new contributor can predict where an action lives.

### MOTION-TOKENS  (child of UX-D5)  [see Decisions 1, 4]

- **MT-1 Token source × 3.** Emit one scale three ways: web CSS `--cp-dur-press/hover(120)/local(200)/
  panel(280)/max(400)` + `--cp-ease-out(0.2,0,0,1)`/`--cp-ease-in-out(0.45,0,0.55,1)`/
  `--cp-ease-exit(0.3,0,1,1)` + `--cp-spring-ease` alias; mobile `motion` export same values;
  Reanimated presets module (`springSnappy`, `springGentle`, bezier set). Record old
  `--cp-ease-out`/`--cp-spring-ease` values. Acceptance: three targets carry identical values
  (comparison test); WeaveSpinner curves imported, not inlined.
- **MT-2 Consumption sweep + motion lint.** Migrate interactive components to the tokens (hover
  translateY(-1px)+shadow step, press scale(0.98), enter rise 8px+fade, exit fade-no-travel; press
  wins over hover). Extend the quality-audit lint: raw duration literals + raw cubic-bezier on
  interactive-role selectors fail. Acceptance: lint fails a reintroduced literal.
- **MT-3 WeaveSpinner consolidation.** Diff the two web copies, keep the better, one shared web
  location, both call sites repointed, duplicate deleted; web + mobile read the same presets.
- **MT-4 Scroll conformance.** `overscroll-behavior:contain` on panels/drawers/receipt rail;
  `scroll-padding` for sticky chrome; remove scroll-hijack/global smooth-scroll from product routes;
  programmatic jumps land visible. Acceptance: nested scroll never chains; ledger-row jump fully visible.
- **MT-5 Reduced-motion audit + visual check.** Every animated component ships a static equivalent
  (loaders, telegraph highlight, approval-card entrance, toasts, drawer transitions, tab motion);
  a forced-reduced-motion screenshot pass joins the (new) visual suite. Pairs with UX-D7 CI.

### WAIT-LADDER  (child of UX-D4 + UX-D7)  [see Decision 5]

- **WL-1 Tier helper.** Shared hook (web + mobile) mapping (op kind, elapsed) → tier, promoting
  T1→T2→T3 over time; composes with the UX-D4 union (refines the loading branch). T0<300ms renders
  nothing; T1 skeleton/button-morph; T2 WeaveSpinner + one narrated line; T3 job card. Acceptance:
  simulated 15s op walks T1/T2/T3 at boundaries; 200ms op renders nothing; consumed by co-browse
  cards, chat send, sync run, Keep.
- **WL-2 Narration inventory.** One module of intent strings keyed by op kind + step; web + mobile
  consume it; voice-linter interface stubbed (Decision 5). Acceptance: grep test finds no literal
  narration outside the module; rotation advances only on real step change.
- **WL-3 Job conversion + run-ledger progress.** T3 (or known-long) ops convert to a job card
  streaming real `harness_step` events, backgroundable, with a completion notification (Tauri
  desktop notification / mobile `notifications/index.ts`) deep-linking back. No invented percentages.
  Acceptance: real >10s run shows actual step events; backgrounding preserves the run; app kill +
  return shows durable state.
- **WL-4 Streaming discipline + TTFT.** Chat/agent threads render token streams (web/desktop/mobile
  `thread/[id].tsx`, `chat.tsx`); pre-stream uses T1 then T2 at 2s; record TTFT per provider route in
  usage receipts. Acceptance: first token paints without waiting for completion; TTFT in receipts.
- **WL-5 CI extension.** Extend the UX-D7 Playwright trace job: no indeterminate spinner beyond 10s
  (job conversion observed instead); the three headline flows record time-to-first-feedback within
  tier rules. Acceptance: synthetic 12s spinner regression fails CI, in the existing trace job.

---

## Sequencing (dependency-ordered vertical slices; no deliverable dropped)

- **Slice A — Accent (unblocks the two-color grammar).** UX-D1.3, UX-D1.4, UX-D1.5 (desktop). (UX-D1.1/.2 done.)
- **Slice B — Motion + wait foundation (shared substrate for D4/D5).** MT-1, MT-3, then UX-D4.1
  + WL-1 together (union + tier helper are one loading path), MT-5 gate design.
- **Slice C — Local-first + optimistic (the latency core).** UX-D3.0 (crate deletion/tombstone,
  independent Rust work — can start any time), UX-D2.1→.5, UX-D3.1→.3, WL-2, WL-4.
- **Slice D — State + motion adoption across surfaces.** UX-D4.2/.3, UX-D5.1/.2/.3, MT-2, MT-4, WL-3.
- **Slice E — Virtualization.** UX-D6.1, UX-D6.2.
- **Slice F — IA archetypes.** UX-D8.1, UX-D8.2.
- **Slice G — CI budget (gates everything, lands last so it can assert the real flows).** UX-D7.1→.4,
  WL-5, MT-5 visual check, plus fold UX-D1.4 + MT-2 lints into the CI job.

Slices A and B are independent and can proceed first. C depends on B's union/tier + A's tokens.
D depends on B+C. E is independent. F is independent (doc + refactor). G lands last.

## Non-goals (from the three specs' explicit non-goals — not scope cuts)

New design system / palette / type scale; Studio feature surfaces (charts, trainer, suggestion
atoms) as features (their feel is governed here); copy/positioning as a track; any server-awaiting
interaction path; new web animation libraries (CSS + existing spring + Reanimated only); page-transition/
Scene OS narrative motion; marketing-page motion; new progress-percentage estimation (real events or
honest indeterminacy only); skeleton redesign.

## Proof commands (grounded in real repo scripts)

- `cd apps/web && npm run test` (vitest)
- `cd apps/web && npm run lint`
- `cd apps/web && npm run quality:commonplace` (hosts the new accent + motion lints)
- `cd apps/web && npm run a11y:commonplace` (contrast)
- New for UX-D7/WL-5: `npx playwright test` (traces), `npx size-limit` (bundle), CI workflow under `.github/workflows/`.

Worktree note: this worktree has no local `node_modules` (pnpm-only install lives in
the parent checkout on another branch), so `vitest` and web `tsc` cannot run here without
`pnpm install`. Pure-logic verification was done directly in node; the committed vitest
tests run in CI / after an install.

---

## Execution status (updated 2026-07-11, mid-run)

### Slice A: Accent grammar: DONE and verified (web + desktop)
- UX-D1.1 web token patch: done (both register files; added `--cp-accent-soft/line/glow`).
- UX-D1.2 mobile audit: done.
- UX-D1.3 action-surface migration: done. `commonplace.css` action selectors + 5 module
  CSS files + components (ConnectionComposer, AssumptionRegister, InquiryBar, CommandBar,
  ObjectRenderer, BoardCanvas focus glow, ArtifactBrowserView action button) moved to
  `--cp-accent`. Machine-signal, type, section (terracotta = Essays), and error usages left
  on `--cp-red`. Canvas `ctx` literals correctly left as hex (CSS vars do not resolve in
  canvas 2D). A lint-scoped codemod touched 22 action blocks; verified by the lint below.
- UX-D1.4 lint rule: done. New `accent-grammar` fail-axis in
  `apps/web/scripts/commonplace-quality-audit.mjs`. Fixture-proven: a reintroduced alias on
  an action selector trips `fail` (exit 1); removal returns to clean.
- UX-D1.5 desktop unification: done. `apps/desktop/src/styles/tokens.css` `--accent` family
  repointed to oxblood (light `#7A2733` 8.49:1; dark contrast-tuned `#C25E69` ~4.5:1); ochre
  agent + crimson danger unchanged; no stray burnt-orange remains.

### Slice B: Motion + wait foundation: foundation DONE and verified
- MT-1 token source x3: done, values verified identical across web CSS,
  `apps/mobile/src/theme/tokens.ts` `motion`, and `apps/mobile/src/theme/springs.ts`
  (`springSnappy`/`springGentle` + bezier set). `--cp-ease-out` redefined per the handoff;
  old value recorded in the token comment. Reanimated 4 nuance handled: JS-driven
  `Easing.bezier` vs CSS `cubicBezier` are distinct types, both exported from springs.ts.
- MT-3 WeaveSpinner consolidation: done. One canonical web copy at
  `apps/web/src/components/WeaveSpinner.tsx` (+ module.css) supporting both prior APIs; both
  call sites (Omnibar, AgentThreadView) repointed; four duplicate files deleted; mobile
  WeaveSpinner reads the presets. The two former web copies were choreographically identical.
- UX-D4.1 five-state union: done on web. `apps/web/src/lib/commonplace-view-state.ts`
  (`ViewState<T>` = empty | loading | partial | error | success, constructors, guards,
  `deriveViewState`) + renderer `apps/web/src/components/commonplace/shared/ViewStateView.tsx`.
  Mobile mirror PENDING.
- WL-1 tier helper: done on web. `apps/web/src/lib/commonplace-wait-tier.ts`
  (`tierForElapsed` + `useWaitTier`, promotes T0->T1->T2->T3 at 300/2000/10000ms). Boundary
  test committed and verified. Composed into ViewStateView's loading branch. Mobile mirror PENDING.
- MT-5 reduced-motion gate design: the consolidated WeaveSpinner gates animation behind
  `prefers-reduced-motion: no-preference` (static is the default). The forced-reduced-motion
  screenshot audit lands with the visual suite in Slice G.

### Independent
- UX-D3.0 reversible deletion + tombstone (crate): IMPLEMENTED, NOT compiler-verified.
  `crates/commonplace/src/block_view.rs` `Delete`/`Unlink` now return `Applied` with an
  `ObjectAction::Restore` inverse; shared `is_detached`/`set_detached`; two round-trip tests
  added. `cargo test`/`clippy` could not run: the crate path-depends on the sibling
  `Theorem/rustyredcore_THG` repo, absent at the expected path in this worktree. API calls
  cross-checked against a same-version copy on disk. Needs the sibling repo to get a real
  pass/fail.

### Slice C: local-first + optimistic + narration: DONE (foundations), PARTIAL (adoption)
- UX-D2.1 persisted read cache + SWR in useApiData: done. commonplace-read-cache.ts
  (in-memory + size-guarded localStorage) seeds synchronously; useApiData revalidates in
  the background without clearing/jumping. Deviation from IndexedDB recorded (localStorage
  seeds the first post-refresh paint synchronously; IndexedDB cannot).
- UX-D2.2/2.4/2.5 cacheKey adoption: done for every product read surface (sidebar, feed,
  library lenses, lists, room, workrooms, operator, object detail, and more), keyed by
  entity id, bump counters excluded. Nine engine job/queue-status views intentionally left
  live (a stale one-frame count could cause a double approve/reject).
- UX-D2.3 mobile react-query persister: done, mobile typecheck clean. Built on
  dehydrate/hydrate (persister packages absent), hydrates under the splash screen.
- UX-D3.1 optimistic helper + UX-D3.3 undo toast: done. commonplace-optimistic.ts
  (runOptimistic, undoableDelete). Server-backed undo on the crate inverse is a named
  backend follow-up.
- UX-D3.2 mutation-path adoption: PARTIAL. The capture path already surfaces sync failure
  with a reason and preserves content for retry (a hard rollback there would delete user
  content on a transient failure, so it is deliberately left as-is). Remaining paths (edit,
  approve/deny, pin/forget, mobile swipes) still to adopt runOptimistic.
- WL-2 narration inventory: done, verified. commonplace-wait-narration.ts + parity test +
  documented mobile mirror. Voice-linter is a stub for HANDOFF-AGENT-VOICE (not provided).
- WL-4 streaming discipline + TTFT: NOT started.
- UX-D4.1 + WL-1 mobile mirror: done, mobile typecheck clean (viewState.ts, waitTier.ts,
  RN ViewStateView.tsx).
- MT-4 scroll conformance (web): done for panels + drawers (overscroll-behavior contain +
  scroll-padding). Workrooms receipt rail pending (component-level, lands with Slice F).

Process note: the mobile-persister subagent wrote its files to the sibling parent checkout
(main) instead of this worktree; the files were relocated here and the parent restored to
clean. Verify subagent output on disk, never trust the report alone.

### Remaining: Slices D, E, F, G (+ Slice C tails)
- Slice C tails: WL-4 (streaming + TTFT), UX-D3.2 remaining mutation paths.
- Slice D: UX-D4.2/.3 adoption (wire ViewStateView across surfaces, remove Ledger SEED mock),
  UX-D5.1/.2/.3 (press-down, gesture springs, mobile reduced-motion), MT-2 (consumption
  sweep + motion lint), WL-3 (job card + run-ledger). (MT-4 done early.)
- Slice E: UX-D6.1 (web virtualization), UX-D6.2 (mobile FlashList).
- Slice F: UX-D8.1/.2 (IA archetypes), plus the Workrooms receipt-rail overscroll tail.
- Slice G: UX-D7.1..4 (CI budget), WL-5, MT-5 visual check.
