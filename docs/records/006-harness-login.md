# Harness login

Date: 2026-07-17

## Product contract

Harness users get one normal account flow:

1. Open **Account** in CommonPlace.
2. Choose **Sign in with GitHub**.
3. Connect Claude.ai or another agent and approve the same GitHub identity.
4. Theorem creates or reuses the tenant bound to the stable GitHub account id.

Users do not choose tenant slugs, paste bearer tokens, configure OAuth, or see
operator callback settings. The old bearer-token path remains available only
as an advanced compatibility path during rollout.

## Authorization boundary

Any GitHub user may authenticate. Authentication does not grant owner access.
CommonPlace sets `isOwner` only when the verified GitHub login is
`Travis-Gilbert`; all other users receive an ordinary workspace session.

The initial GitHub login supplies the readable tenant name. Theorem persists a
mapping keyed by GitHub's stable numeric account id, so renaming the account
does not move or duplicate its workspace. No missing identity falls back to
`default` or `Travis-Gilbert`.

## Operator-only setup

CommonPlace uses Auth.js with `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and
`AUTH_SECRET`; Railway deployments trust the forwarded public host so Auth.js
does not emit the internal bind address in callback URLs. Theorem's hosted MCP
authorization server uses its own GitHub
OAuth app credentials because it has a distinct callback URL. These values
belong in deployment secret storage and are not user-facing configuration.
