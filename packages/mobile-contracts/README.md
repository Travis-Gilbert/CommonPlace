# @commonplace/mobile-contracts

This package is the CommonPlace-side boundary for the mobile kernel contracts:
Object Schema v2, Run Event v1, and Remote Surface v1.

`mobile-contract-source.json` pins the exact Theorem source revision. The update
workflow fetches ts-rs output and canonical JSON fixtures from that revision,
runs this package's conformance check, and opens a CommonPlace pull request.

Do not edit declarations under `src/generated/` by hand. Change the Rust wire
types in `Travis-Gilbert/Theorem`, regenerate there, and let the dispatch
pipeline synchronize this package from the source pin.

The root and module barrels are generated from the synchronized file inventory
by `npm run generate`; `npm run check` refuses barrel drift before typechecking
the shared JSON fixtures.
