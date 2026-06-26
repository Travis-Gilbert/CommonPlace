# 001: CommonPlace repo foundation and RustyRed updates

## Decision

CommonPlace should be the product monorepo for the deployed product surface.
RustyRed remains its own source-of-truth repository. CommonPlace consumes it
through pinned contracts and generated packages.

## Why

This avoids the recent split-brain problem where Theorem's `/Commonplace`
prototype looked like the product but was not the deployed
`travisgilbert.me/commonplace` site.

The deployed CommonPlace app should own the user-facing shell. RustyRed and
Theorem should power that shell through explicit package and API boundaries.

## Initial implementation

- Root `package.json` with a workspace for CommonPlace packages.
- `@commonplace/rustyred-contracts`, initially containing the RustyRed source pin.
- `scripts/update-rustyred-source.mjs` for local and CI pin updates.
- `.github/workflows/rustyred-source-update.yml` to receive RustyRed dispatches
  and open update PRs.
- `crates/commonplace-browser-substrate`, a Servo-free product port of the
  browser page capture seam. Theorem keeps its harness-native browser copy.

## Next migration targets

1. Move the real `travisgilbert.me/commonplace` web app into `apps/web`.
2. Generate TypeScript contracts in `packages/rustyred-contracts`.
3. Move block/view contracts into a package consumed by `apps/web`.
4. Add the RustyRed graph-store adapter behind the browser substrate seam once
   shared RustyRed crates are published or vendored behind a clean boundary.
