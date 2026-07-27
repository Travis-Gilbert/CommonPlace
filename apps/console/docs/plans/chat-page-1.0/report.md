# SPEC-COMMONPLACE-CHAT-PAGE-1.0 report

## Not done

- Live harness persistence gate not exercised end to end in this environment (send, hard reload, second browser). Server catalog is process-global and survives reload on the same instance; ACP session restore across process restart is not durable storage.
- Playwright 200-turn 60fps scroll not measured.
- Capability packs/skills list is empty until `/api/capabilities` advertises them (API today returns web_search only).
- Artifact inline records table does not yet mount the live `record.table` body inside the transcript; open-in-canvas promotes a bound block.
- Plan events still depend on tool_call projection from TheoremAgentState; delta SSE plan events are not the chat-page path (AssistantTransport snapshots are).

## Verify First

| Check | Result |
|---|---|
| A2A v1.0 surface | Not present in theorem-acp / console |
| Harness agent state snapshots | Yes via `createStateStream` → CH2 = AssistantTransport |
| AgentRailBlock parent assumption | None; mounts with BlockShell docked |
| Host empty-on-fail | Fixed in `queryAutomationHistory` + live wire |
| shadcn in console | No; chat composer uses register tokens + `cn` |
| Project concept | Declared in chat catalog API; threads bind to projects |

## Delivered

- CH1: `/chat`, `/chat/[threadId]`, `ChatPage`; chat removed from palette and `MATERIAL_BY_KIND`
- CH2: `runtime.ts` + `/api/chat/transport` (AssistantTransport)
- CH3: `ChatSidebar` with Home/Chat switcher, projects, threads, capabilities, project editor
- CH4: `Transcript` measure column, pin/unpin, return affordance, inline plan
- CH5: `Composer` with UUID ids, XHR upload progress, tray errors, register colors, paste cards without textarea duplication
- CH6: `ChatRail` mounts `AgentRailBlock`; flex ≥1100px, overlay below; collapse persisted per thread
- CH7: `ArtifactPart` with open-in-canvas
- CH8: page-level drop overlay
- CH9: host unreachable ObjectSet; catalog persistence APIs
