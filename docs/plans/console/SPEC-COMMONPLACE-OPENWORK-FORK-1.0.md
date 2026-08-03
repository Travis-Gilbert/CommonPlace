# SPEC-COMMONPLACE-OPENWORK-FORK-1.0

<!-- Plan anchor. The plan is the executable truth; this markdown is the
     human-readable view and is re-rendered from the plan, not hand-edited. -->

> **Plan** `plan:c8307a874c5981f5` · **Goal** `goal:472bf86f7e27f275`
> **Upstream pin** `different-ai/openwork` @ `2f2dde65796428109a665f3b733843fe3896b933` (branch `dev`)
> **Verify First findings** [`openwork-fork/01-VERIFY-FIRST.md`](openwork-fork/01-VERIFY-FIRST.md) ·
> **Fact sheet** [`openwork-fork/00-FACT-SHEET.md`](openwork-fork/00-FACT-SHEET.md) ·
> **OW6 seam audit** [`openwork-fork/02-SEAM-AUDIT.md`](openwork-fork/02-SEAM-AUDIT.md)
> **Conformance gate** `scripts/audit-openwork-fork.sh`



2026-08-02. `Travis-Gilbert/CommonPlace`, `Travis-Gilbert/Theorem`. Architecture decision plus execution handoff. Deliverables OW1 through OW7.

The verdict on different-ai/openwork: hard fork, adopted as the chat register, replacing the current assistant-ui chat view. Stage one runs opencode as a Theorem head with no engine surgery; stage two, Theorem-native sessions through the SDK seam, is gated on a seam audit, not assumed. The register-per-donor map extends: Twenty for records primitives, OWOX for the model canvas, code-server for the IDE layer, openwork for the chat register.

`CONVENTIONS.md` applies.

## Frame

What openwork actually is, verified today. The open-source alternative to Claude Cowork, powered by opencode, from Different AI. Created January 2026, 20,122 stars, pushed within the hour, default branch `dev`. Licensing is a Cal.com-style split declared in the root LICENSE: everything under `/ee` is Fair Source, everything else is MIT, third-party components keep their own licenses. `apps/app` and `apps/server` are confirmed outside `/ee`, and `apps/server/package.json` declares MIT directly.

The decisive fact: the chat surface is not Electron-locked. `apps/app` carries an explicit web deployment, `build:web` with `VITE_OPENWORK_DEPLOYMENT=web`, browser-entry tests, and remote-workspace diagnostics. The Electron app in `apps/desktop` is a wrapper around the same renderer. The shipped remote shape is browser app to `openwork-server` to opencode, where `openwork-server` is a filesystem-backed Bun API for remote clients, compiled to single binaries for six targets, persisting through better-sqlite3 and Drizzle, and shipping five opencode plugins including anthropic-adaptive-thinking and anthropic-tool-schema.

The stack convergence, enumerated from `apps/app/package.json`. React 19, Tailwind 4 with shadcn, cmdk, CodeMirror 6, xterm, react-resizable-panels, zustand, TanStack Query and Virtual, motion, Lexical composition, a marked plus shiki plus katex rendering pipeline, sonner, `@base-ui/react` which twenty-ui also builds on, and `@paper-design/shaders-react`, the same shader library the console already mounts. The fork inherits a stack that is already CommonPlace's stack, down to the shaders.

What it expresses, read from its own test surface: multi-session chat with session switching and scoping, permission approvals, todos, an event stream, artifacts including spreadsheet artifacts, terminals, a file engine, open-target navigation, error recovery, and voice. This is the agentic register the console lacks and the reason the current chat view feels thin.

The engine seam. The renderer speaks `@opencode-ai/sdk` with AI SDK v6 streaming primitives. Doctrine holds without surgery: opencode joins as a head, the Theorem MCP attaches through opencode's MCP config, and the head offloads to the graph like every other head, so a working chat register exists before any seam is touched. Whether stage two replaces the SDK seam with a Theorem-native session door is a decision the OW6 audit earns the right to make.

The infrastructure symmetry worth naming. `openwork-server` per workspace is the same shape as the code-server workspace service in the IDE-layer plan: one per-workspace container over one repo checkout can carry both doors, the chat register and the IDE register, against the same filesystem. One workspace service, two surfaces, zero sync.

The design-system boundary. Two component systems now exist by register: twenty-ui serves records, the model canvas, and console chrome; openwork's Tailwind system serves the chat register. Both are generators fed by the one token truth. Choice 8 of the twenty-ui spec extends here unchanged: no design decisions inside either fork, token gaps route to the token specification by name. The router dependency gets the opposite disposition from twenty-ui, and both are recorded: react-router-dom leaves twenty-ui because those components mount inside Next; it stays in the chat fork because the chat register remains its own Vite app.

## Named choices

1. **Hard fork, vendored into the CommonPlace workspace.** `apps/app` lands as the chat surface, `apps/server` as the workspace chat daemon, with `packages/ui`, `packages/types`, `packages/paths`, and whatever `install-config` pieces the build genuinely requires. `/ee` never crosses. LICENSE and notices preserved, NOTICE and MODIFICATIONS.md created, UPSTREAM.md pins repo, branch, and SHA. Upstream remote retained; this upstream moves fast, so the cherry-pick posture matters more than it did for OWOX.
2. **Stage one engine is opencode as a Theorem head.** Theorem MCP in the opencode config, graph offload per doctrine, no SDK surgery before OW6 reports.
3. **The chat register stays a Vite app under the console domain.** Served as a route or zone beside the Next console; a port into App Router is declined and recorded so it never reopens unlabeled.
4. **Den is severed day one.** Every `api.openworklabs.com` endpoint, the sign-in requirement flags baked into `build:web`, marketplaces, telemetry, and the updater all go; console session auth replaces them.
5. **One token truth, two generators.** The fork's Tailwind theme is generated from the same OKLCH token source that feeds the twenty-ui generator; Geist and IBM Plex are replaced by whatever the tokens declare; shader mounts reconcile to the console's one-ShaderMount law.
6. **One workspace container, two doors.** The workspace service image carries openwork-server and code-server over a single checkout; the chat register and the IDE register see the same filesystem by construction.
7. **The Fair Source bright line is mechanical.** No import resolves into `/ee` or `enterprise-mcp-*`; a path audit is part of acceptance.
8. **The current chat view retires.** assistant-ui's chat components are superseded in this register; deletions are recorded in MODIFICATIONS.md the day their replacements land.

## Deliverables

### OW1. Vendor and sever

Chat surface and daemon in the CommonPlace workspace

The fork lands building: web build boots in a browser inside the console shell, license notices intact, `/ee` and enterprise packages absent, Den endpoints, telemetry, updater, and marketplace calls removed.

Accepted when the package builds in the pnpm workspace, a network trace of a full session shows zero calls to openworklabs.com or any third party, the MIT notices survive, and UPSTREAM.md names the exact commit.

### OW2. Head binding

opencode plus Theorem MCP

The forked stack runs sessions against opencode configured with the Theorem MCP: the head reads and writes the graph, permissions surface in the approval UI, todos and events stream.

Accepted when a session performs a task whose context demonstrably lands in the graph, receipts retrievable through the harness, and a permission prompt round-trips through the fork's approval surface.

### OW3. Token and shader binding

The fork's Tailwind 4 theme is emitted from the console token source: OKLCH families, materials, radius law, fonts per tokens. Shader usage reconciles to one ShaderMount per window under the console's rules.

Accepted when rendered chat surfaces resolve computed colors to console token values, no font ships that the tokens do not declare, and the shader mount count per window is one.

### OW4. Auth and serving

Console domain, console session

Den sign-in is gone; the chat register authenticates through the console session and serves under the console domain as a route or zone, with the entry decision recorded.

Accepted when an authenticated console user reaches the chat register with no second sign-in, and the DEN flags are dead code eliminated from the build.

### OW5. The workspace container

One image, two doors

A single per-workspace container image runs openwork-server and code-server over one checkout, deployed as the workspace service on Railway with workspace-scoped tokens.

Accepted when an edit made through the IDE register is visible in the chat register's file engine without any sync step, and both doors authenticate against the same workspace token.

### OW6. The seam audit

`@opencode-ai/sdk` usage report

Every SDK call site in the vendored app and server is enumerated, with the session, event, artifact, and permission models mapped against Theorem's session door and ACP, producing a written stage-two decision: replace the seam, or stay on the opencode head, with reasons.

Accepted when the report lands in `docs/plans` with enumerated call sites and a named decision, recorded as an amendment on this spec.

### OW7. Retirement

The current chat view

The assistant-ui chat view is replaced by the fork across the console's seeded views; retired components are deleted and the deletion list recorded.

Accepted when no console import resolves to a retired chat component and the seeded chat view opens the fork.

## Verify First

- `packages/openwork-ui-mcp`: what it actually is, and whether an agent-drives-the-UI door is worth adopting rather than stripping.
- `packages/handsfree`: the voice surface's dependencies and whether it survives the Den severing.
- An import audit from `apps/app` and `packages/ui` into `/ee` paths, since flag-gated enterprise imports are the classic leak in Cal.com-style splits.
- The web-versus-Electron capability matrix, read from the browser-entry, fs-engine, local-file-path, and remote-workspace-diagnostics tests: exactly which capabilities require openwork-server and which required Electron, so OW1's acceptance knows what a browser session can honestly do.
- The five bundled opencode plugins' behavior against Theorem-headed sessions, anthropic-adaptive-thinking and anthropic-tool-schema especially.
- The server's Drizzle schema for sessions and artifacts, and where artifact truth should eventually live given the object seam; recorded now, decided in OW6's frame.
- Which components stream through `@ai-sdk/react` versus opencode SDK events, since the two seams may not cut in the same place.
- Upstream's `dev` branch cadence and PR openness, to price the cherry-pick posture honestly.

## Anti-scope

- No `/ee` code, no Den services, no marketplaces, no telemetry, verified by path and network audit.
- No engine surgery before OW6's report exists; the opencode head is the engine until the audit says otherwise.
- No port of the chat app into Next App Router.
- No second design authority: token gaps route to the token specification, never into fork components.
- No adoption of `apps/desktop` now; the Electron wrapper is parked as a recorded later option for a CommonPlace desktop app, not deleted from consideration.
- No new artifact blob store treated as semantic truth; artifacts persist where they land today until OW6 frames the graph door.

## Amendment log

Amendments carry findings that contradict or refine the spec above. Each names
its evidence. Source: `openwork-fork/00-FACT-SHEET.md` and
`openwork-fork/01-VERIFY-FIRST.md`, both read against upstream
`2f2dde65796428109a665f3b733843fe3896b933` on 2026-08-02.

### A1. The Fair Source license, named precisely

The Frame calls `/ee` "Fair Source". `ee/LICENSE` is the **Functional Source
License 1.1 with an MIT future grant (FSL-1.1-MIT)**. FSL is a Fair-Source
category license, so the bright line and named choice 7 are unchanged; only the
name in the Frame was imprecise.

Related: `apps/app/package.json` declares **no `license` field**. It was MIT only
by the root LICENSE's residual clause. The vendored `apps/chat` now declares MIT
explicitly.

### A2. Six opencode plugin factories, not five, and one is a delete

`apps/server/src/opencode-plugins` holds six plugin factories plus two
non-factory modules, not five plugins.

`openwork-capabilities-knowledge` is a **delete, not a retune**. It injected a
static knowledge block naming Den's capability endpoint, auth issuer, OAuth
discovery, and token lifetimes as truth. Under a Theorem head that is actively
wrong context, not merely dead weight. Deleted in OW1.

`openwork-anthropic-adaptive-thinking` and `openwork-anthropic-tool-schema` were
read from source and operate on the Anthropic provider request shape rather than
on tool identity, so neither should filter Theorem MCP tools. **This is a
source-read conclusion, not a runtime observation.** OW2 owns the live proof,
particularly for `tool-schema`, whose job is rewriting tool schemas.

### A3. There is no sessions or artifacts schema

The Verify First item assumed a Drizzle schema for sessions, messages,
artifacts, and permissions. **Those tables do not exist.** The only `sqliteTable`
calls in the daemon are two variants of one generic workspace key-value shape
(`workspace_id`, a JSON blob, `updated_at`), used for config stores and session
grouping.

Artifact truth today lives in **opencode's own filesystem session storage**,
reached through the SDK. The daemon is a filesystem-backed proxy with a config KV
store beside it, not a system of record. This satisfies the anti-scope line "no
new artifact blob store treated as semantic truth" by inheritance: there is no
competing store to dislodge.

### A4. One transport seam, not two

The Verify First item anticipated a split between `@ai-sdk/react` streaming and
opencode SDK events. Measured: `@ai-sdk/react` is declared in `package.json` and
imported by **zero files**; `ai` (v6) is imported by about twenty files and every
import is `import type`, plus two pure predicates.

AI SDK v6 is the transcript **type vocabulary**; opencode SDK is the entire
**transport**. `usechat-adapter.ts` is the boundary and imports from both. This
narrows OW6's question and is a direct input to its decision.

### A5. OW6 stage-two decision — stay on the opencode head

Recorded per OW6's acceptance criterion. Full reasoning and reversal conditions
in `openwork-fork/02-SEAM-AUDIT.md`.

The seam is **two client-construction sites**, not 46 call sites; the other 44
files carry types propagated by structural typing. The transcript already lands
in a neutral published type before rendering. The tool model already carries
Theorem through MCP. The one genuine divergence — artifacts having no identity
independent of their message — is not fixed by replacing the transport, so
replacing it first would rebuild the same gap in new code.

Stage-two scope is therefore the **artifact door**, not a transport replacement.

### A6. Cherry-pick posture, priced

Upstream `dev` runs about **ten commits per day** with **287 open pull requests**
(GitHub API, 2026-08-02). Continuous tracking is not viable. Named choice 1 is
read as a pinned snapshot with deliberate, selective cherry-picks; every
cherry-pick re-runs `scripts/audit-openwork-fork.sh`.

### A7. `install-config` does not cross

Named choice 1 allowed "whatever `install-config` pieces the build genuinely
requires". Measured: its sole consumer was the Den join-organization dialog.
With Den severed the answer is **none**, and the dependency was dropped.

### A8. Web-versus-Electron, settled

`platform-capabilities.ts` gates seven capabilities on `isElectronRuntime()`.
Dropped in web: native file picker, reveal-in-file-manager, OS notifications,
local runtime control, desktop bootstrap. Removed entirely: auto-update.
**Reclaimed by openwork-server:** the terminal — which is what makes OW5's
one-container-two-doors shape worth building.

Everything the agentic register needs — multi-session chat, permissions, todos,
events, artifacts including spreadsheets, the file engine, open-target
navigation, error recovery — is not Electron-gated and survives a browser
session unchanged. Voice is the exception: it is driven through the Chrome
DevTools Protocol against the desktop shell, and `packages/handsfree` is a
macOS-only Swift Accessibility runtime, declined.

### A9. The route-versus-zone decision: a route on the console origin

OW4 requires the entry decision be recorded. It is a **route on the console
origin**, reverse-proxied to the workspace service. Not a Next.js zone, and not
a subdomain.

The reason is the session, not the routing. The console authenticates with an
HttpOnly `cp_active_workspace` cookie. A cookie the browser will send to the
chat register without a second sign-in is a cookie on the same origin: a
subdomain would need the cookie widened to a parent domain, which hands every
future subdomain the console's session, and a zone is a build-time composition
that does not change the origin question at all. A route keeps the cookie
scoped exactly as narrow as it is today.

The anti-scope line holds: this is a proxy in front of a Vite app, not a port
into App Router. The chat register is still built by Vite and still served as
its own bundle; the console's origin is the only thing shared. The audit's
"chat register is still a Vite app" check stays mechanical.

Consequence recorded honestly: the workspace service is reachable only through
the console for browser sessions. Direct access still works with a workspace
token, which is what the standalone and development cases use, and which is why
`/session/console` answers `configured: false` rather than 401 when no console
secret is present.

### A10. The head's memory instructions were Den's, and are corrected

OW1 severed every Den endpoint but left the opencode agent prompt instructing
the head to reach Den's meta-MCP for memory, naming `search_capabilities`,
`execute_capability`, and `postMemory` as the way to remember and recall. A
head told to open a door that no longer exists reports the failure as its own
confusion rather than as a missing dependency, and no bundle or path audit
would ever catch it, because a prompt is a string.

The block is replaced by graph doctrine against the `theorem` MCP: recall
before assuming, offload exact structural questions rather than computing them
by inspection, encode outcomes rather than transcripts, and discover the tools
the MCP actually exposes rather than guessing names. `theorem-mcp.test.ts`
asserts the Den tool names are absent from the shipped prompt.

This is a correction to the Frame's implicit claim that OW1's severing was
complete at the transport layer. Severing a transport does not sever the
instructions that describe it.

### A11. The Theorem MCP is server-managed, and has no default endpoint

OW2's entry is merged over the runtime MCP map rather than written into it. The
runtime map is what the settings UI edits; an operator disabling an entry named
"theorem" there would otherwise disconnect the head from the graph silently,
with the session showing only that recall stopped working.

It resolves from `THEOREM_MCP_URL` and is **absent when unset**. No default
endpoint, by the same reasoning that removed the hosted model catalog in OW1: a
third-party host contacted because a constant said so, rather than because an
operator asked, is the pattern the severing existed to end. A malformed URL
yields absence rather than a throw, so a bad value cannot take the whole engine
config down with it.

### A12. OW2's live proof is partial, and the gap is named

The engine binding is proven as far as this environment allows and no further.

**Proven at runtime.** opencode 1.17.11 was installed, started against the
config this fork generates (`OPENCODE_CONFIG`), and accepted it: the server
comes up clean with the Theorem MCP entry present in the emitted config.

**Not proven at runtime.** The MCP connection handshake, tool registration, the
permission round-trip through the fork's approval surface, and todos and events
rendering from live session events.

**The cause is upstream and is not ours.** Every app-scoped route on this build
(`GET /config`, `GET /mcp`, `POST /mcp/{name}/connect`) deadlocks: it never
answers, verified against a 150-second timeout rather than inferred from a
short one. Ruled out, each by direct experiment:

- **Our config.** Stock opencode started with no `OPENCODE_CONFIG` at all
  deadlocks identically. This is the decisive control: the binding is not
  implicated.
- **The model catalog.** OW1 removed the hosted catalog default, so the engine
  falls back to models.dev. Mirroring that catalog locally and pointing
  `OPENCODE_MODELS_URL` at the mirror changed nothing.
- **A missing repository.** A real `git init` workspace with a commit behaves
  the same as an empty directory.
- **Disk pressure.** The first runs happened with 116 MiB free on the data
  volume, which was a genuine confound; re-run with 7 GiB free, identical.
- **A missing model credential.** Not reachable as a cause: the deadlock
  happens on `GET /config`, before any provider is selected or contacted.

That last point corrects the earlier framing of this gap. The blocker was never
a credential, and adding one would not have moved it. A model provider is
needed for the *task* half of criterion 1 (context landing in the graph), but
nothing in OW2 is gated on it until the engine answers at all.

The three OW2 acceptance criteria therefore remain open, and the next attempt
should start from a different opencode build or host rather than repeating the
five experiments above. What is closed is the configuration contract, which is
what the deliverable's "no SDK surgery" clause actually scopes, plus the prompt
correction in A10.

### A13. Theorem ACP is not the answer to OW2, and the reason is on the record

`@commonplace/theorem-acp` is real and already carries what a second agent path
would need: local and hosted ACP clients, a session manager, an agent state
reducer, identity policy, and plan state. The console consumes it today.

It is nonetheless the wrong instrument here, for two independent reasons.

**It would change the deliverable rather than verify it.** OW2's text is
"sessions run against opencode configured with the Theorem MCP." A session
driven over ACP does not exercise the opencode head, the engine config, or the
MCP entry this deliverable adds. Passing that way would prove something real
but not this.

**The engine decision is already made and still holds.** The anti-scope line is
"no engine surgery before OW6's report exists," and OW6 reported: stay on the
opencode head (A5). Its reversal condition is specifically that OW2's live
proof *contradicts the permission assumption*. What A12 records is not a
contradiction: it is a deadlock with a ruled-out cause list that never reached
the permission model. The condition has not fired, so the decision stands on
evidence rather than on inertia.

Where ACP is the right tool is elsewhere and worth naming so it is not lost:
it is the console's existing agent path, which makes it relevant to OW7, and it
is the obvious stage-two candidate if the A5 reversal condition ever does fire.

Related, and settled cheaply: DeepSeek needs no work to become the head's
provider. The fork already carries it in its provider tables
(`apps/chat/src/app/utils/index.ts` lists `deepseek-r1`, `deepseek-v3`, and
`deepseek-chat`, with a provider label and logo mapping), and opencode takes
any provider through the `provider` block the runtime config already passes
through. It is a configuration line whenever a live session is wanted, not a
code change, and per A12 it was never what stood in the way.

### A14. OW4's scope gap is closed: the console signs what a member may do

OW4 shipped a console session that proved membership and nothing else. The
daemon could not tell a read-only member from an admin, so it pinned every
console actor to `collaborator`: a viewer could write, and an admin could not
reach the owner-only routes at all. This was recorded as blocked on console
work. Both halves are in this repository.

The console now derives a scope from the role permissions it already verifies
at mint time and signs that. The mapping lives on the console side on purpose:
`workspace.manage`, `members.manage`, and `keys.manage` are the console's names
for what the daemon gates behind owner, and a role added upstream would
otherwise arrive at the daemon as an unrecognized string whose treatment nobody
wrote down. The daemon reads its own three-value vocabulary and never learns
the console's.

A cookie minted before the field existed decodes as `collaborator`, which is
exactly what it meant before, so the change can only move on an explicit
signal. The pre-scope fixture in `console-session.test.ts` is kept deliberately:
it is the only artifact in either app that proves that. An unrecognized scope is
a rejection rather than a downgrade, because a console signing a vocabulary this
daemon does not know is a deployment mismatch and should not be hidden behind a
permissions bug report.

### A15. The workspace credential is scoped to the workspace

OW5 places a checkout and the head's graph credential on the same volume, and
that credential was `THEOREM_API_KEY`, scoped to the whole tenant. A container
that runs user code and publishes a terminal was holding a key to every
workspace in the tenant.

Recorded previously as blocked on Theorem issuing narrower keys. It was not:
the identity service already mints them at `/v1/workspaces/{id}/api-keys`,
which the console has proxied since the workspace settings page shipped. What
was missing was this daemon asking for the narrow one.

`THEOREM_WORKSPACE_API_KEY` is preferred, both variables may be set during a
migration, and a deployment still on the tenant key keeps its graph door and
gets a startup warning naming the variable to move to. Refusing the broad key
outright would trade a scoping problem for an outage on every unmigrated
deployment. Which variable a key arrived in is the signal, deliberately: a
key's scope is a property of the record that issued it, not of its text, so
sniffing a prefix would be a guess presented as a fact.

### A16. The multi-workspace runtime config is not engine surgery

`OPENCODE_CONFIG` is one file read by one engine process, so providers,
plugins, disabled providers, default agent, and external-directory permissions
reach only the booted workspace; settings writes for every other local
workspace succeed and then do nothing. This was deferred behind OW6 on the
reading that the remedies were engine surgery.

That reading was wrong. The engine already reads a project config layer per
directory: `mcp.ts` inspects `opencodeConfigPath(workspaceRoot)` as
`config.project` alongside the global layer, and the runtime map merges over
both. Materializing each workspace's runtime settings into its own project
config is configuration, not a second transport and not a second client
construction site, so it is inside A5's "stay on the opencode head" decision
rather than gated by it. The audit's OW6 check stays clean either way, because
that check looks for a new transport.

Not yet built. What exists today is the honest warning naming which workspaces
are configuration-inert, which is a smaller thing than the fix.

### A17. What the A9 route costs, measured

A9 recorded the entry decision as a route on the console origin,
reverse-proxied to the workspace service. Nothing implements it, and the reason
it is larger than "add a proxy" is worth recording rather than rediscovering.

The chat register is built with Vite `base: "/"` and served by the daemon's own
static handler, which SPA-falls-back from the root. Every asset it emits is an
absolute `/assets/...`, and every call it makes is an absolute `/session/...`
against its own origin. The register therefore assumes it owns the whole path
space of whatever origin serves it.

A proxy at `/workspace/<slug>/chat/` breaks both halves of that assumption. The
route is not sufficient on its own: the register has to be *built* knowing its
prefix (Vite `base`), and its client has to resolve its API base from that same
prefix rather than from `window.location.origin`, which is what
`gateway-runtime.ts` does today. That is three coordinated changes, not one, and
the anti-scope line still holds across all three: the register stays a Vite
bundle behind a proxy and is not ported into App Router.

OW7 depends on this, since a fork the console cannot reach is a fork the seeded
chat view cannot open.
