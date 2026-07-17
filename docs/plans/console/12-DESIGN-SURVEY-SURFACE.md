# DESIGN-SURVEY-SURFACE

Register: design brief, pre-handoff. The research surface: how a standing topic's harvest opens. Companions: DESIGN-STANDING-TOPICS (the pipeline that feeds this), HANDOFF-CARDS-ACTIONS-MENTIONS (the card machinery this composes), AMENDMENT-SCENE-OS-INTUI (the grammar graduation path), the margin-recall salience machinery (the highlight source).

Naming: the Index remains the triage command center. A topic opens as a Survey. Fresh word, describes the act, no collision, and it sits naturally beside atlas in the product vocabulary without overloading it.

## 1. The Roam idea, elevated

Roam's marketing image showed the right thing: miniature documents visible simultaneously with their connections. The product underneath was an outliner, and the image stayed marketing. The Survey makes the image the product, with three elevations Roam could not make:

1. The miniatures carry real source content, not page titles. Each capture renders as a clipping: a small framed page with actual excerpt, image, and provenance.
2. The excerpt is scoped to why it was captured. The topic's relevance gate knows which spans matched; those spans render highlighted in the gold learned register. The user does not skim the page to find their subject; the Survey already found it and is showing its work.
3. The connections are evidenced. Every edge between clippings carries a worded reason (shared entities, citation, same author, temporal adjacency), the constellation discipline applied at corpus scale.

## 2. The clipping card

A card template per HANDOFF-CARDS-ACTIONS-MENTIONS machinery (templates are data), kind capture:

- A miniature chrome strip: favicon, title, source domain. The mini-browser framing echoes both Roam's image and Twenty's mock-browser device; it reads instantly as "a page."
- The scoped excerpt with matched spans highlighted gold. If the capture carries a hero image, it renders above or beside the excerpt.
- Footer: captured-at, kind dot, topic chip.
- Interaction: hover lifts (the pseudo-3D affordance), click opens the full capture in reading view (Galley for text, original media where held); the Action verb and mentions section ride along because it is a card.

## 3. The canvas

Pseudo three dimensional, deliberately short of full 3D:

- CSS perspective with small z-offsets and tilts per clipping, parallax on pan. This is the depth register the reference gestures at; the cult-ui carousel is a motion-quality reference only, since the Survey is scatter and cluster, never carousel order.
- Layout: cluster by sub-theme (entity clusters from the graph), force-settled within clusters, deterministic for identical inputs.
- The zoom ladder: far renders dots and cluster labels (constellation register); mid renders clippings; open is the full capture. Semantic zoom, not just scale.
- One corner card is the summary panel: a small auto-chart of the harvest (kinds over time, top entities, source distribution) so the Survey answers "what is this" in one glance. Observable Plot enters the ledger for this row.
- Edges render between clippings with reasons on hover; edge density is budgeted (strongest N per clipping) so the canvas reads as a research board, not a hairball.

Register discipline: clippings are content register (source material, like the patent drawings); the canvas ground and chrome stay Int UI; gold is reserved for matched spans and learned judgments. Reduced motion and no-WebGL degrade to a flat clustered grid of the same cards with the same highlights, losing only depth.

## 4. System fit

- The Survey is a scene-grammar candidate (`survey`): it opens as a maximized editor document, the morph rules from the scene amendment apply (snapshot and restore), and it graduates into SceneHost when that package lands. v1 ships as a view descriptor on the console.
- Everything on the canvas is existing machinery composed: clippings are cards, edges come from the graph, highlights come from salience spans, clusters come from entity edges, the summary chart reads the same ObjectQuery.
- Cross-requirement into DESIGN-STANDING-TOPICS: the relevance gate persists its matched spans and feature attributions at capture time. Without stored spans the Survey cannot scope excerpts, so span persistence is promoted to a requirement of topics v2, not an option.

## 5. Verify first

- Span persistence shape at the topic gate (the cross-requirement above).
- Image extraction in RustyRedWeb captures (hero image availability and rights posture for thumbnails of captured pages).
- Observable Plot as a ledger row for the summary panel, or the existing charting path if one is already in the console ledger.
- Perspective-transform performance with 200 plus clippings mounted; the zoom ladder's mid tier may need virtualization by cluster.
