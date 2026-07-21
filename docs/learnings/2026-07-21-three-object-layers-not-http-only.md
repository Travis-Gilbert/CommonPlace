# Three different "object" layers; grepping only /objects HTTP is a false negative

**Kind:** gotcha
**Captured:** 2026-07-21T01:44:00Z
**Session signature:** console-block-system-B6
**Domain tags:** theorem, commonplace, objects-seam, console

## Trigger

B6b handoff named "Theorem commonplace-api." An agent grepped Theorem
`apps/commonplace-api` for `/objects/query|action|views`, found none, and
reported that Theorem has no object seam. That was false. Theorem already has
objects in at least two other places:

1. Cold content-addressed store:
   `rustyredcore_THG/crates/rustyred-thg-core/src/object_store.rs`
2. Block-view host bridge (Jotai ObjectSet / emit):
   `rustyredcore_THG/crates/commonplace-web/web/src/atoms/objects.ts`
   (backed by `rustyredcore_THG/crates/commonplace` `block_view.rs`)

The console's `HttpBlockHost` happens to proxy HTTP `/objects/*` to CommonPlace
`apps/commonplace-api` via `CONSOLE_DATA_API_URL`. That is a wire choice, not
proof that Theorem lacks an object model.

Falsifiable: those two Theorem paths exist and define object APIs; absence of
HTTP `/objects/*` on Theorem `serve.rs` does not delete them.

## Rule

Before saying "Theorem has no X objects," name which layer you mean: cold
`ColdObjectStore`, block-view `ObjectRef`/`ObjectAction` (+ web atoms), or HTTP
`/objects/*`. Grep the layer you need; do not collapse all three under one
absence claim.

## Evidence

- `Theorem/rustyredcore_THG/crates/rustyred-thg-core/src/object_store.rs`
- `Theorem/rustyredcore_THG/crates/commonplace-web/web/src/atoms/objects.ts`
- `Theorem/rustyredcore_THG/crates/commonplace/src/block_view.rs`
- `CommonPlace/apps/console/src/app/api/objects/_upstream.ts`
- User correction this session (paths above)

## Encoded in

- `docs/learnings/2026-07-21-three-object-layers-not-http-only.md` (this file)
