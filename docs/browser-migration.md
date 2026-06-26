# Browser port plan

The browser currently lives in Theorem:

```txt
apps/browser/             # Servo embedder, heavy build
apps/browser-substrate/   # Servo-free page -> RustyRed substrate seam
```

Do not remove it from Theorem. The Theorem copy is part of the harness skill
and ability surface: browser-use perception, page ingestion, graph-backed web
state, and local substrate affordances.

CommonPlace should get a product-facing port or copy of the useful browser
pieces, with Theorem remaining a source/reference harness implementation.

## Stage 1: port the Servo-free seam

Port or copy `apps/browser-substrate` first. It has the stable product value:

- converts loaded pages into RustyRed graph state;
- exposes browser affordance contracts;
- builds and tests without Servo;
- can be reused by desktop, clipper, web capture, or a future Servo browser.

Suggested CommonPlace destination:

```txt
crates/commonplace-browser-substrate/
```

Status: done for the product-facing contract. CommonPlace now has
`crates/commonplace-browser-substrate`, which preserves the loaded-page,
affordance, page-graph-delta, receipt, and search/render seam without depending
on Servo or Theorem-local path dependencies.

This stage needs the RustyRed dependency boundary decided first: either git
dependencies pinned through `packages/rustyred-contracts/rustyred-source.json`,
or generated Rust contracts in a CommonPlace crate.

Keep the Theorem `apps/browser-substrate` copy unless and until the harness has a
replacement dependency boundary. CommonPlace's port can periodically sync from
Theorem or share a generated contract package.

The direct RustyRed `GraphStore` write adapter is intentionally deferred until
the shared RustyRed crates have a clean package boundary. The current
CommonPlace crate emits deterministic graph deltas for that adapter to persist.

## Stage 2: wire desktop and capture surfaces

Once the seam is in CommonPlace, route these surfaces through it:

- `apps/desktop` Tauri shell;
- browser extension / clipper capture;
- CommonPlace source intake;
- any local-first page ingestion.

## Stage 3: port or wrap the Servo embedder

Only port or wrap `apps/browser` after Stage 1 is stable. The Servo embedder has
a long CI/build tail and should stay isolated:

```txt
apps/browser/
.github/workflows/servo-browser.yml
```

Keep the Servo CI manual at first. The CommonPlace browser should call the
`commonplace-browser-substrate` crate rather than owning page-to-graph logic.
The Theorem browser should continue to exist for harness-native tasks.

## Rule

CommonPlace owns the user-facing browser product. Theorem owns the
harness-native browser capability. RustyRed owns graph storage and search. The
browser writes to RustyRed through contracts, not by embedding unbounded Theorem
internals.
