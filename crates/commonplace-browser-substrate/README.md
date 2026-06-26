# commonplace-browser-substrate

Servo-free browser page capture seam for CommonPlace.

This crate ports the product-facing shape of Theorem's `apps/browser-substrate`
without moving or deleting the Theorem copy. Theorem keeps the harness-native
browser. CommonPlace gets its own browser substrate contract for desktop,
clipper, and product-facing capture flows.

Current scope:

- loaded page contract;
- deterministic page graph delta;
- browser affordance list;
- session receipts;
- in-memory search/render proof.

Deferred until the RustyRed crates have a clean package boundary:

- direct RustyRed `GraphStore` writes;
- durable RedCore-backed browser sessions;
- live fetch/search orchestration through RustyWeb.
