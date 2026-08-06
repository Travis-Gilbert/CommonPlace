# SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0

2026-08-05. `Travis-Gilbert/CommonPlace`, `Travis-Gilbert/Theorem`. Architecture decision plus
execution handoff. Deliverables WT1 through WT9.

The verdict: a workspace is an object resolved per session, never a service environment variable.
Users connect GitHub in one click through a vendor-owned GitHub App, pick a repo, and get a
checkout that the IDE door, the chat register, and any agent head share. Three layers with
separate owners: GitHub is the source of truth for code, the workspace volume is a disposable
re-mintable cache, and RustyRed holds what Theorem has learned. One law governs the whole spec:
**environment carries how to reach a service, never which tenant, repo, or user.** This is an
execution handoff; CONVENTIONS.md applies in full.

Companions. This supersedes the `WORKSPACE_REPO` / `WORKSPACE_REPO_URL` / `--default-folder`
contract that made the Studio deployment single-tenant by construction, and it dissolves CR-002 of
`plan-theorem-chat-register-20260805a` rather than satisfying it: the sticky empty
`/workspace/repo` is a boot-time singleton, and WT4 removes boot-time cloning entirely.
SPEC-WORKSPACE-SUBSTRATE-JETBRAINS-MINING-1.0 already owns the VFS, local history, workspace
model, and readiness organs; this spec provisions the tree those organs observe and adds the
tenancy keying they need. SPEC-THEOREM-CHAT-REGISTER-1.0's shared-checkout choice binds to WT4's
per-workspace path.

## Verify first

- Whether the Studio serve-web binary accepts a folder query parameter (code-server does; confirm
  for this build) or whether per-session folder selection requires a launch-per-session model.
  WT4's mechanism depends on the finding; record it before building.
- Per-session `--user-data-dir` and extensions-dir behavior in the Studio build, since a shared
  `User/settings.json` on one volume is one profile serving every user. The entrypoint settings
  bug fixed in #199 is evidence this is real, not theoretical.
- Current WorkOS integration surface: what identity claims reach the console session, and how a
  tenant is derived from them today.
- The full single-user inventory by search, not memory, before WT8 writes its gate: literals
  naming a tenant or repo, env vars naming one (`WORKSPACE_REPO`, `WORKSPACE_REPO_URL`,
  `CONSOLE_HARNESS_TENANT`, `CONSOLE_HARNESS_ROOM` all fail the law today), singleton paths,
  shared-profile paths, shared API keys where per-tenant credentials belong, `room:ungrouped`
  defaults, and any blob or index path without a tenant segment.
- Which graph keys already carry a tenant segment and which do not, per repository and per organ,
  since WT7's cascade cannot be honest about deleting what it cannot address.
- GitHub App permission minimum for the flows here: Contents for clone, Metadata, and whatever
  the picker's repository listing requires; grant nothing beyond what a deliverable uses.
- Railway's practical ceiling for per-workspace isolation, so WT9 records the orchestration
  decision with evidence rather than assumption.

## Named choices

1. **One vendor-owned GitHub App.** Created once by Anthropic-style vendor pattern: the user
   clicks Connect GitHub, GitHub presents install and authorize with all-repositories or
   selected-repositories choice, the user approves, the redirect returns them to CommonPlace. No
   user ever creates an app, pastes a token, or configures a webhook. This is the same shape
   Claude Code's install-github-app flow and Codex's repo picker present.
2. **Installation, not OAuth `repo` scope.** The `repo` scope is all-or-nothing across everything
   the user can reach, acts as the user, and dies with their seat; the installation is per-repo
   consent, acts as the product, survives membership changes, and carries its own rate limits.
3. **Three credential lanes that never mix.** Identity is WorkOS. Repo grants are the
   installation, kept current by installation webhooks against a mapping table. Local CLI use
   rides the developer's ambient git credentials with no connect flow at all, because the app
   lane exists to give hosted workspaces credentials they otherwise lack.
4. **Tokens are minted, never stored in the tree.** A git credential helper mints an installation
   token per request; no token is written into a remote URL or `.git/config`, because installation
   tokens expire in an hour and a persisted credential on a shared volume is a leak. Tokens are
   never logged, never returned to the browser, and never placed in an env var read by user code.
5. **The workspace is a graph object.** Id, tenant, repo full name, installation id, ref, path,
   state, provisioned lazily and addressable by id. Every path, key, and token derives from the
   object, so nothing about which repo is known at container boot.
6. **Tenant is part of every key.** Workspace nodes, VFS journal entries, blobs, index shards, and
   derived semantics all carry the tenant segment. `gate:multitenant` extends past environment
   variables into graph key shapes.
7. **Deletion is a first-class cascade with receipts.** Disconnecting the app or deleting a
   workspace removes derived nodes, blobs, and index shards provably, because keeping learned
   structure from someone's code is only defensible if its departure is equally demonstrable.
8. **Layers own different things.** GitHub owns code. The volume owns a disposable working tree.
   RustyRed owns observation and derivation: the workspace object, the VFS journal, local history
   revisions with blobs, code intelligence built lazily under the readiness registry, and the
   plans, runs, and receipts that reference files by path and hash. The graph is never a git
   remote and never stores the checkout.
9. **The federation line holds.** Code content and derived semantics never cross tenants; only
   content-free structural signatures are ever shareable, and only opt-in, per existing federation
   doctrine.

## Deliverables

### WT1. The app and the connect flow

Paths: the GitHub App registration, `apps/console` connect surface, `apps/commonplace-api`
callback and webhook endpoints.

The vendor app with minimum permissions per Verify first; a Connect GitHub action in the console;
callback handling that reconciles installations through the API rather than trusting the redirect,
because a second tenant installing on an already-installed org returns without an installation
code; an installation webhook consumer maintaining the mapping table as repos are added, removed,
suspended, or the app uninstalled.

Accepted when a fresh account connects in one click and lands back authenticated with its
installation recorded; a repo added later in GitHub appears without reconnecting; uninstalling in
GitHub marks the installation revoked in the mapping table within one webhook delivery.

### WT2. The repo picker

Path: `apps/console`.

Repositories listed from the connected installations, grouped by owner, with a pending state for
org installations awaiting admin approval that reads as pending rather than failure, and a path to
add another owner since installation tokens are scoped to a single owner.

Accepted when a user with repos across two owners sees both after two installations; a repo
requiring org approval renders the pending state with its request surfaced; selecting a repo
creates a workspace object and returns its id.

### WT3. Token minting and the credential helper

Paths: `apps/commonplace-api` token service, the workspace image's git credential helper.

JWT signed with the app key, exchanged for an installation access token scoped to the workspace's
installation; a credential helper in the image that calls the service per git request; no token
persisted anywhere in the tree.

Accepted when a clone and a fetch an hour apart both succeed without re-provisioning; a grep of
`.git/config` and the volume finds no token; the token service refuses a request whose workspace
does not belong to the caller's tenant, and the refusal is receipted.

### WT4. Per-workspace provisioning

Paths: `packaging/workspace/entrypoint.sh`, the provisioning API, the Studio launch path.

Boot-time cloning is removed. Provisioning clones into `/workspace/{workspace_id}` on demand, with
a per-workspace user-data-dir and extensions-dir, and the session opens that folder by the
mechanism the Verify first finding names. `WORKSPACE_REPO` and `WORKSPACE_REPO_URL` are deleted.

Accepted when two workspaces on different repos are open in one deployment without collision,
each with its own settings and MRU list; a container restart re-provisions from the workspace
object with no manual repair; the entrypoint contains no clone and no repo-naming env var; the
sticky-empty-repo failure cannot be reproduced.

### WT5. One tree, three doors

Paths: the workspace image, the chat register mount, the IDE mount, the agent session path.

The IDE door, the chat register, and agent sessions all resolve the same
`/workspace/{workspace_id}` tree for a given session.

Accepted when an edit made in the IDE door is visible in the chat register's file surface with no
sync step and an agent session's tool call reads the same bytes, all three verified live in one
session against a non-CommonPlace fixture repo.

### WT6. Tenant keying through the substrate

Paths: the VFS, history, workspace-model, and index organs per the mining spec.

Every derived node, journal entry, blob, and index shard carries its tenant segment; queries are
tenant-scoped by construction rather than by filter discipline.

Accepted when a fixture second tenant's workspace produces derived nodes that the first tenant's
queries cannot reach, demonstrated by an attempted cross-tenant read that refuses with a receipt;
`gate:multitenant` passes on graph key shapes.

### WT7. Disconnect and cascade

Paths: the deletion path across graph, blobs, index, and volume.

Workspace deletion and app disconnection remove derived nodes, blobs, index shards, and the
working tree, producing a receipt enumerating what was removed.

Accepted when deleting a fixture workspace leaves no derived node, blob, or index shard
addressable afterward, verified by query rather than assertion; the receipt enumerates the classes
removed; a subsequent reconnect starts clean.

### WT8. `gate:multitenant`

Path: `scripts/`, wired into CI beside the existing gates.

The gate fails on: literals naming a tenant, user, or repo outside packaging metadata and
fixtures; env vars naming a tenant, repo, user, or room; singleton workspace paths; shared-profile
paths; single shared API keys where per-tenant credentials belong; graph key shapes without a
tenant segment. The full inventory from Verify first is burned down, each entry fixed or recorded
with an owner.

Accepted when the gate is green on main and demonstrably red on a branch reintroducing
`WORKSPACE_REPO`, a hardcoded owner string, and an untenanted graph key; the inventory has no
unowned entries.

### WT9. The orchestration decision

Path: `docs/plans/workspace-tenancy/DECISION-ISOLATION.md`.

A written decision on per-workspace isolation with evidence: what Railway supports, what the
contract needs, and what the swap costs later. The near-term posture may be a single instance
serving multiple workspace objects, provided the contract, workspace id in every path, token per
session, folder per request, holds, so the later swap is a deployment change and not a redesign.

Accepted when the decision exists with its evidence and its named trigger for revisiting, and
nothing in WT1 through WT8 depends on which posture was chosen.

## Out of scope

Non-GitHub forges, which follow the same object contract in their own handoff; per-workspace
billing and quotas; the Symphony workspace door; a code mirror or git-remote role for the graph,
permanently excluded by named choice 8; org-level SSO beyond what WorkOS already provides; mobile
workspace management. Each is its own handoff; none gates anything above.

## Reporting

Per CONVENTIONS: scannable status per deliverable, acceptance verified or not and how, leading
with what is not done. Include the folder-selection finding, the app's granted permissions, the
single-user inventory as found with owners, the cross-tenant refusal receipt, the cascade receipt,
and the isolation decision with its trigger.
