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

## Recent decisions

| Date | Decision | Why |
|---|---|---|
| 2026-07-28 | Implement PET only as an extension of the existing CommonPlace `apps/desktop` Tauri application; do not create or ship a second app or bundle. Preserve the current CommonPlace pet UI and attach only its composer—no page, card, header, settings panel, roster, fixture controls, window chrome, or other shell around the pet. A separate frameless pet surface is allowed only when it is a window owned by the same `CommonPlace.app` process and bundle. | The Theorem PET React surface and standalone bundle are legacy. Native voice and capture capabilities must enhance the current CommonPlace creature through the existing desktop runtime and host bridge without replacing or surrounding its newer design. |
| 2026-07-26 | Console harness GraphQL travels through `graphql_query` and `graphql_mutate` on the configured `/mcp` door. `THEOREM_GRAPHQL_URL` remains a consumer API setting and must not route harness-schema calls. | The deployed `theorem-mcp-server` has no `/graphql` route, and the harness and CommonPlace consumer schemas are distinct contracts. |

## Console constitution

`apps/console/AGENTS.md` and `apps/console/CLAUDE.md` carry the console fence
and gates. Prefer those when editing under `apps/console/`.
