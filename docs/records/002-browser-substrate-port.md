# 002: Browser substrate port

## Decision

CommonPlace now has its own `commonplace-browser-substrate` crate, but Theorem
keeps its browser crates. This is a port/copy of the product-facing contract,
not a move.

## Why

The browser is part of Theorem's harness skills and abilities. Removing it from
Theorem would make the harness weaker and would couple CommonPlace product work
to harness internals.

CommonPlace still needs the browser seam because the product owns web capture,
desktop browsing, clipper ingestion, and local-first page-to-graph flows.

## What was ported

- Browser affordance contract.
- `LoadedPage` input shape.
- Deterministic `PageGraphDelta`.
- Session receipts.
- In-memory search/render proof.

## What is intentionally not ported yet

- Direct RustyRed `GraphStore` writes.
- Durable RedCore browser sessions.
- Live RustyWeb fetch/search orchestration.
- Servo embedder.

Those depend on Theorem-local nested crates today. They should be added after
CommonPlace has a clean RustyRed crate/package boundary.
