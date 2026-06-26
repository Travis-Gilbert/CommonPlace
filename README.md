# CommonPlace

You have too many tools. They need a CommonPlace.

This repository is the product home for CommonPlace: the deployed workspace at
`travisgilbert.me/commonplace`, its desktop shell, shared UI packages, and the
contracts it consumes from RustyRed and Theorem.

## Current foundation

- `apps/web/` is the real Next.js CommonPlace frontend migrated from
  `travisgilbert.me`, including the `/commonplace` route and the existing
  desktop static export script.
- `apps/desktop/` is the Tauri shell for packaging CommonPlace from this repo.
- `apps/commonplace-api/` is the backend GraphQL/MCP block contract moved into
  the product repo. It currently bridges to the sibling Theorem checkout for
  RustyRed and harness crates.
- `crates/commonplace-desktop-runtime/` is the native desktop runtime that
  starts the local RustyRed node, durable `commonplace-api`, and Theorem
  receiver loop behind the Tauri shell.
- `packages/block-view-contracts/` contains the frontend-safe block/view and
  RustyRed data contracts consumed by the web app and future adapters.
- `packages/rustyred-contracts/` records the pinned RustyRed source revision.
- `crates/commonplace-browser-substrate/` ports the Servo-free browser page
  capture seam for CommonPlace while Theorem keeps its harness browser.
- `.github/workflows/rustyred-source-update.yml` receives RustyRed update
  dispatches and opens CommonPlace PRs.
- `docs/rustyred-update-channel.md` documents the cross-repo automation.
- `docs/browser-migration.md` documents how to port the product-facing browser
  into CommonPlace while keeping Theorem's harness-native browser intact.

## Local commands

```bash
npm run check
npm run check:rust
npm run web:dev
npm run web:build:desktop
npm run desktop:dev
npm run desktop:build
npm run api:dev
npm run sync:rustyred -- --repo Travis-Gilbert/RustyRed-Graph-Database --ref main
```

`npm run api:dev` expects this local layout until the Theorem/RustyRed crates
are published or git-pinned:

```text
Website/
  CommonPlace/
  Theorem/
```

## Product rule

Anything user-facing that says CommonPlace belongs here. RustyRed and Theorem
power the product through explicit contracts, packages, and adapters.
