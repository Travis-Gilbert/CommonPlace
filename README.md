# CommonPlace

You have too many tools. They need a CommonPlace.

This repository is the product home for CommonPlace: the deployed workspace at
`travisgilbert.me/commonplace`, its desktop shell, shared UI packages, and the
contracts it consumes from RustyRed and Theorem.

## Current foundation

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
npm run sync:rustyred -- --repo Travis-Gilbert/RustyRed-Graph-Database --ref main
```

## Product rule

Anything user-facing that says CommonPlace belongs here. RustyRed and Theorem
power the product through explicit contracts, packages, and adapters.
