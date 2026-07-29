# CommonPlace

You have too many tools. They need a CommonPlace.

This repository is the product home for CommonPlace: the deployed workspace at

contracts it consumes from RustyRed and Theorem.

## Canonical checkout

Day-to-day product work (especially `apps/console` island MaterialLayer) must
use one primary clone. On the author machine that is:

`/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace`

Sentinel files: `.commonplace-canonical` and
`apps/console/src/components/ground/MaterialLayer.tsx`.
`npm --prefix apps/console run gate:canonical-root` fails without them.
Do not use a second full clone under `Tech Dev Local/CommonPlace` as an agent
root; retire it with `scripts/retire-techdev-clone.sh` (see
`docs/plans/console/37-CHECKOUT-CONSOLIDATION.md`).

## Current foundation

- `apps/Console/` is the real Next.js CommonPlace frontend migrated from
  `travisgilbert.me`, including the `/commonplace` route and the existing
  desktop static export script.
- `apps/browser-native/` is the canonical GPUI/Wry mixed-realm browser shell:
  native chrome around the hosted CommonPlace React surface and parented Servo
  panes.
- `apps/desktop/` is the existing Tauri edition. Its main window loads
  `https://v2.theoremharness.com`, and the same `CommonPlace.app` process owns a
  frameless PET extension window containing only the current CommonPlace pixel
  pet and composer; there is no separate PET app or bundle.
- `apps/commonplace-api/` is the backend GraphQL/MCP block contract moved into
  the product repo. It currently bridges to the sibling Theorem checkout for
  RustyRed and harness crates.
- `crates/commonplace/` is the CommonPlace-owned graph-native object model,
  ingest, organize, renderable object, and block/view contract crate.
- `crates/commonplace-desktop-runtime/` is the native desktop runtime that
  starts the local RustyRed node, durable `commonplace-api`, and Theorem
  receiver loop behind the Tauri shell. It also registers Theorem's native PET
  plugin for capture, local voice, read-aloud, macOS Services, and Stand Down.
- `packages/capture-client/` is the versioned Capture 2.0 envelope and durable
  ordered queue shared by CommonPlace-owned capture surfaces.
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
