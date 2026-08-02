# Modifications to different-ai/openwork

Upstream: https://github.com/different-ai/openwork (MIT for the vendored subset).
Pinned at `2f2dde65796428109a665f3b733843fe3896b933`, branch `dev`, vendored
2026-08-02. See `UPSTREAM.md` for the vendoring map and the cherry-pick posture.

Every divergence from upstream is recorded here. Required by the MIT notice
obligation and by named choice 1.

## Day-one sever (SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW1)

### Telemetry — removed

- `apps/chat/src/app/lib/analytics-key.ts` — **deleted**. It carried a hardcoded
  PostHog publishable project key that was used by default in any non-dev build.
- `apps/chat/tests/analytics-key.test.ts` — **deleted** with it.
- `apps/chat/src/app/lib/analytics.ts` — **rewritten** as a typed no-op. The
  PostHog host, key, event queue, batching, flush, and the `$identify` call that
  linked the anonymous id to the signed-in Den user are all gone. The exported
  surface and the local inspector mirror (`window.__openwork.record`) are kept so
  call sites compile and coded evals still observe instrumentation.
- `apps/chat/src/app/lib/den-telemetry.ts` — **rewritten** as a no-op. Upstream
  posted usage signals to `POST {denBaseUrl}/v1/telemetry/ingest`.

### Den — severed

- `apps/chat/src/app/lib/den.ts` — the build-time Den base URL and its
  `https://app.openworklabs.com` fallback are **replaced with empty literals**,
  and `VITE_DEN_REQUIRE_SIGNIN` is **replaced with a statically-false constant**.
  A new `DEN_ENABLED = false as const` export gives Vite a literal to
  dead-code-eliminate against, which is what OW4 requires: the flags leave the
  build rather than merely defaulting off at runtime.
- `apps/chat/package.json` — `build:web` no longer sets `VITE_DEN_REQUIRE_SIGNIN=1`.
  `build` and `dev:web` now set `VITE_OPENWORK_DEPLOYMENT=web` explicitly, because
  the upstream switch defaults to `desktop` when the variable is unset.
- `@openwork/install-config` — **dropped from dependencies**. Its only consumer
  was the Den join-organization dialog.

### Hosted model catalog — removed

- `apps/chat-server/src/opencode-models-url.ts` — upstream returned
  `https://models.openworklabs.com/` whenever `OPENWORK_DEV_MODE !== "1"`, so
  every non-dev session start fetched a catalog from a third-party host. The
  default is removed. Resolution is now: explicit `OPENCODE_MODELS_URL`, else the
  loopback dev catalog if it answers, else no override at all.
- `apps/chat-server/src/cli.ts`, `apps/chat-server/src/embedded.ts` — the
  `OPENCODE_MODELS_URL` env var is now conditionally spread, so an empty
  resolution omits the variable instead of passing an empty string to opencode.
- `apps/chat-server/src/opencode-models-url.test.ts` — the three tests that
  asserted the openworklabs default are rewritten to assert the severed behavior,
  plus a new test that fails if any resolution path yields an `openworklabs.com`
  host. This is the regression guard for cherry-picks.

### Package identity

- `apps/app` → `apps/chat`, renamed `@openwork/app` → `@commonplace/chat`, and an
  explicit `"license": "MIT"` added (upstream declared no license field on this
  package and relied on the root LICENSE's residual clause).
- `apps/server` → `apps/chat-server`, renamed `openwork-server` →
  `@commonplace/chat-server`.
- `packages/{ui,types,paths}` → `packages/openwork-{ui,types,paths}`. Package
  names deliberately unchanged; see `UPSTREAM.md`.

### Den quick-connect entries and the Den-knowledge plugin — removed

- `apps/chat/src/app/constants.ts` — two `MCP_QUICK_CONNECT` entries deleted.
  `openwork-cloud` was the Den control-plane MCP whose `url` getter fell back to
  `https://app.openworklabs.com/api/den/mcp/agent`; that fallback was the last
  live egress path to the donor in the web bundle. `openwork-ui` spawned
  `npx -y openwork-ui-mcp`, fetching a package from the npm registry at runtime
  for a surface this fork quarried rather than adopted.
- `apps/chat-server/src/opencode-plugins/openwork-capabilities-knowledge.ts` and
  its test — **deleted**. The plugin injected a static knowledge block naming
  Den's capability, auth, and OAuth endpoints as truth, which under a Theorem
  head is actively wrong context. Its registration is removed from
  `openwork-runtime-config.ts`, its path helper from
  `openwork-extensions-plugin-path.ts`, its marker from `legacy-config-sweep.ts`,
  and its hash from `cloud-mcp-health.ts`.
- `apps/chat-server/src/agent-context-cloud-probe.ts` — the default trusted-origin
  allowlist (`app.openworklabs.com`, `api.openworklabs.com`) is now empty. No
  origin is trusted by default; a workspace names its own.

### Donor branding and destinations — removed

- `apps/chat/src/app/lib/feedback.ts` — the `openworklabs.com/feedback` default is
  removed; feedback is opt-in via `VITE_OPENWORK_FEEDBACK_URL`.
- `apps/chat/src/react-app/design-system/provider-logo-src.ts` — `openwork` removed
  from the provider→domain favicon map.
- `apps/chat/src/react-app/domains/session/sidebar/account-status-menu.tsx` — docs
  URL now reads `VITE_OPENWORK_DOCS_URL` instead of hardcoding donor docs.
- `apps/chat/src/react-app/domains/workspace/openwork-den-help-link.tsx` and
  `remote-workspace-diagnostics.ts` — `team@openworklabs.com` removed from the
  support link and from user-facing error copy.
- `packages/openwork-ui/src/react/roadmap.tsx` — donor `feedbackHref`/`docsHref`
  defaults emptied; callers supply CommonPlace destinations.
- `side-panel.tsx`, `session-surface.tsx` — renderer fixture markdown linked to
  openworklabs.com and therefore shipped the donor host in the bundle. Repointed.

### Build integration

- `apps/chat/package.json` — `react`/`react-dom` moved off pnpm `catalog:`
  specifiers (CommonPlace's workspace defines no catalog) and pinned to
  **19.2.3**, the version console/desktop/mobile already use, so the workspace
  resolves one React. Upstream's catalog said 19.2.8.
- `apps/chat/package.json` — `motion` pinned to **12.38.0** and
  `@tanstack/react-query` to **5.96.2**, matching upstream's lockfile at the
  vendored SHA. The caret ranges had floated to 12.42.2 / 5.101.2, whose changed
  type signatures broke code upstream compiles cleanly.
- `apps/chat/src/components/panel-tabs.tsx` — `Reorder.Group<Value, "div">` →
  `<Value[], "div">`. `motion` depends on `framer-motion` by caret, so it resolves
  to 12.42.2 regardless of the `motion` pin, and from 12.40 the first type
  parameter is the array type. Pinning framer-motion repo-wide would force that
  version on the console, so the local annotation is the narrower fix.
- `apps/chat-server/constants.json` — upstream imported
  `../../../constants.json` from the monorepo root, which was not vendored. The
  file (one field, `opencodeVersion`) now sits beside the package.

## Pending, with owning deliverable

Recorded so the gap is visible rather than implied. Known-remaining work, not
accepted state:

- The Den **view surfaces** (`domains/settings/pages/cloud-*`, `domains/cloud/*`,
  `shell/cloud-workspace-*`, `welcome-den-session.ts`) are still present in the
  tree. With `DEN_ENABLED` statically false they are unreachable and the bundle
  scan confirms they carry no donor host, but they have not been deleted.
  Deleting them unwinds the onboarding surface, which is coupled to OW4's console
  session work. **OW4.**
- `apps/chat-server/src/enterprise-den-origin.ts` resolves an enterprise Den
  control-plane origin. Inert with Den severed; not yet deleted. **OW4.**
- `welcome-route.tsx` retains a now-inert `joinOrganizationOpen` state and its
  `onJoinOrganization` prop after the dialog was removed. Unwinding the prop
  touches the onboarding component interface, so it rides with the view deletion
  above. **OW4.**
- `cdn.simpleicons.org` is fetched for provider favicons — a genuine third-party
  request the app makes on its own behalf, unlike the user-configured connector
  hosts (Google Workspace, OpenAI, GitHub Copilot, and the `mcp.*` quick-connect
  catalog), which are only contacted when an operator configures them. The
  favicon CDN should be self-hosted or dropped before the full-session
  network-trace criterion is claimed without qualification. **OW1 residual.**
- Raw hex colors in `design-system/workspace-avatar-utils.ts` and `page.tsx`
  violate the one-token-truth rule and are the current failing check in
  `scripts/audit-openwork-fork.sh`. **OW3.**

## Retirements from the console (OW7)

None yet. The assistant-ui chat components under `apps/console/src/components/chat`
and `apps/console/src/views/ThreadView.tsx` are retired only when their
replacements land; the deletion list is recorded here on that day.
