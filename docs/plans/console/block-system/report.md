# Console block system: status report

Source: `HANDOFF-CONSOLE-BLOCK-SYSTEM.md` (2026-07-20). This handoff supersedes
earlier islands-material choices for gutter (now 6), frame inversion (frame
lighter than islands in dark), and the web Terminal dock (removed; terminal is
a declared block only).

## Not done (lead)

- **B6 layouts as data:** `LAYOUT_TYPES` shim still serves surface/region/view-instance
  from local host state + localStorage. commonplace-api (Theorem) does not yet
  persist those three types end to end in this session.
- **B7 source installs:** jal-co/ui, tnks-data-table, blocks.so, linear-combobox,
  pdfx, recursive-dnd-kanban vendor reference are not installed/reskinned yet.
- **B9 proving trio (full):** records table and chat composer already render;
  automation-history is a designed empty / list stub, not jal-co commit-graph.
- **B10 dnd-kit movement and promotion:** not wired (island lift, grid rearrange,
  stripe/dock promotion gestures).
- **Paper MCP skin extract:** not run in this session (register remains truth).

## Shipped

| Deliverable | State |
| --- | --- |
| B1 presentation grammar | Shipped: `MountPoint` / `BlockPresentation` / `blocksForMount`; package tests green |
| B2 register + gates | Shipped: gutter 6, frame inversion, island border transparent, inactiveAlpha 0.44, 1.20:1 island-to-frame in contrast gate + theme engine clamps; `gates` green |
| B3 routes | Shipped: `/chat`, `/workspace`, `/index`, `/documents`, `/cards`; root redirects to `/chat`; stripe navigates via router |
| B4 Jotai | Shipped: four stores under `lib/state/`; zustand removed from package.json |
| B5 live sets | Shipped: `changefeed.ts`; HttpBlockHost honors `live`; MemoryBlockHost `emitTestEvent`; console host points at `/api/proactivity/stream` |
| B8 declared blocks | Shipped: terminal, browser-pane, kanban, document, canvas with designed empty bodies; `blocksForMount("island")` includes them |

## Supersession note

Prior Material Layer work used gutter 10 and a darker dark-mode frame. This
handoff replaced those constants. Grain reduction and Terminal dock removal from
the earlier polish pass remain in force.
