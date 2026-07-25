# CommonPlace agent defaults

## Canonical checkout

Day-to-day CommonPlace product work (especially `apps/console` island /
MaterialLayer) uses one primary clone:

`/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace`

Sentinels: `.commonplace-canonical` and
`apps/console/src/components/ground/MaterialLayer.tsx`.
`npm --prefix apps/console run gate:canonical-root` fails without them.

Do not open a second full clone at `Tech Dev Local/CommonPlace` as an agent
workspace. If that path still exists, retire it once:

```bash
bash scripts/retire-techdev-clone.sh
```

See `docs/plans/console/37-CHECKOUT-CONSOLIDATION.md`.

## Console constitution

`apps/console/AGENTS.md` and `apps/console/CLAUDE.md` carry the console fence
and gates. Prefer those when editing under `apps/console/`.
