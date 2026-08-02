# Upstream pin

| Field | Value |
|---|---|
| Repository | `https://github.com/different-ai/openwork` |
| Branch | `dev` |
| Commit | `2f2dde65796428109a665f3b733843fe3896b933` |
| Vendored | 2026-08-02 |
| License of vendored subset | MIT (see `LICENSE`) |

## What was vendored

| Upstream path | CommonPlace path | Package name |
|---|---|---|
| `apps/app` | `apps/chat` | `@commonplace/chat` |
| `apps/server` | `apps/chat-server` | `@commonplace/chat-server` |
| `packages/ui` | `packages/openwork-ui` | `@openwork/ui` |
| `packages/types` | `packages/openwork-types` | `@openwork/types` |
| `packages/paths` | `packages/openwork-paths` | `@openwork/paths` |

Leaf package names keep their upstream `@openwork/*` scope on purpose. The
directories are renamed for CommonPlace's donor-prefixed convention, but renaming
the package *names* would rewrite thousands of import specifiers for no benefit
and would make every future cherry-pick conflict. Directory and package name are
allowed to disagree; pnpm resolves by name.

## What was not vendored, and why

| Upstream path | Reason |
|---|---|
| `ee/**` | Fair Source (FSL-1.1-MIT). Named choice 7: never crosses. |
| `packages/enterprise-mcp-client`, `packages/enterprise-mcp-mock-server` | MIT, but barred by name under named choice 7. Nothing vendored imports them. |
| `apps/desktop` | Electron wrapper. Parked as a recorded later option, not adopted (anti-scope). |
| `apps/ui-demo` | Upstream component playground, not needed by the register. |
| `packages/handsfree` | macOS-only Swift Accessibility runtime. Declined — see `docs/plans/console/openwork-fork/01-VERIFY-FIRST.md` §3. |
| `packages/openwork-ui-mcp` | Quarried, not vendored: its discovery transport is local-desktop. Pattern recorded for a future console agent door. Same reference, §3. |
| `packages/install-config` | Its single consumer was the Den join-organization dialog. Den is severed, so the dependency is not required. |
| `packages/openwork-bootstrap`, `packages/connect-link`, `packages/email`, `packages/docs` | Desktop install, Den connect, Den email, and upstream docs site. All Den or desktop scope. |
| `packaging/`, `evals/`, `prds/`, `changelog/` | Upstream release, eval, and planning infrastructure. |

## Cherry-pick posture

Upstream `dev` runs about **ten commits per day** with **287 open pull requests**
(measured 2026-08-02). Continuous tracking is not viable against a fork with
structural changes. The posture is a pinned snapshot with deliberate,
selective cherry-picks.

Add the remote when it is missing:

```
git remote add openwork https://github.com/different-ai/openwork.git
```

Every cherry-pick must re-run the conformance audit in
`docs/plans/console/openwork-fork/03-CONFORMANCE.md`, because upstream code
legitimately contains Den endpoints, telemetry, and the hosted model catalog.
