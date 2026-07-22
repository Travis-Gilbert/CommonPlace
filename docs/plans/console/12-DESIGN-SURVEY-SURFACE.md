# DESIGN-INDEXER-SURFACE

Register: design brief, pre-handoff. The research surface: how a standing topic's harvest opens. Companions: DESIGN-STANDING-TOPICS (the pipeline that feeds this), HANDOFF-CARDS-ACTIONS-MENTIONS (the card machinery this composes), AMENDMENT-SCENE-OS-INTUI (the grammar graduation path), the margin-recall salience machinery (the highlight source).

Naming correction: the Index remains the triage command center. A topic opens in Indexer. The file and internal `survey.*` identifiers remain stable during migration so existing arrangements and backend work keep their addresses.

## 1. The Roam idea, elevated

Roam's marketing image showed the right thing: miniature documents visible simultaneously with their connections. The product underneath was an outliner, and the image stayed marketing. Indexer makes the image the product, with three elevations Roam could not make:

1. The miniatures carry the ingested source itself, not a CommonPlace restyling of it. Each capture prefers a held page snapshot or original media. A typed reconstruction is an explicit fallback when ingestion did not retain a visual snapshot.
2. The excerpt is scoped to why it was captured. The topic's relevance gate knows which spans matched; those spans render highlighted in the gold learned register. The user does not skim the page to find their subject; Indexer already found it and is showing its work.
3. The connections are evidenced. Every edge between clippings carries a worded reason (shared entities, citation, same author, temporal adjacency), the constellation discipline applied at corpus scale.

## 2. The clipping card

A capture composes two deliberately separate layers:

- Source layer: the held screenshot, original media, or source-shaped reconstruction retains the originating page's composition and aspect ratio. Indexer does not impose one miniature-browser template on every capture.
- Annotation layer: source domain, captured-at, data type, topic, user categories, Data Wave tags, matched spans, and relationship reasons use the shared CommonPlace grammar around the source. Learned gold never recolors the source snapshot itself.
- Interaction: the source artifact occupies the spatial card. Selecting it opens a larger source-faithful view with annotations alongside it, not embedded into its body.

## 3. The canvas

Actual three dimensional, using the 21st.dev 3D Image Gallery component by moazamtrade as the interaction baseline:

- React Three Fiber renders billboarded source captures at the installed component's deterministic golden-ratio positions across spherical radii 12, 16, and 20. OrbitControls supplies rotate, pan, and wheel zoom so the user can move through the corpus and approach a source directly. The relation graph does not flatten or order this spatial composition.
- Every spatial card uses one fixed 4:3 evidence frame, enlarged to 6 by 4.5 world units, and a fixed-height CommonPlace annotation strip. Held source media preserves its own aspect ratio with `contain` inside that frame. Category and relationship data affect grouping, depth, and connecting geometry, never card shape.
- The zoom ladder is camera-native: far surveys the corpus, mid reads source miniatures, and selection opens the full capture. Far and mid are camera presets over one scene rather than separate flattened layouts.
- The canvas ground is the shared MaterialLayer (Paper-designed island anatomy, Spec 34). Indexer keeps a transparent scene shell and a clear R3F canvas so terracotta, grain, and island body show through. It does not paint a second CSS pegboard or starfield.
- Relationships may contain cycles and reciprocal claims. Valid persisted edges remain graph truth; the renderer does not impose an acyclic model or use relationships to position cards.
- Edges remain visible at a quiet idle opacity. Hovering a clipping reveals its incident relationships, while direct edge hover increases emphasis and exposes the worded reason. Clicking an edge pins the strongest emphasis until it is clicked again or another edge is pinned. Edge density is budgeted (strongest N per clipping) so the canvas reads as a research board, not a hairball.

Register discipline: captured pixels and source-shaped content are source material, like the patent drawings. The canvas ground and chrome stay Int UI. Gold is reserved for annotation and learned judgments outside the source image. Reduced motion and no-WebGL degrade to a flat clustered grid with identical source artifacts and annotations, losing only spatial navigation.

## 4. System fit

- Indexer is a scene-grammar candidate with the compatibility kind `survey`: it opens as a maximized editor document, the morph rules from the scene amendment apply (snapshot and restore), and it graduates into SceneHost when that package lands. v1 ships as a view descriptor on the console.
- Everything on the canvas is existing machinery composed: clippings are cards, edges come from the graph, highlights come from salience spans, and clusters come from entity edges.
- Cross-requirement into DESIGN-STANDING-TOPICS: the relevance gate persists its matched spans and feature attributions at capture time. Without stored spans Indexer cannot scope excerpts, so span persistence is promoted to a requirement of topics v2, not an option.

## 5. Verify first

- Span persistence shape at the topic gate (the cross-requirement above).
- Image extraction in RustyRedWeb captures (hero image availability and rights posture for thumbnails of captured pages).
- WebGL and DOM-overlay performance with 200 plus source captures mounted; the zoom ladder's mid tier may need cluster virtualization and snapshot level of detail.

## 6. Implementation notes

- Considered wiring the view directly to the live object API versus proving the descriptor and data contract with committed captures. Chose a seeded descriptor slice because the current API has salience anchors and blob capture, but no standing-topic harvest persistence or Indexer edge projection.
- The v1 Console path is Topics to Indexer. Both are surface objects; opening a topic retargets the compatibility `survey.board` ObjectQuery and activates its maximized editor arrangement.
- Matched spans persist start, end, feature, and attribution. Invalid or overlapping spans are refused by the view model rather than highlighted speculatively.
- Live topic ingestion, rights-cleared hero images, card action execution, and 200 plus capture virtualization remain explicit integration work. The seeded surface does not claim those backend capabilities.
- Correction recorded after visual review: source content is never normalized into the Indexer card template. The production ingestion contract prefers held source-authored Open Graph media, then a held screenshot or original embedded media, and finally a typed reconstruction. It records preview kind, original preview URL, held render URL, source kind, and aspect ratio. The browser never hotlinks preview media; CommonPlace styling is limited to annotations and spatial interaction.
- The Indexer scene is a direct customization of 21st.dev catalog component 6525, `moazamtrade/3d-image-gallery`, fetched through the authenticated 21st CLI. Its CardProvider, golden-ratio spherical positions, billboard cards, 60-degree field of view, and OrbitControls remain the scene contract. CommonPlace replaces the demo invitation data, modal, and starfield with injected captures, relation geometry, a transparent MaterialLayer-backed ground, accessibility fallback, and runtime receipts. The overview camera sits at 48 outside the complete 20-unit sphere; mid inspection returns to the source component's original camera distance of 15.
- The upstream night environment asset has its own Suspense boundary. The gallery and captures do not disappear while that optional lighting resource loads.
- The R3F scene renders on demand with an alpha clear, with Drei controls invalidating frames during orbit and zoom. Ambient ground paint stays in MaterialLayer, so Indexer does not own a second background renderer.
- Source pages are true camera-facing billboards. Corpus depth comes from 3D position and camera movement, while page planes remain parallel to the view so text never inherits yaw, pitch, roll, or perspective shear. Hover uses only a restrained 2 percent uniform scale.
- The demonstration corpus grows from nine to fifteen unique captures, balanced across the three clusters. The overview must project all fifteen fixed 4:3 cards inside the scene while retaining meaningful world-depth variance. Browser geometry assertions hold visibility and depth rather than imposing a planar order.
- Indexer edges are evidence claims and may be cyclic. Density budgeting selects the strongest local relationships without changing the source-owned spherical card positions. The 3D layer stays quiet at rest, reveals incident edges through clipping or edge focus, and pins stronger emphasis on edge click; the flat fallback preserves every displayed reason.
- The seed corpus proves the held-preview seam with GitHub's source-authored Open Graph image for commit `b66beba`. The remote `og:image` URL remains provenance, while Indexer renders a committed 1200 by 600 copy through `source_snapshot_url`. Production ingestion must perform the same fetch and hold server-side.
- Visual correction after source-fidelity review: all fifteen demonstration captures now render held source media. GitHub file and directory captures use held 1200 by 800 page screenshots when GitHub's repository-wide Open Graph image is too generic to identify the captured page. Observable and 21st.dev use their source-authored Open Graph media. Typed reconstructions remain available only as an explicitly labeled fallback.
- Visual correction after canvas review: the Harvest summary overlay is removed. Source cards are larger, idle relationships remain visible but subdued, and the starfield / pegboard paint is retired for the shared MaterialLayer ground.
