# Planning-Theorem Artifact: HANDOFF-PUBLISH

Publish an artifact to a live public URL and hand it to someone. A published
artifact is a **block** — content-addressed, shape-validated, grant-gated —
whose projection is hosted at a URL. This is also the growth loop: every
published page is a doorway into the product.

Source spec: `HANDOFF-PUBLISH.md` (5 deliverables D1–D5, verify-first, non-goals).

---

## Grounded reality (verify-first, resolved from the live repos)

| Verify-first item | Finding | Resolution |
|---|---|---|
| Depth of `theorem-blocks` | `BlockId` (SHA-256), `ShapeRegistry`+JSON-schema `validate`, `Grant`/`Capability`/`DelegationChain` (structural), `ConformanceChecker` L0–L4 are **implemented but inert** (zero callers outside the crate; no MCP/API surface). Attestation **signing is absent** (Ed25519 declared, never used). Crate is in the sibling `Theorem/rustyredcore_THG` workspace, **not** in CommonPlace's. | **Model publish natively in the RustyRed graph via `commonplace-api`.** Do not couple to the inert cross-repo noun layer. Reuse the graph's existing content-addressing (File blobs are already content-addressed) for the version hash, and the existing `put_type_def`/shape machinery for the L1 shape floor. `theorem-blocks` is the conceptual model, not an import. |
| Key-management home for attestation signing | **None exists** anywhere in either workspace. The only real Ed25519 code (`rustyred-thg-checkpoint/src/signing.rs`) takes a raw secret per call — no keystore. | **Forced deferral FD-P1** (see below). Ship provenance from content-hash identity + conformance result; defer cryptographic signing. |
| Public host location: route group vs dedicated app | `apps/web` is Next.js App Router. `(main)` route group is the **existing public/unauthenticated precedent** ("chrome for the public facing site"). The dedicated marketing app (`apps/theoremharness-marketing`) is planned (FO-050) but **does not exist yet**. | **Route group** `apps/web/src/app/(published)/` — no product shell, shared tokens. Deploy isolation not needed for v1 (single Railway web app). Revisit a dedicated app only if/when FO-050 lands. |
| Minting path from each surface | Chat artifacts render via `SceneHost` (`RenderScenePayload`); **none produce blocks today**. Write surface = `ProjectPagesView` Item(`kind=doc`). | Add a single **mint step at publish time**: surface object → block (content-hash + shape id). One pipeline, invoked from every surface. |
| Domain for published URLs | n/a (greenfield) | **Path under the product domain: `/p/:alias`** (stable alias) and `/p/v/:versionHash` (permanent version URL). Short share domain is a later swap. |
| OG image generation | Next.js App Router native `ImageResponse` (`next/og`) is available; no new dep. | **`next/og` `ImageResponse`** route generating from block title + kind. |

---

## Production goal

- **User-visible:** From any artifact (chat card, scene, block view, write
  surface) a person clicks Publish, picks a visibility, and gets a working
  public URL with one-press copy. A logged-out visitor opens that URL and sees
  the artifact rendered on-brand with no product chrome, an OG card on paste,
  quiet verified-block provenance, and an "Open in CommonPlace" doorway.
- **System:** A `publish` API operation mints/updates a block, runs the L1
  shape gate, attaches a visibility Grant, records a stable alias, and returns a
  receipt. A public unauthenticated route group serves block projections.
- **Data:** Published artifacts are blocks in the RustyRed graph with a version
  hash, a visibility Grant, and an alias edge. Re-publish re-points the alias;
  old versions resolve permanently at their hash URL.
- **Operational:** Public routes call no authenticated API. Unpublish flips the
  Grant and the alias returns a designed gone state; the block survives.

---

## Checklist (every spec section has ≥1 task; stable IDs)

### D1 — Publish pipeline  → spec D1
- **P1.1** Define the published-block model in the graph: `PublishedBlock`
  (block id = content hash of shape+payload+origin, version hash, shape id,
  visibility, alias, origin surface ref, view counter). File: `crates/commonplace/src/` (new `publish.rs`) + `apps/commonplace-api/src/schema.rs`.
  *Acceptance:* a fixture scene block persists and round-trips with a version hash.
- **P1.2** `publish` GraphQL mutation: input = artifact ref (block id **or** a
  surface object to mint first) + visibility. Steps: mint-if-needed → L1 shape
  validate → attach Grant → record alias → return receipt `{ url, blockId,
  versionHash, conformance, visibility }`. File: `apps/commonplace-api/src/schema.rs` (+ `publish.rs` op module).
  *Acceptance:* publishing a fixture scene block returns a working URL and a
  receipt with the version hash.
- **P1.3** L1 shape gate as the publish floor: a block failing shape validation
  is **refused** with the named conformance result. Reuse graph `type_def`
  validation.
  *Acceptance:* a shape-invalid block is refused, conformance result named.
- **P1.4** `unpublish` mutation: revoke alias + flip Grant. Alias returns the
  designed **gone** state; block survives in the graph.
  *Acceptance:* after unpublish the alias resolves to gone; the block is still queryable.
- **P1.5** Re-publish after edit: new version served at the alias; old version
  permanently at its hash URL; history preserved.
  *Acceptance:* alias serves the new version, `/p/v/:oldHash` still serves the old.

### D2 — Public projection host  → spec D2
- **P2.1** Public route group `apps/web/src/app/(published)/p/[alias]/page.tsx`
  — resolves alias → block → renders via `SceneHost`/ViewDescriptor with
  CommonPlace tokens, **no product shell**, server-rendered / static-friendly.
  *Acceptance:* a published dashboard, document, and scene each render correctly logged-out in a clean browser.
- **P2.2** Permanent version route `(published)/p/v/[hash]/page.tsx`.
- **P2.3** Social metadata via `generateMetadata` (title, description) + OG image
  route `(published)/p/[alias]/opengraph-image.tsx` using `next/og` from block
  title + kind.
  *Acceptance:* a link paste into a chat client shows the OG card.
- **P2.4** Designed **404** (unknown alias) and **gone** (unpublished) states in
  the group.
  *Acceptance:* both states render designed, not default error pages.
- **P2.5** No authenticated API from the public route (dedicated public resolver
  path / read-only key or unauthenticated read endpoint).
  *Acceptance:* network trace shows no authenticated API call; Lighthouse perf clears the marketing bar.

### D3 — Visibility and grants  → spec D3
- **P3.1** Three visibilities mapped to Grant primitives: `public`, `unlisted`,
  `private`. public/unlisted differ only in indexability. File: `publish.rs` (visibility→capability mapping) + `schema.rs`.
  *Acceptance:* visibility persists and is queryable per block.
- **P3.2** Indexability: `unlisted` and `private` carry `noindex`; `public` is
  in `sitemap.xml` and robots-allowed. Files: `(published)` `robots`/`sitemap`.
  *Acceptance:* unlisted pages absent from sitemap and carry noindex.
- **P3.3** Private gate: a signed-in principal whose delegation chain satisfies
  the Grant resolves; a non-granted one gets a designed refusal. Sign-in
  interstitial returns to the block. Files: `(published)/p/[alias]` gate + NextAuth (`apps/web/src/lib/auth.ts`).
  *Acceptance:* private URL logged-out shows interstitial, resolves after sign-in for a granted principal, refuses a non-granted one.
- **P3.4** Visibility changeable post-publish from the artifact surface; takes
  effect on next request.
  *Acceptance:* flipping public→private takes effect immediately.

### D4 — The publish moment in-product  → spec D4
- **P4.1** A single `PublishAction` component: inline visibility choice (default
  **unlisted**), oxblood register (`--cp-oxblood`), wherever artifacts appear —
  chat artifact cards, `SceneHost`, block views, the write surface. Files: `apps/web/src/components/commonplace/publish/PublishAction.tsx` + mount points.
  *Acceptance:* publish from a chat artifact card round-trips to a working URL in one action + one confirmation.
- **P4.2** Confirmation: URL, one-press copy, visibility shown.
  *Acceptance:* copy affordance works.
- **P4.3** Published state persisted + shown on the artifact thereafter (link
  glyph + visibility).
  *Acceptance:* the artifact shows its published state on revisit.
- **P4.4** Publish event lands in the session rail with the receipt. (Depends on
  a session-rail primitive — shared with HANDOFF-CARRY D5; see cross-spec note.)
  *Acceptance:* the rail records the event with the receipt.

### D5 — The doorway  → spec D5
- **P5.1** `Open in CommonPlace` on every published page. Signed-in → block
  **referenced** into the visitor's space with origin provenance (not a copy).
  Files: `(published)` doorway component + a `referenceBlock` mutation.
  *Acceptance:* signed-in path lands the reference with origin provenance intact.
- **P5.2** Signed-out → sign-up, block resolved immediately after the round trip
  (carry the block ref through auth return URL).
  *Acceptance:* signed-out path survives the sign-up round trip and resolves the block.
- **P5.3** Fork semantics (owned divergent copy) on the same action where the
  Grant permits; labeled distinctly; hidden when the Grant forbids forking.
  *Acceptance:* a Grant that forbids forking hides the fork label, reference intact.

---

## FD-P1 — Cryptographic attestation signing + per-tenant keystore (RESOLVED, built)

Originally a forced deferral; **un-deferred and implemented** this session at the
user's direction. Ed25519 signing + a per-tenant keystore now ship in the product
repo (`apps/commonplace-api/src/keystore.rs`), signing the block content identity
at the P1.2 plug-in point. The verified-block affordance surfaces three honest
provenance tiers (signed+tenant / signed+dev / identity+conformance fallback).
Verification is self-contained and tamper-evident; the secret never crosses the
API. See `DEFERRED-attestation-signing.md` (now marked IMPLEMENTED) for detail.

## Non-goals (from spec — no tasks, by design)
L2 contract-bearing publish; comments/reactions/social layer; custom domains;
analytics beyond a private owner view counter (P1.1 includes the counter);
billing enforcement on private (the Grant machinery ships; the paywall waits).

## Proof commands
- Rust API: `cargo test --manifest-path apps/commonplace-api/Cargo.toml publish`
- Web: `pnpm --filter web test` + dev-server verification of `/p/:alias` (render, OG, 404/gone, no-auth network trace).
