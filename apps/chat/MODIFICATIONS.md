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

## Token and shader binding (OW3)

- `scripts/generate-console-register.mjs` emits `src/styles/console-register.css`
  from the console's own registers (`galley-register`, `int-ui-register`,
  `int-ui-register-light`, `register-bridge`, `gy-bridge`). The chat register is
  a separate Vite app and cannot import the console's stylesheets, so the
  resolved values are materialized. `check-console-register.mjs` fails on drift,
  and the generator hard-errors on any emitted token whose `var()` head no
  source register defines: such a token resolves to nothing, which is invisible
  in review and in a screenshot of a surface that happens not to use it.
- The console's bare selector is dark and light is the override; the fork's
  `:root` is light. The generator composes `dark ∪ light` for `:root` and emits
  the bare base under the dark selector, which is what the console's cascade
  resolves. A direct copy would invert every color.
- `src/app/index.css` — **both** semantic layers rebind to the register.
  Upstream's own `--dls-*` layer is read by dozens of components, so binding
  only the shadcn slots would have left most surfaces on the donor's Radix
  palette. The dark override block is deleted: mode now lives in the token.
- Radius: upstream multiplied one base by seven coefficients, producing values
  no register chose. The scale points at the console's five-step ladder.
- Fonts: `@fontsource-variable/geist` **dropped**. It shipped a font file that
  no rule ever named, and the two `@fontsource` imports were inert because the
  body stack was a literal system list. `--font-sans`, `--font-heading`, and
  `--font-mono` now resolve to `--ij-font-ui`, `--cp-font-title`, and
  `--ij-font-mono`; JetBrains Mono and Manrope are added so the three faces the
  tokens declare are the three faces that ship. Verified against the build:
  `ibm`, `jetbrains`, `manrope`, and KaTeX's math faces, which belong to the
  math renderer rather than to the type system.
- Raw hex leaves component source. `design-system/workspace-avatar-utils.ts`
  and `sidebar/utils.ts` read `src/styles/identity-register.css`, whose ramp is
  built from console hue families; `app-sidebar.tsx`'s outcome dots read
  `--ij-ok` and `--ij-warn`. The boring-avatars palette table moves to
  `src/styles/marble-avatar-palettes.ts`, matching the console's own precedent
  for an adopted third-party palette (`jalco-file-tree-colors.ts`); it cannot be
  tokenized because boring-avatars emits the values as literal SVG fills.
- `design-system/register-token.ts` — WebGL uniforms, xterm's `ITheme`, and the
  avatar palettes take literal color strings and would render `var(--ij-ink)` as
  an invalid color. They read the register through `getComputedStyle` and
  re-read on a scheme change, which a frozen literal never did.
- **Shader law, one mount per window.** `PageBackground`'s dither is the mount.
  `welcome-page.tsx` held a second inline copy, and the activity orbs each held
  their own `PaperGrainGradient`, one per in-flight message, so the count was
  unbounded against a per-document WebGL context limit of about sixteen. The
  orbs are now `design-system/grain-orb.tsx`, a conic gradient on the
  compositor. `page.tsx`'s `dark:invert` is gone with the literal it corrected.
  `scripts/check-shader-mounts.mjs` holds the line.

## Auth and serving (OW4)

- `apps/chat-server/src/console-session.ts` — verifies the console's signed
  `cp_active_workspace` cookie. Verify half only: this daemon never mints a
  session, so it never holds the signing key in a writing role. The wire format
  is pinned by `console-session.test.ts` against a frozen fixture **and** a live
  round-trip through the console's own encoder, because the two halves live in
  different apps and nothing else would fail if they diverged.
- `server.ts` — a console session is an Actor with owner scope, checked before
  bearer tokens on both the client and host paths. `routes/core.ts` serves
  `GET /session/console`, unauthenticated on purpose: the cookie is HttpOnly, so
  the page cannot read it, and a 401 would be indistinguishable from the daemon
  being unreachable. It reports `configured` separately from `authenticated` so
  a standalone workspace is not mistaken for a signed-out console user.
- `shell/console-session-gate.tsx` replaces upstream's `DenSigninGate`, which
  held the UI at `/signin` and bounced between three routes while revalidating a
  cached Den token. It renders children in every case but one, and never flashes
  a sign-in during the check.
- **Deleted:** `domains/cloud/{den-signin-surface,forced-signin-page,
  enterprise-activation-gate,org-onboarding-page,signin-fallback-notice}.tsx`,
  `shell/{cloud-workspace-overlay,cloud-workspace-status,welcome-den-session}`,
  and `apps/chat-server/src/enterprise-den-origin.ts`.
- **`domains/cloud/brand-theme.tsx` deleted.** A per-organization accent that
  overwrote `--dls-accent` at runtime is a second design authority, which named
  choice 5 and the anti-scope line both forbid. It also wrote `--dls-accent-rgb`,
  a token OW3 removed in favor of `color-mix`.
- `welcome-route.tsx`'s orphaned `joinOrganizationOpen`, and the
  `onJoinOrganization` prop it fed, are gone with the join affordance.
- Entry decision: **a route on the console origin**, recorded as amendment A9.
- Bundle scan: `VITE_DEN_REQUIRE_SIGNIN`, `DEN_ENABLED`, and
  `HOSTED_DEFAULT_DEN_BASE_URL` are absent from the built bundle.

## Head binding (OW2)

- `apps/chat-server/src/theorem-mcp.ts` — the head's graph door, merged over the
  runtime MCP map so an operator cannot silently disconnect it from the settings
  UI. Absent when `THEOREM_MCP_URL` is unset; no default endpoint, for the same
  reason OW1 removed the hosted model catalog. See amendment A11.
- `openwork-runtime-config.ts` — the agent prompt's "Memory Bank" block named
  Den's meta-MCP and its `search_capabilities`/`postMemory` tools as memory
  truth. Severing a transport does not sever the instructions describing it.
  Replaced with graph doctrine against the `theorem` MCP. See amendment A10.
- `package.json` — the `build` script still listed the
  `openwork-capabilities-knowledge` plugin OW1 deleted.
- OW2's live proof is partial and the gap is named in amendment A12.

## Secret-scanner findings in vendored tests, verified false

GitGuardian flags three values in vendored `apps/chat-server` test files. All
three are canaries whose purpose is to prove the diagnostic sanitizer redacts
them, so the scanner is flagging the test data of a secret-redaction test
suite. Recorded here because they will re-trip on every upstream cherry-pick
that touches these files, and nobody should have to re-derive this.

The values are described rather than quoted. An earlier revision of this table
pasted them verbatim, and the scanner promptly flagged this file too: a finding
count went from three to four because the documentation reproduced the thing it
was documenting. Read the cited line if you need the literal.

| File | Why it is not a secret |
|---|---|
| `agent-context-cloud-probe.test.ts:233` | An `ow_mcp_at_` prefix followed by base64 that decodes to a sentence saying this canary must never be returned. Injected as a provider-controlled tool ID at :254 and asserted absent at :269. |
| `agent-context-diagnostics.schema.test.ts:44` | One row of a table of redaction-evasion vectors: multiply percent-encoded `Bearer`, fullwidth characters, zero-width spaces. The row's own trailing word is `canary`. |
| `cloud-mcp-health.test.ts:207` | A JWT whose header is `{"alg":"none"}` and whose signature segment is an English word followed by digits. Unsigned by construction, so no signing key exists, and the payload is the `sub: 1234567890` from the JWT specification's own example. Asserted absent at :215. |

Nothing to revoke or rotate. None can be removed or altered: each is the input
to a `not.toContain(...)` assertion, so changing it would delete the security
property the test exists to hold.

The check is the GitGuardian GitHub App, not a `ggshield` CI step, so it reads
no configuration from this repository. A `.gitguardian.yaml` here would be
inert. Remediation is marking the three incidents false-positive in the
GitGuardian workspace, which needs dashboard access.

## Pending, with owning deliverable

- `cdn.simpleicons.org` is fetched for provider favicons: a genuine third-party
  request the app makes on its own behalf, unlike the user-configured connector
  hosts (Google Workspace, OpenAI, GitHub Copilot, and the `mcp.*` quick-connect
  catalog), which are only contacted when an operator configures them.
  **Disposition decided 2026-08-02: replaced by Noun Project icons**, which
  lands the icon set locally and removes the CDN call as a side effect. Until
  that lands, the full-session network-trace criterion is claimed with this one
  qualification. Call site: `src/react-app/design-system/provider-logo-src.ts`.
  **OW1 residual, closed by the Noun Project icon swap.**
- The Den **client library** (`app/lib/den.ts`, `den-handoff.ts`,
  `domains/cloud/den-auth-provider.tsx`) survives. It is not inert: the
  provider-auth and MCP-connection paths still read its types and helpers, so
  its symbols and its `openwork.orgOnboardingSeen` storage keys remain in the
  bundle. The Den **view** layer is gone; the library is a larger unwind that
  belongs with whatever replaces provider auth, not with OW4.
- `readDenBootstrapConfig().requireSignin` survives as a data-shape field with
  no gate reading it, `DenSigninGate` having been its only consumer.

## Retirements from the console (OW7)

None yet. The assistant-ui chat components under `apps/console/src/components/chat`
and `apps/console/src/views/ThreadView.tsx` are retired only when their
replacements land; the deletion list is recorded here on that day.
