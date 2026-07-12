# Planning-Theorem Artifact: HANDOFF-CARRY

The transition from reading to making. A browsing session passively accumulates
a cited evidence bundle; one action carries it into Write, Build, or Research,
with every quote still anchored to its source. Read → connect → carry → build,
one arc.

Source spec: `HANDOFF-CARRY.md` (5 deliverables D1–D5, verify-first, non-goals).

---

## Grounded reality (verify-first, resolved from the live repos)

| Verify-first item | Finding | Resolution |
|---|---|---|
| Canonical write surface: galley vs copresence | The **wired** surface is `ProjectPagesView` → `CommonPlaceEditor` (thin wrapper over `TiptapEditor`) with Yjs/Hocuspocus copresence, RustyRed-backed persistence. A CodeMirror work editor also exists. No "galley" package is wired. | **Copresence (Tiptap+Yjs) is the write surface.** Tiptap gives citation blocks (custom node) and comments (mark) — add both; do not fork the editor. |
| `evidence_bundle` packet shape vs D1 needs | `evidence_bundle` lives in `rustyred-thg-mcp`; only `records`, `trace`, `degraded` are populated. `snippets`/`provenance`/`validation_receipts` are **hardcoded empty**. **No `anchors`, no `connection_explanations`.** | **Anchors + connection explanations ride in each record's metadata**, exactly as the spec's verify-first anticipated. Do not blindly extend the cross-repo verb; carry the extra fields in record metadata the bundle already passes through. |
| Session identity across co-browse stage + destinations | No co-browse session id exists in the repo today. | **Define one session id in the local node**, shared by the bundle and every destination. D5 depends on it. |
| `CodeWorkspaceView` context injection for D3 | `CodeWorkspaceView` exists but its scope/queue/diff panes are **static placeholders**. ACP transport (`commonplace-acp.ts`) is real; sessions carry an agent thread. | Add a **bundle rail** to the view and inject the bundle into the ACP session context; replace the static right-pane placeholders only where the rail needs them. |
| Margin/co-browse substrate | `packages/coannotate` (anchors, annotations, cursors, fix-on-commit) is **built but has zero consumers**; the Rust `theorem-copresence` gesture module is unbuilt; "Keeps" is not a term in the code. | Build the bundle + carry against the **`coannotate`** substrate + a defined append API. The **live** browse inputs are owned by the upstream slices — see **FD-C1**. |

---

## Production goal

- **User-visible:** While browsing, a quiet count appears in the session chrome
  once the bundle is non-empty (gold register). One "Carry" action offers three
  destinations — Write, Build, Research. Each opens pre-seeded with the cited
  bundle; carried quotes stay clickable back to their exact source passage; the
  receipt rail travels so the arc reads as one session.
- **System:** A session-scoped bundle in the local node, appended by browse
  events, compiled through `evidence_bundle` into the existing cited packet. A
  `carry` operation seeds a destination surface and records a carry receipt.
- **Data:** One session id → one bundle → one carry lineage. Provenance (source
  URL, capture time, connection explanation, receipt ids) travels whole in
  record metadata; nothing arrives as bare text.
- **Operational:** Carry performs no unrequested generation. Destinations open
  seeded and silent.

---

## Checklist (every spec section has ≥1 task; stable IDs)

### D1 — Session bundle accumulation  → spec D1
- **C1.1** Session bundle store in the local node, keyed by co-browse session
  id; append API for the five event kinds (highlight expanded, Keep, margin
  thread, page Kept, entity intersect). Files: `apps/web/src/lib/carry/bundle-store.ts` (local-first, IndexedDB via the existing local-node pattern).
  *Acceptance:* a scripted session (2 highlights, 1 Keep, 1 margin thread) yields a bundle with exactly those items + full provenance.
- **C1.2** Compile the bundle through `evidence_bundle` so its wire shape is the
  existing cited packet; anchors + connection explanations ride in record
  metadata. File: `apps/web/src/lib/carry/compile.ts` (calls the `/api/theorem` proxy).
  *Acceptance:* the compiled packet round-trips the scripted items with metadata intact.
- **C1.3** Session chrome count once non-empty (gold register `--cp-gold`),
  quiet before that. File: `apps/web/src/components/commonplace/carry/CarryAffordance.tsx`.
  *Acceptance:* an empty session shows no Carry affordance; a non-empty one shows the count.
- **C1.4** Bundle survives app restart with the session (persist to IndexedDB).
  *Acceptance:* restart preserves the bundle.

### D2 — Carry to Write  → spec D2
- **C2.1** `Carry → Write` opens the write surface (`ProjectPagesView`)
  pre-seeded: carried quotes as **citation blocks** with live anchors. Files: new Tiptap `citation` node + seed path in `ProjectPagesView`.
  *Acceptance:* seeded document renders quotes with working anchor links (click reopens the page at the range).
- **C2.2** Margin threads → document **comments** anchored to their quotes
  (Tiptap comment mark + `coannotate` thread history). *Acceptance:* comments carry their thread history.
- **C2.3** Connected memory atoms pinned in a **references rail**; agent thread
  continued with the bundle as context. *Acceptance:* the co-writer answers about a carried source from bundle context without re-fetching.
- **C2.4** Document records the bundle id. *Acceptance:* the bundle id is on the document record.

### D3 — Carry to Build  → spec D3
- **C3.1** `Carry → Build` opens `CodeWorkspaceView` with a **bundle rail**:
  items listed with provenance. File: `CodeWorkspaceView.tsx` (replace static right-pane placeholder with the rail).
  *Acceptance:* the rail lists the bundle items.
- **C3.2** Insert a bundle item → **cited reference** in a comment or doc.
  *Acceptance:* inserting one produces a cited reference.
- **C3.3** Load the bundle into the coding agent's ACP session context. File: `commonplace-acp.ts` context injection.
  *Acceptance:* the coding agent answers from a carried source in its first turn.
- **C3.4** No generation on carry. *Acceptance:* carry performs no unrequested generation.

### D4 — Carry to Research  → spec D4
- **C4.1** `Carry → Research` seeds a new search constellation from the bundle's
  top entity intersects + open margin questions. (Depends on
  HANDOFF-SEARCH-CONSTELLATION — see FD-C1; seed the query surface that exists / a stub constellation.)
  *Acceptance:* the seeded constellation's query derives observably from bundle entities.
- **C4.2** Ancestor link: prior bundle linked, navigable both directions.
  *Acceptance:* the ancestor link is navigable both ways.
- **C4.3** New session accumulates its own bundle. *Acceptance:* the new session gets its own bundle.

### D5 — The rail travels  → spec D5
- **C5.1** Session **receipt rail** primitive (shared with HANDOFF-PUBLISH D4):
  renders browse actions + the carry event + destination actions in one
  timeline. File: `apps/web/src/components/commonplace/rail/SessionRail.tsx`.
  *Acceptance:* the rail in the destination shows pre-carry and post-carry entries in order.
- **C5.2** The carry event's receipt records bundle id, destination, item count;
  expandable to the bundle manifest. *Acceptance:* the carry receipt expands to the manifest.
- **C5.3** A second carry from the same session appends rather than forking the
  rail. *Acceptance:* second carry appends.

---

## Forced dependency (needs explicit consent — surfaced individually)

- **FD-C1 — Live browse inputs are upstream and unbuilt here.** The bundle's
  INPUTS — expanded highlights, Keeps, margin threads, page Keeps, entity
  intersects — are produced by HANDOFF-MARGIN-RECALL and
  HANDOFF-COBROWSE-PRESENCE, which are **not built in this checkout**
  (`coannotate` is built but unmounted; "Keeps" and the co-browse session id do
  not exist; the Rust copresence gesture module is unbuilt). D4's target
  (HANDOFF-SEARCH-CONSTELLATION) is likewise absent. **Recommendation:** build
  the bundle store, compile, carry, destinations, and traveling rail against the
  `coannotate` substrate + a defined append API, and satisfy the spec's own
  acceptance criteria — which are written against **a scripted session** — via a
  scripted event source. The live co-browse/margin wiring plugs into the same
  append API when those upstream slices land. *Consent required to build against
  the append API + scripted source rather than live co-browse inputs that don't
  exist yet.*

## Non-goals (from spec — no tasks, by design)
Third-party export format; automatic drafting on carry; multi-session bundle
merging.

## Cross-spec note
The **session receipt rail** (C5.1) is the same primitive PUBLISH D4 (P4.4)
writes its publish event into. Build it once here; PUBLISH consumes it.

## Proof commands
- Web unit: `pnpm --filter web test carry`
- Scripted-session harness: a test that appends 4 events → compiles → asserts packet + rail order.
- Dev-server verification of Carry affordance, the three destinations, and the traveling rail.
