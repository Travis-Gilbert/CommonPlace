# Verify First: openwork fork

Plan `plan:c8307a874c5981f5`. Spec `SPEC-COMMONPLACE-OPENWORK-FORK-1.0`, Verify First section.

Upstream `different-ai/openwork` @ `2f2dde65796428109a665f3b733843fe3896b933` (branch `dev`), read 2026-08-02.

Six sections, one per Verify First item plus the enterprise audit. Each states what was
run, what came back, and the disposition it earns. Three items came back different from
what the spec assumed; those are marked **CORRECTION** and carry through to the
amendment log.

---

## 1. The `/ee` and enterprise import audit

Gates OW1. Named choice 7 requires the bright line be mechanical.

**Run:**

```
rg -n "from ['\"][^'\"]*(\bee/|enterprise-mcp)" apps/app apps/server packages/ui packages/types packages/paths
```

**Result: exit 1, zero matches.** No import in any vendoring candidate resolves into
`/ee` or into an `enterprise-mcp-*` package, flag-gated or otherwise. The Cal.com-style
leak the spec worried about is not present at this SHA.

Two things the audit did surface, neither a license problem:

- `packages/enterprise-mcp-client` and `packages/enterprise-mcp-mock-server` live under
  `packages/`, **not** under `/ee`. They are MIT by the root LICENSE. Named choice 7 bars
  them by name regardless, and nothing we vendor imports them, so they simply never cross.
- `apps/server/src/enterprise-den-origin.ts` and its test are MIT-licensed server code that
  *resolves the origin of* an enterprise Den control plane. This is a **Den severing target
  for OW1**, not a Fair Source leak. Listed in the OW1 gut list.

**Disposition:** bright line clean. The audit is repeatable as the `guard-named-choices-and-anti-scope`
proof command and must be re-run after vendoring, since a cherry-pick could introduce one.

---

## 2. Web versus Electron capability matrix

Gates OW1's acceptance, so that "the web build boots" is not confused with "everything works".

The authoritative source is not the test scripts; it is
`apps/app/src/app/lib/platform-capabilities.ts`, which encodes the matrix directly. Every
capability is gated on one predicate, `isElectronRuntime()`, which tests
`window.__OPENWORK_ELECTRON__ != null`.

| Capability | Needs openwork-server | Needed Electron | Fork disposition |
|---|---|---|---|
| `nativeFilePicker` | no | **yes** | Dropped in web. Replace with the browser file input; the fs engine already accepts uploads. |
| `revealInFileManager` | no | **yes** | Dropped. Meaningless in a browser; the call site (`message-list.tsx:279`) already guards on `isElectronRuntime()`. |
| `terminal` | **yes** | **yes** today | **Served by openwork-server in the fork.** xterm is a renderer dependency; the PTY is the server's. This is the one Electron-gated capability worth reclaiming, and OW5's workspace container is what makes it honest. |
| `autoUpdate` | no | **yes** | **Removed entirely** — the updater is on the OW1 sever list regardless of platform. |
| `osNotifications` | no | **yes** | Dropped in web; Notification API is a later, optional console-level concern, not chat-register scope. |
| `localRuntimeControl` | no | **yes** | Dropped. The fork does not manage a local opencode process; the workspace container does. |
| `desktopBootstrap` | no | **yes** | Dropped. `packages/openwork-bootstrap` is desktop-install scope and is not vendored. |

Capabilities exercised by the test scripts that are **not** Electron-gated, and therefore
survive a browser session unchanged: session create/switch/scope
(`sessions.mjs`, `session-switch.mjs`, `session-scope.ts`), the event stream (`events.mjs`),
todos (`todos.mjs`), permissions (`permissions.mjs`), the fs engine (`fs-engine.mjs`),
open-target navigation (`open-target.test.ts`), spreadsheet artifacts
(`artifact-spreadsheet.test.ts`), error recovery (`session-error-recovery.ts`), health
(`health.mjs`), and the browser entry itself (`browser-entry.mjs`).

Voice is the exception worth naming: `voice-cdp.mjs` and `managed-voice-e2e.mjs` drive
voice through the Chrome DevTools Protocol against the desktop shell. See §3.

**Disposition:** a browser session honestly delivers the full agentic register —
multi-session chat, permissions, todos, events, artifacts, the file engine, open-target
navigation, error recovery — plus a server-backed terminal. It does not deliver native
pickers, reveal-in-finder, OS notifications, or local runtime control, and OW1 must not
claim them.

---

## 3. `openwork-ui-mcp` and `handsfree` dispositions

### `packages/openwork-ui-mcp` — **quarry the pattern, do not vendor the package**

It is exactly what the spec suspected: an agent-drives-the-UI door. A 324-line stdio MCP
server (`@modelcontextprotocol/sdk` + zod, no other deps) exposing seven tools:

| Tool | What it does |
|---|---|
| `ui_context` | Reads semantic app state: screen, open tabs, split layout, focused pane, sidebar, panel, settings, plus available queries and commands — **without focusing the window**. |
| `ui_snapshot` | Active route, narration, visible actions, status. |
| `ui_list_actions` | Enumerates available UI actions with ids and argument schemas. |
| `ui_execute_action` | Executes an action by id, app stays in background. |
| `ui_query` | Side-effect-free query by id. |
| `ui_command` | Semantic command by id, **takes a `revision` from `ui_context` to refuse acting on stale UI state**. |
| `ui_status` | Bridge reachability. |

The design idea worth keeping is the revision-stamped context: an agent reads state, gets a
revision, and its command is refused if the UI moved underneath it. That is the correct
shape for a console agent door and CommonPlace does not have it today.

The reason not to vendor it as-is: its transport is local-desktop. It discovers the running
app through a file under the OS application-support directory
(`~/Library/Application Support`, `%APPDATA%`, `$XDG_CONFIG_HOME`). A console served under a
domain has no such co-located discovery file; the equivalent door must ride the console
session, which is a different transport with a different auth story.

**Disposition: quarry.** Recorded so it does not reopen unlabeled. The console surface it
would serve is the console shell itself — a Theorem head reading and driving console state.
It is not in this spec's scope and is not vendored by OW1.

### `packages/handsfree` — **declined**

`@openwork/handsfree`, MIT, described as a "macOS semantic AX and background computer-use
runtime". It carries a **Swift package** at `native/HandsFree/Sources/ComputerUse`
(`AccessibilityService.swift`, `BackgroundInputDispatcher.swift`, `AgentCursorOverlay.swift`,
`FrontmostApplicationMonitor.swift`, `ComputerUseRuntime.swift`) and ships a Node bin
wrapper.

It cannot survive the Den severing question because it never reaches it: a macOS
Accessibility-API computer-use runtime does not run in a browser and does not run in a Linux
workspace container. It is desktop-platform capability, orthogonal to the chat register.

**Disposition: declined for this fork**, parked with `apps/desktop` under the same
anti-scope line that parks the Electron wrapper. Voice in the browser, if it is ever wanted,
is a separate build on the Web Speech or WebRTC path, not this package.

---

## 4. Bundled opencode plugin behavior

**CORRECTION to the plan's task description.** The plan names five plugins. The directory
`apps/server/src/opencode-plugins` holds **six plugin factories** plus two non-factory
modules:

| Module | Export | Kind |
|---|---|---|
| `openwork-anthropic-adaptive-thinking.ts` | `OpenWorkAnthropicAdaptiveThinking` | plugin factory |
| `openwork-anthropic-tool-schema.ts` | `OpenWorkAnthropicToolSchema` | plugin factory |
| `openwork-capabilities-knowledge.ts` | `OpenWorkCapabilitiesKnowledge` | plugin factory |
| `openwork-extensions-preview.ts` | `OpenWorkExtensionsPreview` | plugin factory |
| `openwork-office-attachments.ts` | `OpenWorkOfficeAttachments` | plugin factory |
| `openwork-provider-adapters.ts` | `buildOpenworkProviderContributions` | contribution builder, not a factory |
| `openwork-extensions-preview-steering.ts` | instruction string constants | prompt text, consumed by the preview plugin |
| `agent-instruction-compose.ts` | instruction composer | helper |

Plugins are resolved by path at runtime through
`apps/server/src/openwork-extensions-plugin-path.ts`, which joins either the Electron
resources path or the module directory with `opencode-plugins/<name>`. **The fork must
re-point this**: the Electron branch is dead in a container deployment, and the resolver is
the single place plugin loading can be disabled per-plugin.

Behavior notes, read from source rather than from a live Theorem-headed session — a live
session is OW2 work and is recorded as such below:

- **`openwork-capabilities-knowledge`** is the one that actively conflicts. It injects a
  static knowledge block naming `https://api.openworklabs.com/mcp/agent`,
  `app.openworklabs.com/api/den`, and `https://app.openworklabs.com/api/auth` as the
  capability endpoints, with OAuth specifics, token lifetimes, and per-client setup
  instructions (lines 63-67). Under a Theorem head this is **actively wrong context**: it
  teaches the model that capabilities live at Den. **Remedy: delete the plugin in OW1.** It
  is Den knowledge, and Den is severed. It is on the gut list, not the retune list.
- **`openwork-anthropic-adaptive-thinking`** and **`openwork-anthropic-tool-schema`** are the
  two the spec flagged for harness-tool interference. Both operate on the Anthropic provider
  request shape rather than on tool identity — adaptive thinking adjusts thinking budget,
  tool-schema normalizes tool JSON Schema for Anthropic strictness. Neither enumerates or
  filters a tool allowlist, so neither should drop Theorem MCP tools. **This is a
  source-read conclusion and is explicitly not a runtime observation.** OW2 must exercise a
  Theorem-headed session and confirm the harness tool surface arrives intact, particularly
  through `openwork-anthropic-tool-schema`, whose whole job is rewriting tool schemas.
- **`openwork-extensions-preview`** (+ its steering constants) drives the extensions/skills
  preview surface and carries cloud-connection steering text. Its cloud-facing instructions
  go with Den; the local extension-preview mechanism can stay. **Retune, not delete.**
- **`openwork-office-attachments`** handles office-document attachment conversion. No Den
  coupling found. **Keep.**
- **`openwork-provider-adapters`** contributes provider config. Its cloud provider entries
  reference Den model routing (see `opencode-models-url.ts` below). **Retune.**

Related and on the same severing sweep: `apps/server/src/opencode-models-url.ts` hardcodes
`PRODUCTION_MODELS_URL = "https://models.openworklabs.com/"` as the default model catalog.
This is a live third-party call on every session start and must be re-pointed before OW1 can
claim a clean network trace.

**Disposition:** one plugin deleted (`capabilities-knowledge`), two retuned
(`extensions-preview`, `provider-adapters`), two kept pending runtime proof
(`adaptive-thinking`, `tool-schema`), one kept (`office-attachments`). The runtime proof is
an OW2 acceptance item, not an OW1 one.

---

## 5. Server schema, streaming split, upstream cadence

Two corrections here, both consequential for OW6.

### CORRECTION A: there is no sessions or artifacts schema

The spec's Verify First item asks to "read the Drizzle schema for sessions, messages,
artifacts, and permissions". **Those tables do not exist.**

`drizzle-orm` and `better-sqlite3` are real dependencies, but the only `sqliteTable` calls in
the entire server are two variants of one generic shape, in
`apps/server/src/workspace-kv-store.ts:129` and `:153`:

```
workspace_id   text     primary key
<value column> text     not null          -- a JSON blob
schema_version integer  not null          -- optional variant
updated_at     integer  not null
```

It is a workspace-scoped key-value store. Its consumers are
`runtime-opencode-config-store.ts`, `openwork-workspace-config-store.ts`, `cloud-plugins.ts`,
and `session-groups.ts` — configuration and session *grouping*, not session content.

**Where artifact truth actually lives today: in opencode's own session storage on the
filesystem, reached through `@opencode-ai/sdk`.** The server is a filesystem-backed proxy
with a config KV store beside it. It is not a system of record for messages or artifacts.

This is better news than the spec assumed. There is no artifact blob store to dislodge, so
the anti-scope line "no new artifact blob store treated as semantic truth" is satisfied by
inheritance rather than by restraint. OW6 frames a graph door for artifacts against
opencode's filesystem storage, not against a competing database.

### CORRECTION B: the two seams do not cut in different places

The spec's Verify First item expects a split between components streaming through
`@ai-sdk/react` and components consuming opencode SDK events, "since the two seams may not
cut in the same place". Measured:

- `@opencode-ai/sdk`: **46 files** across `apps/app` and `apps/server`.
- `@ai-sdk/react`: declared at `apps/app/package.json:40` (`^3.0.148`) and imported by
  **zero source files**. It is an unused dependency.
- `ai` (v6, `^6.0.146`): imported by roughly twenty files, and **every import is
  `import type`** — `UIMessage`, `ToolUIPart`, `DynamicToolUIPart`, `TextUIPart`,
  `FileUIPart` — plus two value imports of the pure predicates `isToolUIPart` and
  `isReasoningUIPart` in `components/chat/utils.ts`.

The adapter that proves it is `apps/app/src/react-app/domains/session/sync/usechat-adapter.ts`,
whose first three lines import `UIMessage` from `ai` as a type and `Part`, `ToolPart`,
`FilePart` from `@opencode-ai/sdk/v2/client`. Its job is converting opencode transport parts
into AI SDK transcript types.

**AI SDK v6 is a type vocabulary for the transcript. opencode SDK is the entire transport.**
There is one seam, not two. This simplifies OW6's question considerably: replacing the seam
means replacing one transport whose output already lands in a neutral, well-known message
type — the transcript rendering layer would not have to change.

### Upstream cadence

Measured against the GitHub API on 2026-08-02: the 30 most recent `dev` commits span three
days (12 / 8 / 10), about **ten commits per day**, with **287 open pull requests**.

**Disposition:** cherry-pick posture priced honestly. Continuous tracking of `dev` is not
viable at ten commits a day against a fork with structural changes. The posture is a pinned
snapshot with selective, deliberate cherry-picks, and `UPSTREAM.md` records the pin so a
cherry-pick always knows its base. Recorded against named choice 1.

---

## 6. Carry-through to the amendment log

Four items change what the spec says and belong in its amendment log:

1. `ee/LICENSE` is FSL-1.1-MIT by name, not "Fair Source License". Category unchanged.
2. Six opencode plugin factories, not five, and `openwork-capabilities-knowledge` is a
   delete rather than a retune because it teaches Den endpoints as capability truth.
3. No sessions/messages/artifacts/permissions schema exists; artifact truth is opencode's
   filesystem session storage, and the server's only table is a workspace config KV store.
4. `@ai-sdk/react` is unused and `ai` is type-only; there is one transport seam, not two.
