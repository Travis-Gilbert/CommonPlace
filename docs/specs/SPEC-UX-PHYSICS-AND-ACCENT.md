# SPEC-UX-PHYSICS-AND-ACCENT

Corrective spec for CommonPlace UX quality across web, desktop (Tauri), and mobile. The mobile v2 build (checklist-mobile-app.json, all items built or completed) and the Scene Host work (checklist.json D1 to D6, verified) are solid; the tokens already carry the porcelain register v2 with recorded contrast. This spec fixes what is left: one token-resolution bug that silently disables the accent grammar, and the interaction physics that separate pleasant from merely consistent. Nothing here requires a new design system; where new tokens are added they are named and minimal.

## Root finding, fix first

`--cp-accent` resolves to `--cp-red`, which resolves to `--cp-burnt-orange` (#A65324). Oxblood (#7A2733) is defined in both `commonplace-tokens.css` and `commonplace-tokens-neutral.css` but **nothing points at it**, which is exactly why PT-002's "zero component consumers" grep passed. The porcelain register decision is that oxblood owns the action and pending-decision channel and burnt-orange is the engine/machine signal. Until `--cp-accent` resolves to oxblood, every primary action, focus ring, and "needs your call" accent renders as burnt-orange, and the two-color grammar (oxblood asks, gold shows) cannot exist.

### The token patch (both files)

Replace the accent wiring in the accent block. Keep `--cp-red` as burnt-orange for surfaces that intend machine signal (search chrome, discovery edge, `--cp-type-person`). Add an explicit accent group and point interaction tokens at it:

```css
/* Action / pending-decision signal: oxblood owns the red channel. */
--cp-accent:            var(--cp-oxblood);
--cp-accent-rgb:        var(--cp-oxblood-rgb);
--cp-accent-pressed:    var(--cp-oxblood-pressed);
--cp-accent-wash:       var(--cp-oxblood-wash);
--cp-accent-wash-dark:  var(--cp-oxblood-wash-dark);

/* --cp-red stays burnt-orange (machine signal). Do not point actions at it. */
--cp-red:               var(--cp-burnt-orange);

/* Interaction tokens use the action accent. */
--cp-focus-ring:        var(--cp-accent);
--cp-skeleton-shine:    color-mix(in srgb, var(--cp-accent) 6%, var(--cp-surface));
--cp-search-focus-border: color-mix(in srgb, var(--cp-accent) 40%, transparent);
--cp-ask-glyph:         var(--cp-accent);
--cp-ask-save:          var(--cp-accent);
--cp-ask-save-bg:       var(--cp-accent-wash);
```

Mobile `tokens.ts` already computed oxblood contrast receipts; audit that its `accent` export is the oxblood family and not a burnt-orange alias, same failure mode. Acceptance: a grep shows action surfaces (primary buttons, FAB, focus ring, Ask/Keep submit) resolve to #7A2733; machine-signal surfaces still resolve to #A65324; the two hues never appear on the same control.

## Governing principles

- **Latency is the product.** Interaction under ~100ms feels instant; under 400ms preserves flow. Every deliverable below serves this. It is the one measurable design opinion and it goes in CI.
- **Local-first reads, network in the background.** The substrate (embedded RustyRed, CRDT merge, mesh) already supports this. Interaction never awaits a server; panels read a local replica, sync reconciles behind the frame.
- **Optimistic mutation, undo over confirm.** Writes apply the same frame, sync confirms later, failures roll back visibly with a reason. Destructive actions execute with an undo affordance, not a confirm dialog. graph-version supplies inverse operations.
- **Five states, always.** Empty, loading, partial, error, success are explicit, never boolean soup. The HF-bootstrapped patterns mean empty states are seeded, not blank.
- **One accent.** Oxblood is reserved for actions and pending decisions. Gold is reserved for the harness showing something learned. No third accent.

## Deliverables

### D1. Accent resolution corrected (the fix above)
Build: apply the token patch to both web token files and audit mobile `tokens.ts`. Add a lint rule (stylelint `declaration-property-value-disallowed-list` or a repo grep test) forbidding raw `--cp-burnt-orange` / #A65324 on interactive-role selectors.
Acceptance: action surfaces render oxblood, machine surfaces render burnt-orange, the lint fails a reintroduced alias.

### D2. Local-first read contract
Build: every primary surface (Index, Chat, Data lenses, room feed, and the Studio panels) reads from the local node first and reconciles in the background; no interaction shows a spinner waiting on a round trip that a local replica could answer. Where a read must hit the network, it is stale-while-revalidate: render cached, refresh silently.
Acceptance: with the network artificially delayed 2s, every listed surface still opens and is interactive within one frame against local data; the refresh, when it lands, does not clear or jump the view.

### D3. Optimistic mutation and undo
Build: capture, edit, done/park/refile swipes, approve/deny, pin/forget all apply locally the same frame and reconcile after; a failed sync rolls back with a visible reason toast; destructive actions (delete, discard queue) present an undo toast for a bounded window instead of a confirm dialog, using graph-version inverse ops.
Acceptance: an offline edit applies instantly and drains on reconnect; a forced sync failure rolls the row back with a reason; delete shows undo and the undo restores the exact prior state.

### D4. Five-state discipline as a type
Build: a small discriminated-union view-state helper (empty | loading | partial | error | success) used by every list and detail surface, with a designed component per state. Loading uses skeletons for known-shape sub-second loads and the WeaveSpinner only for unknown-duration work; partial renders what exists while the rest streams; error names the cause and offers the retry.
Acceptance: each primary surface renders all five states from fixtures; no surface shows a raw spinner for a known-shape load; no surface renders an undesigned empty.

### D5. Interaction crispness
Build: actionable controls fire on pointer-down (`onPressIn` / pointerdown) where semantically safe, not on release; pressed states land within one frame; motion uses springs (Reanimated on mobile, the existing `--cp-spring-ease` on web) so gestures stay interruptible; motion is used only to show causality (where a thing came from or went), and `useReducedMotion` / `prefers-reduced-motion` is honored everywhere.
Acceptance: primary actions respond on press-down measurably ahead of a click baseline; a reduced-motion device shows static equivalents; no non-interruptible ease curve remains on a gesture-driven surface.

### D6. Virtualize the long surfaces
Build: the Ledger, episode tables, object lists, and room feeds virtualize (FlashList on mobile, a virtualizer on web) before they are shipped with real data volume, since these reach tens of thousands of rows.
Acceptance: a 10k-row fixture scrolls at steady frame rate on a mid device; memory stays flat with list length.

### D7. Latency budget in CI
Build: track INP (or the Tauri/RN equivalent frame-timing) with a budget of 200ms on the core interactions (capture submit, tab switch, object open, approve), enforce a bundle-size budget (size-limit) on web, and add a Playwright interaction trace on the three headline flows. A regression fails the check.
Acceptance: the three flows have baseline traces; a synthetic 250ms handler regression fails CI; the bundle budget is set and passing.

### D8. Steal the information architecture per screen
Build: for each primary screen, the layout follows the best-in-class reference for that archetype rather than being invented: object lists follow the Linear row-and-drawer model (one object, one row, one drawer, already the stated pattern), the run/decision Ledger follows the Railway/Vercel deploy-log model, receipts and reward breakdowns follow the Stripe drawer model, approvals follow the PR-review-card model. Bind existing data into these structures; reskin with the token generator. This is documentation plus targeted refactor, not a rebuild.
Acceptance: each primary screen names its reference archetype in a comment or doc and matches its information hierarchy; a new contributor can predict where an action lives.

## Verify first

- Mobile `tokens.ts` accent export (oxblood family vs a burnt-orange alias), the same resolution bug in the RN theme.
- Which web surfaces already read local vs await the API, so D2 targets the awaiting ones.
- Whether the existing swipe/approve paths are already optimistic or await confirmation, for D3 scope.
- Current list rendering on Ledger and Data lenses (already virtualized or not), for D6 scope.
- The web `(studio)` route group's current state, since it exists and is the Studio surface these physics also govern.
- The three headline flows to baseline for D7 (capture submit, object open, approve are the proposed three).

## What is deliberately not here

- A new design system, palette, or type scale. The register v2 stands; this fixes its wiring and its physics.
- Studio feature surfaces (charts, trainer, suggestion atoms). Those are their own spec; this governs how they must feel.
- Copy and positioning. Separate track.
- Any change that awaits a server on the interaction path, which this spec exists to remove.

## Build table

| # | Current state | Feature | Location | Action | Desired outcome | Test |
|---|---|---|---|---|---|---|
| 1 | accent resolves to burnt-orange | accent resolution fix | both web token files, mobile tokens.ts | patch | Oxblood owns actions, burnt-orange owns machine signal | [-] action surfaces #7A2733, machine #A65324, lint blocks alias |
| 2 | some surfaces await the API | local-first read contract | primary surfaces + data layer | build | Every surface interactive in one frame on local data | [-] 2s network delay, surfaces still open + interactive |
| 3 | mutations may await confirm | optimistic mutation + undo | mutation paths + graph-version | build | Instant apply, visible rollback, undo over confirm | [-] offline edit instant + drains; failure rolls back; delete undoable |
| 4 | states ad hoc | five-state view helper | shared helper + per-surface states | build | Every surface designs all five states | [-] all five render from fixtures; no raw spinner for known shape |
| 5 | click-fire, ease curves | interaction crispness | control + motion layer | build | Press-down response, interruptible springs, reduced-motion | [-] press-down ahead of click; reduced-motion static; no locked ease on gestures |
| 6 | lists unvirtualized | virtualize long surfaces | Ledger, tables, lists, feeds | build | Steady scroll at 10k rows, flat memory | [-] 10k fixture steady frame rate |
| 7 | no latency budget | latency budget in CI | CI + traces | build | Regressions fail before merge | [-] baselines set; 250ms regression fails; bundle budget passing |
| 8 | some screens invented | steal IA per screen | each primary screen | build/doc | Predictable hierarchy from proven references | [-] each screen names its archetype and matches it |
