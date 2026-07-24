# Console island MaterialLayer is in Creative/Website, not Tech Dev Local/CommonPlace

**Kind:** gotcha
**Captured:** 2026-07-24
**Session signature:** `e7d593c`
**Domain tags:** commonplace, console, material-layer, workspace-root

## Trigger

Design-fix session started in `/Users/travisgilbert/Tech Dev Local/CommonPlace`.
Grep found no `MaterialLayer.tsx`; `int-ui-register.css` still had the older Int UI
ladder (`--ij-frame: #131314`). Claude's diagnosis cited hexes
(`#101112` / `#1A1B1E` / `#2C2F35`) and an intact `MaterialLayer.tsx` that only
exist under `/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace`.
Several turns were spent searching the wrong tree before `move_agent_to_root`.

This is not the Rust "two commonplace crates" fork scar
(`docs/learnings/2026-07-20-two-divergent-commonplace-forks.md`). It is two
product checkouts of the CommonPlace app repo on the same machine.

## Rule

Canonical product checkout: Creative/Website CommonPlace (marker
`.commonplace-canonical` plus
`apps/console/src/components/ground/MaterialLayer.tsx`). Do not open
`Tech Dev Local/CommonPlace` as an agent root. `npm run gate:canonical-root`
fails on a wrong tree. After consolidation, run
`scripts/retire-techdev-clone.sh` on the Mac host once.

## Evidence

- Missing in Tech Dev Local checkout: no `MaterialLayer.tsx` under `apps/console`
- Present in Creative checkout: `apps/console/src/components/ground/MaterialLayer.tsx`
- Commit that landed the design fix on the Creative branch: `e7d593c`
- Consolidation plan: `docs/plans/console/37-CHECKOUT-CONSOLIDATION.md`

## Encoded in

- `docs/learnings/2026-07-24-material-layer-lives-in-creative-checkout.md` (this file)
- `docs/plans/console/37-CHECKOUT-CONSOLIDATION.md`
- `.commonplace-canonical`
- `scripts/assert-canonical-root.mjs`
