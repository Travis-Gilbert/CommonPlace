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

## Deferred

The Tauri shell now builds from this repo and exposes the expected command names
through a lightweight command shim. The full embedded native runtime is still a
backend integration:

- embedded `rustyred-thg` local node
- Theorem receiver dispatch loop
- durable `commonplace-api` spawning from the shell

`apps/commonplace-api` still depends on sibling Theorem crates via local paths.
Those should become published crates, git-pinned crates, or CommonPlace-owned
adapter crates before CI or remote desktop packaging treats the API as fully
independent.
