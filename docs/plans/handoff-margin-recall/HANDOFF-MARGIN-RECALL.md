# HANDOFF-MARGIN-RECALL

The reading surface of ambient recall: while a person browses, the harness highlights passages connected to what their RustyRed already holds, and speaks in the physical margin of the page. No split screen, no side panel. This layers on HANDOFF-COBROWSE-PRESENCE (which supplies the stage, control spectrum, and receipt rail) and is the product UI of the HANDOFF-AMBIENT-RECALL retrieval stream.

## Current condition

- HANDOFF-AMBIENT-RECALL scopes the retrieval side: the salience extractor with IDF gating, the per-tenant IDF ledger in Valkey, and DATAWAVE anchor index writes. AR0, the encode path leak, is its gating deliverable and therefore an upstream gate here: ambient recall is only as good as what actually got encoded.
- DATAWAVE (`datawave_ingest` record/batch/lookup/intersect) normalizes records into field-facts (value plus field) with declared entity edges, readable back by exact lookup and AND-intersect.
- A Rust port of the spaCy extraction pipeline recently landed (tokenization, sentence segmentation, NER, noun chunks); the June harness-rust-port plan still lists spaCy as a reason the `theseus_*` engine stayed Python-side, so this port moves candidate extraction into the local node request path.
- RustyWeb takes BLAKE3 content snapshots of pages, giving a stable page-content hash for caching and re-anchoring.
- The commonplace-clipper vendors the obsidian-clipper reader and highlighter stack, in-house prior art for robust text anchoring.
- Servo landed user script support this spring; it is the escape hatch here, not the primary mechanism.
- Accent grammar: gold is the harness showing something learned, which is exactly what an ambient highlight is. Oxblood stays reserved for actions.

## Named choices (requirements)

- The annotation layer is a CommonPlace-owned overlay positioned by geometry from the versioned command contract. It is not UI injected into the page. This keeps the ownership boundary exact (Theorem supplies capability, CommonPlace draws interface) and keeps the experience engine-neutral: the CDP fallback engine must be able to supply the same geometry, so Windows and Servo-incompatible sites get the identical margin. Minimal in-page injection is permitted only for the text tint itself, only if overlay compositing cannot track scroll smoothly, and only behind the same contract.
- Exact connections outrank semantic ones. A DATAWAVE field-fact hit (this value, this field, these records) ranks above vector or PPR similarity for highlighting, because it is verifiable at a glance and its explanation is receipt-grade.
- Silence is the default state. No indicator on page load, no promise of results. Highlights fade in asynchronously when found; if nothing clears threshold, nothing appears. A wrong highlight costs more trust than a missed one, and every threshold in the system is set under that asymmetry.
- Budget: at most five highlights per page.
- The page is immutable. Harness content is additive and visually distinct, harness ink versus page ink. Synthesized artifacts (Scene OS cards) are clearly marked, collapsible harness inserts; the site's own words are never rewritten or restyled.
- Gestures: hover previews the margin note (desktop); short click expands the full connection with provenance; press-and-hold Keeps it, with a visible progress ring filling over roughly 450ms so a write never fires accidentally and never needs a dialog. Mobile: tap expands, long-press Keeps.

## Deliverables

### D1. Contract additions (FO-041 scope)
Build: versioned commands the overlay needs, implemented by the Servo sidecar and required of any fallback engine: resolve text targets to viewport rects (input: quote selector plus position hint; output: zero or more rect sets with a confidence), a viewport and scroll event stream so the overlay tracks the page, scroll-to-target, and page identity (URL, title, BLAKE3 content hash). Extend `apps/desktop/src/lib/commands.ts` and the Rust command surface as the contract pair, versioned.
Acceptance: a fixture page resolves known quotes to rects that visually align with the text; scrolling keeps an overlay rectangle glued to its passage; the same contract test suite passes against the fallback engine driver.

### D2. Salience pipeline in the local node
Build: on page ready (and on Keep), the local node runs: extraction via the Rust spaCy-port pipeline (sentences, entities, noun chunks), the per-tenant IDF gate to drop common terms, then two lookup tiers: DATAWAVE lookup and intersect for exact field-fact connections, and the semantic tier (vector plus PPR) for fuzzy ones. Output: scored candidate connections, each carrying its anchor (quote plus position), its tier, and its explanation (for DATAWAVE hits: the value, field, and record ids; for semantic hits: the memory atoms and edge path). Threshold and per-page budget are product parameters, not constants buried in code. Results cache by page content hash. AR0 is verified closed before this ships to a user-reachable surface.
Acceptance: a fixture page whose entities exist in a seeded tenant produces exact-tier candidates with complete explanations; a page with no connections produces zero candidates and zero UI; end-to-end latency from page ready to first candidate is measured and recorded on a mid-tier machine; repeated visits to an unchanged page hit the cache.

### D3. Annotation store
Build: annotations as RustyRed nodes in the W3C Web Annotation shape: target (source URL, quote selector, position selector, page content hash), body (connection explanation, memory refs, or a model note), motivation, actor, timestamps on bitemporal edges. Re-anchoring on revisit: exact hash match reuses stored rects targets; changed content re-resolves by quote with fuzzy position, and a target that cannot re-anchor above confidence becomes an orphan, preserved in the store and shown in the margin's collapsed session list, never highlighted on the wrong text.
Acceptance: an annotation survives a page revisit unchanged; a page edit that moves the passage re-anchors correctly; a page edit that deletes the passage produces the orphan state, not a misplaced highlight; annotation history replays from the bitemporal edges.

### D4. Highlight overlay
Build: the CommonPlace overlay renders candidates as a faint gold tint on the passage, fading in per motion tokens when the pipeline returns, capped at the page budget, ranked exact tier first. No overlay chrome beyond the tint until hover. Reduced motion renders the tint statically. The overlay never intercepts input except on its own tinted regions and margin elements.
Acceptance: highlights appear without any loading indicator preceding them; the cap holds on a fixture with twenty candidates; page interaction outside tinted regions is unaffected (click-through verified); reduced motion shows static tints.

### D5. Margin notes and threads
Build: each highlight owns a margin note in the physical margin when viewport width allows, collapsing to a gutter chip when it does not. The note's collapsed form is one line (the connection, named). Replying in a note continues an anchored conversation thread there, backed by the same agent route as chat, with the anchor and its connection explanation as context. Threads persist with the annotation and reappear on revisit. Margin overflow stacks into a compact per-page list ordered by document position.
Acceptance: notes align with their passages across scroll and resize; a reply produces an anchored agent response in the thread, not in any side panel; threads persist across sessions; narrow viewport degrades to chips without loss.

### D6. Gestures and provenance expansion
Build: hover reveals the margin note preview (desktop). Short click expands to the full connection: what it links to, why (the DATAWAVE explanation or the memory atoms and edge path), when captured, with each referenced record openable. Press-and-hold on a highlight (or its chip) runs Keep for that passage: progress ring fills, release before fill cancels, completion captures the anchored quote with its provenance and confirms with the gold graph-destination toast from HANDOFF-COBROWSE-PRESENCE D8. Dismissing a highlight (small affordance in the expanded state) hides it for this page and records the dismissal as a relevance signal for threshold tuning.
Acceptance: the three gestures behave as specified on desktop and their tap and long-press equivalents on mobile; an interrupted hold does not write; the expanded state shows a complete, openable provenance chain for both tiers; dismissals land in telemetry.

### D7. Recall dial and per-site policy
Build: a visible three-position control: Off, Quiet (exact-tier connections only, above a higher threshold), Active (both tiers, standard threshold, and the model may attach a margin note proactively to its highest-confidence connection). The dial binds to the existing per-site capture policy mechanism so a site can be permanently Off. Default is Quiet.
Acceptance: each position observably changes what a fixture page shows; a per-site Off suppresses the pipeline entirely for that origin (verified by absence of node calls); the default ships as Quiet.

## Verify first

- The actual crate name and capability surface of the Rust spaCy port (code search could not locate it, likely index lag on recent work); bind D2 to the real API and confirm NER and noun chunk parity with the Python pipeline for the entity types the IDF ledger expects.
- AR0 (encode path leak) status; this handoff does not ship user-reachable while AR0 is open.
- Whether `extract_visible_text` can be extended to return ranges, or D1 is a new command family; and what geometry the Servo embedder API exposes for text ranges today.
- DATAWAVE anchor index write path status from the ambient recall stream, and lookup latency against a realistic tenant.
- Measured cold latency of the full D2 pipeline on a mid-tier machine, which decides whether extraction runs on page ready for every page or only on dwell.

## Explicit non-goals

- Editing or restyling page content. Additive harness ink only.
- Cloud recall for local tenants. Page text reaches the local node and goes no further.
- Cross-user or shared annotations. Single-tenant margin in this slice.
- Proactive margin speech in Quiet mode. The model initiates only in Active, only once per page.
