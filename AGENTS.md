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
| 2026-08-16 | AgentFS stays in Theorem and deploys with the Dioxus Rust site (`UI/canvas-gallery` and dioxus-library surfaces). CommonPlace `/IDE` is not the AgentFS OS door; it remains Studio/code-server rollback. | User: the filesystem is Theorem-side and ships with the Dioxus site. Board: `plans/intellij-absorption-1.0/nodes/d12-agentfs-dioxus-host.md`. |
| 2026-08-16 | RustyRed's OS filesystem is AgentFS (POSIX over the graph, FUSE when `/dev/fuse` exists). Fly same-kernel is the hosted first-class case. Host OS directories (`HostFs`, git checkout as the read path, unmounted MCP) are fallback. Product IDE workspaces open into AgentFS; a laptop folder picker is ingest. | The substrate already is a filesystem; Fly is what makes presenting it as a real OS the normal hosted path instead of an opt-in. Board: `plans/intellij-absorption-1.0/nodes/d11-agentfs-os.md`. |
| 2026-08-16 | All theoremweb.com hosting is on Fly. Apex `https://theoremweb.com` and `https://context.theoremweb.com` serve Theseus (`travis-theoremweb`). Console stays `https://apps.theoremweb.com` (`travis-commonplace-console`). Lapce wasm workbench is `https://ide.theoremweb.com` (`travis-theorem-ide`). Vercel remains registrar/DNS only. `https://v2.theoremharness.com` remains a live alias. | Apex Theseus moved off the Vercel project `context-theorem-ui`; console was already on Fly. |
| 2026-08-15 | Product console alias is `https://apps.theoremweb.com`. Apex `https://theoremweb.com` stays the existing Theseus site. `https://v2.theoremharness.com` remains a live alias. | Superseded 2026-08-16: apex Theseus moved to Fly; console still on the `apps` subdomain. |
| 2026-07-29 | `apps/browser-native` is the canonical GPUI/Wry mixed-realm browser host, while the existing Tauri edition loads `https://v2.theoremharness.com` as its main surface and owns PET as a local extension window. Neither native host launches the deprecated local Vite desktop renderer as the product UI. | The browser-chrome 1.1 amendment makes the native-shell spec canonical, and the product frontend boundary requires all product UI to come from the CommonPlace v2 Console. PET still needs a local transparent webview for native drag, voice, and capture behavior. |
| 2026-07-28 | PET is an extension of the existing `apps/desktop` Tauri app, never a second app or bundle. A separate frameless PET window is allowed only inside the same `CommonPlace.app` process; it uses the current CommonPlace pixel pet and shows no product chrome beyond its composer. | CommonPlace owns all product frontend and already provides the canonical desktop lifecycle, settings, identity, and host bridge. Reusing that shell prevents the legacy Theorem Shade mini-app from becoming a second product surface. |
| 2026-07-26 | Console harness GraphQL travels through `graphql_query` and `graphql_mutate` on the configured `/mcp` door. `THEOREM_GRAPHQL_URL` remains a consumer API setting and must not route harness-schema calls. | The deployed `theorem-mcp-server` has no `/graphql` route, and the harness and CommonPlace consumer schemas are distinct contracts. |

## Console constitution

`apps/console/AGENTS.md` and `apps/console/CLAUDE.md` carry the console fence
and gates. Prefer those when editing under `apps/console/`.
