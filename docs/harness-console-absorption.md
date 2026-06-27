# Harness Console Absorption

CommonPlace is the product surface for CommonPlace-looking work. The Theorem
console can keep internal diagnostics, but user-facing workspace, agent, code,
account, desktop, and data views should land in this repository and use
CommonPlace tokens.

## Product Placements

| Theorem console source | CommonPlace placement | Notes |
| --- | --- | --- |
| `/agent` | `System > Accounts > Theorem Agent` and `Agent Thread` pane | Uses `apps/web/src/app/api/theorem/agent/route.ts`. |
| `/Commonplace#code` and code workspace shell | `Work > Code` pane | Uses the CommonPlace agent thread and ACP dock contracts. |
| `/providers` | `System > Accounts > Providers` | Provider secrets stay in CommonPlace desktop/keychain paths. |
| `/connections` | `System > Accounts > Connections` | Hosted and local Theorem endpoints are account settings, not console-only settings. |
| `/keys` | `System > Accounts > Keys` | Install and bearer material must stay out of browser-visible config. |
| `/usage` and `/runs` | `System > Accounts > Usage` plus future run ledger | Runs should be scoped to the active CommonPlace tenant. |
| `/rooms` | `System > Desktop > Coordination` | Uses the existing coordination surface. |
| `/inbox` | `System > Desktop > Receiver` | Uses the existing receiver surface. |
| `/canvas` | `Models > Free` | Spatial work belongs in the board surface. |
| `/memory` | `Library`, `Map`, and search | Memory is ambient context, not a separate product island. |
| `/skills` | `System > Accounts` or `Work > Code` | Expose skills where they affect the selected agent or workspace. |

## Backend Direction

- CommonPlace UI calls the product routes in `apps/web/src/app/api/*`.
- The Omnibar and agent thread call `/api/theorem/agent`, which normalizes to the
  Theorem agent run endpoint.
- ACP-native agents dock through `apps/web/src/lib/commonplace-acp.ts`.
- CommonPlace-owned Rust and API work stays in `apps/commonplace-api/`,
  `apps/commonplace-collab/`, and `crates/commonplace-*`.
- New product screens should not import from `Theorem/apps/harness-console`.

## Token Rule

Absorbed surfaces should use `--cp-*` tokens and existing CommonPlace layout
primitives. If a prototype component carries Theorem-specific styling, port the
behavior and data contract first, then recompose the surface in CommonPlace.
