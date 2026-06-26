# 003: Product App Migration

## Status

Implemented initial migration.

## Decision

CommonPlace is now the canonical product repo for the real web app, desktop
shell, and product-facing backend contract:

- `apps/web` holds the Next.js frontend copied from `travisgilbert.me`.
- `apps/desktop` holds the Tauri shell and builds against `apps/web`.
- `apps/commonplace-api` holds the GraphQL/MCP CommonPlace API contract.
- `packages/block-view-contracts` holds portable TypeScript contracts for the
  block/view registry and RustyRed data payload.

## Why

The test subdomain path did not mirror the real `travisgilbert.me/commonplace`
site. Keeping product code in a separate preview shell made sidebar, route, and
token drift likely. Moving the real app into this repo gives future CommonPlace
work one launch point.

## Native Runtime

The Tauri shell builds from this repo and delegates its native command layer to
`crates/commonplace-desktop-runtime`. That runtime starts the embedded
`rustyred-thg` local node, starts the durable `commonplace-api` loopback server,
and wires the Theorem receiver dispatch loop back into the desktop commands.

`apps/commonplace-api` and `crates/commonplace-desktop-runtime` still depend on
sibling Theorem crates via local paths. Those should become published crates,
git-pinned crates, or CommonPlace-owned adapter crates before CI or remote
desktop packaging treats the native runtime as fully independent of a local
Theorem checkout.
