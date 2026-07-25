# 37 — Checkout consolidation

Register: product-checkout consolidation (distinct from the Rust API fork
learning). Ratified approach: Creative/Website is the sole primary CommonPlace
clone; Tech Dev Local is salvaged then retired.

Companions:
- [37-CHECKOUT-CONSOLIDATION-CENSUS.md](./37-CHECKOUT-CONSOLIDATION-CENSUS.md)
- [../../learnings/2026-07-24-material-layer-lives-in-creative-checkout.md](../../learnings/2026-07-24-material-layer-lives-in-creative-checkout.md)
- [../../learnings/2026-07-20-two-divergent-commonplace-forks.md](../../learnings/2026-07-20-two-divergent-commonplace-forks.md) (Rust forks; out of scope here)

## Decision

Canonical home: `Creative/Website/CommonPlace` (or any clone that carries
`.commonplace-canonical` and `apps/console/src/components/ground/MaterialLayer.tsx`).

## Delivered in-repo (this PR / branch)

| ID | State |
|---|---|
| C1 census | shipped (`37-CHECKOUT-CONSOLIDATION-CENSUS.md`) |
| C2 salvage | shipped from `origin/claude/console-desktop-export` (`3580480`): `apps/browser-native`, `packages/host-bridge`, `crates/browser-core`, `crates/interaction-arbiter`, console host wiring, native-shell docs/spec. Mac-only tip `7ddca69` was never on origin; host script pushes it if still local. |
| C3 / C4 host ops | script: `scripts/retire-techdev-clone.sh` (run on the Mac) |
| C5 harden | `.commonplace-canonical`, `scripts/assert-canonical-root.mjs`, wired into `apps/console` `gates` as `gate:canonical-root` |

## Host one-shot (Mac)

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace"
git fetch origin && git checkout <this-branch>   # or merge main after PR
bash scripts/retire-techdev-clone.sh             # archive + stub README
# after verifying salvage and disk:
bash scripts/retire-techdev-clone.sh --delete
```

Open Cursor only against the Creative path afterward.

## Acceptance

1. Primary day-to-day root is Creative/Website (or cloud clone with MaterialLayer).
2. Tech Dev Local is archived/stubbed via the host script (not runnable as product root).
3. MaterialLayer and native-shell packages exist on one tip.
4. `npm run gate:canonical-root` (via `gates`) fails without the marker/MaterialLayer.
5. Host script reclaims disk when `--delete` is used.

## Out of scope

Theorem vs CommonPlace Rust `commonplace-api` fork merge.
