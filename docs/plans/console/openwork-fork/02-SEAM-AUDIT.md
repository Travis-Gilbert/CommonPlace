# OW6. The `@opencode-ai/sdk` seam audit and stage-two decision

Plan `plan:c8307a874c5981f5`, task `ow6-seam-audit`.
Spec `SPEC-COMMONPLACE-OPENWORK-FORK-1.0` OW6.

Measured against the vendored tree at `apps/chat` and `apps/chat-server`, which is
upstream `2f2dde65796428109a665f3b733843fe3896b933` plus the OW1 sever.

Proof command:

```
rg -n "@opencode-ai/sdk" apps packages
```

## 1. The seam is narrower than it looks

46 files reference the SDK. Every one of them imports from **a single entry
point**:

```
@opencode-ai/sdk/v2/client    39 import statements
```

There is no second module surface, no deep-imported internals, no v1 path. The
dependency is declared once in each app (`@opencode-ai/sdk ^1.17.11` in
`apps/chat-server/package.json`, and in `apps/chat/package.json`).

Of those 46 files, **only two construct a client**:

| File | Line | Role |
|---|---|---|
| `apps/chat-server/src/server.ts` | 1091 | The daemon's workspace client, built per workspace. |
| `apps/chat/src/react-app/kernel/server-provider.tsx` | 85 | The renderer's client, provided through React context. |

Everything else is one of two things: a `import type { createOpencodeClient }`
plus `ReturnType<typeof createOpencodeClient>` to name the client type, or a
consumer of the transport types (`Part`, `ToolPart`, `FilePart`, `McpStatus`,
`ToolIds`, `ToolList`).

**This is the single most important finding for the stage-two decision.** The
seam is not 46 call sites. It is two construction sites and one type alias
propagated by structural typing. `apps/chat/src/react-app/kernel/global-sdk-provider.tsx`
is the renderer's single choke point.

## 2. Call sites by model

### Session model

| File | What it does |
|---|---|
| `apps/chat-server/src/routes/sessions.ts` | HTTP routes proxying session create/list/read/abort to opencode. |
| `apps/chat-server/src/session-read-model.ts` | Projects opencode session state into the server's read model. |
| `apps/chat-server/src/routes/core.ts` | Workspace and health routes carrying the client type. |
| `apps/chat/src/app/lib/opencode-session.ts` | Renderer-side session helpers. |
| `apps/chat/src/app/lib/opencode.ts` | Client construction options, fetch impl, desktop-vs-web branch. |
| `apps/chat/src/react-app/shell/session-route.tsx`, `route-workspaces.ts`, `use-workspace-route-state.ts` | Route-level session binding. |
| `apps/chat/src/react-app/domains/session/sync/session-sync.ts` | The session synchroniser. |

### Event model

| File | What it does |
|---|---|
| `apps/chat/src/react-app/kernel/global-sync-provider.tsx` | Subscribes the global event stream. |
| `apps/chat/src/react-app/domains/session/sync/runtime-sync.tsx` | Per-session runtime event application. |
| `apps/chat/src/react-app/domains/session/sync/actions-store.ts` | Action/event reduction into a store. |
| `apps/chat/src/react-app/domains/session/surface/session-surface.tsx` | Renders from the synced state. |

### Artifact / part model

| File | What it does |
|---|---|
| `apps/chat/src/react-app/domains/session/sync/usechat-adapter.ts` | **The adapter.** Converts opencode `Part`/`ToolPart`/`FilePart` into AI SDK `UIMessage`. |
| `apps/chat/src/react-app/domains/session/sync/parse-tool-parts.ts` | Tool-part parsing, structured-output tool handling. |
| `apps/chat/src/react-app/domains/session/sync/attachment-file-part.ts`, `prompt-file-parts.ts` | File attachment parts in both directions. |
| `apps/chat/src/components/chat/message-list.tsx` | Transcript rendering. |

### Permission model

| File | What it does |
|---|---|
| `apps/chat/src/react-app/domains/session/modals/question-modal.tsx` | The approval surface. Permission prompts round-trip here. |

### Provider / MCP model

| File | What it does |
|---|---|
| `apps/chat-server/src/cloud-mcp-health.ts` | MCP status, tool ids, tool list. **Carries Den coupling; OW1 pending item.** |
| `apps/chat-server/src/routes/cloud-mcp.ts`, `connect-state.ts` | MCP reconcile routes and connect state. **Den-coupled.** |
| `apps/chat/src/react-app/domains/connections/provider-auth/*` | Provider auth store and config. |
| `apps/chat/src/react-app/infra/provider-list-query.ts`, `app/utils/providers.ts` | Provider enumeration. |

## 3. The AI SDK is not a second seam

The spec anticipated that components might split between `@ai-sdk/react`
streaming and opencode SDK events, and that "the two seams may not cut in the
same place". Measured, they do not cut in two places at all:

- `@ai-sdk/react` (`^3.0.148`, declared in `apps/chat/package.json`) has **zero
  import sites**. It is an unused dependency.
- `ai` (`^6.0.146`) is imported by about twenty files and **every import is
  `import type`**, except two pure predicates (`isToolUIPart`,
  `isReasoningUIPart`) in `components/chat/utils.ts`.

AI SDK v6 supplies the *transcript type vocabulary* — `UIMessage`, `ToolUIPart`,
`DynamicToolUIPart`, `TextUIPart`, `FileUIPart`. opencode SDK supplies the entire
*transport*. `usechat-adapter.ts` is the documented boundary between them, and it
imports from both in its first three lines.

## 4. Mapping against Theorem's session door and ACP

| Model | opencode SDK shape | Theorem equivalent | Fit |
|---|---|---|---|
| Session | Server-owned session id; create/list/read/abort over HTTP; state read back through a projection | Theorem session door; `harness_begin` / `harness_step` run lifecycle | **Close.** Both are server-owned, id-addressed, and step-structured. |
| Event | Server-sent stream applied to a client store | Harness SSE; run step events | **Close**, but Theorem's stream is run-scoped where opencode's is session-scoped and global-subscribed. |
| Artifact | Parts on messages; truth in opencode's filesystem session storage (see `01-VERIFY-FIRST.md` §5) | Object seam; graph nodes | **Divergent.** opencode has no artifact identity independent of the message that carried it. This is the real gap. |
| Permission | Prompt/response round trip surfaced in `question-modal.tsx` | ACP permission requests | **Close in shape.** Both are an interrupt awaiting an operator decision. |
| Tool | `ToolIds` / `ToolList` / `ToolPart`, MCP-server-scoped | Theorem MCP tools, harness tool registry | **Close.** This is exactly why stage one works: Theorem attaches as an MCP server and its tools appear as opencode tools. |

## 5. Decision

**Stay on the opencode head. Do not replace the SDK seam in stage two.**

Reasons, in order of weight:

1. **The seam is two construction sites, not forty-six.** The cost of replacing it
   later has been measured and is low. There is no accumulating interest that
   justifies paying now. A future replacement swaps `createOpencodeClient` behind
   `global-sdk-provider.tsx` and `server.ts:1091` and lets structural typing
   carry the rest.
2. **The transcript already lands in a neutral type.** Because `usechat-adapter.ts`
   converts opencode parts into AI SDK `UIMessage` before anything renders, the
   entire rendering layer is already independent of the transport. A replacement
   transport must produce `UIMessage`, which is a published type, not an
   opencode-private one.
3. **The tool model already carries Theorem.** Stage one attaches the Theorem MCP
   to opencode, and Theorem's tools arrive as ordinary tools. Replacing the seam
   buys nothing here, because the graph door is already open.
4. **The one genuine divergence — artifacts — is not fixed by replacing the
   seam.** opencode artifacts have no identity independent of their message, and
   a Theorem-native session door would not change that on its own. It needs an
   artifact-identity decision first. Replacing the transport before making that
   decision would rebuild the same gap in new code.

**What would reverse this decision**, recorded so the question can reopen on
evidence rather than on taste:

- Permission round-trip latency or fidelity through the opencode prompt model
  proving inadequate for ACP's richer permission semantics under OW2's live proof.
- An artifact-identity requirement landing that needs artifacts addressable in the
  graph at creation time, not reconciled after the fact.
- opencode SDK v2 client breaking in a way that makes the two construction sites
  expensive to maintain across cherry-picks.

**Stage-two scope, given the decision:** the next engine work is not a transport
replacement. It is the artifact door — deciding whether artifacts gain graph
identity at creation, and if so, where that write happens relative to opencode's
filesystem session storage.

## 6. Status of this audit

The call-site enumeration and the model mapping are complete and evidence-backed.
The decision above rests on structure, which is legitimate for a
replace-or-stay question.

One input is **not** yet runtime-verified: OW2's live Theorem-headed session,
which is the evidence for the permission round-trip claim in reason 4 and for the
reversal condition that depends on it. This audit's decision is stated as
*stay*, and staying is the low-risk branch — it is the branch that requires no
new code and is reversible. If OW2's live proof contradicts the permission
assumption, the reversal condition above is the trigger and this document takes
an amendment rather than a rewrite.
