# Console block system: status report

Source: `HANDOFF-CONSOLE-BLOCK-SYSTEM.md` (2026-07-20). This handoff supersedes
earlier islands-material choices for gutter (now 6), frame inversion (frame
lighter than islands in dark), and the web Terminal dock (removed; terminal is
a declared block only).

## Not done (lead)

- **B10 bottom-band dock:** web shell has no `[data-bottom-dock]` (by design;
  Terminal dock removed). Island → chrome promotion docks into companion tool
  windows instead. A literal bottom band remains a desktop follow-up.
- **B10 e2e acceptance #7:** Playwright proof of island ↔ stripe round-trip
  with two `ObjectActionReceipt`s is not yet added.
- **Paper chrome / composer artboards:** IslandShell anatomy extracted; stripe,
  tool-window, and composer skins are not yet authored in Paper.

## Shipped

| Deliverable | State |
| --- | --- |
| B1 presentation grammar | Shipped |
| B2 register + gates | Shipped; `gates` green |
| B3 routes | Shipped |
| B4 Jotai | Shipped (zustand pin retained for peers) |
| B5 live sets | Shipped |
| B6 layouts as data | Shipped |
| B7 source installs | Shipped: jalco + tnks / linear-combobox / pdfx / command-menu; recursive-dnd vendor ref |
| B8 declared blocks | Shipped |
| B9 proving trio | Shipped: records ViewSource → tnks; automation-history → jalco CommitGraph + harness status projection; composer Cmd/Ctrl-L + single unavailable slot |
| B10 movement and promotion | Shipped (web): IslandGrid sortable rearrange + size snap → `emit`; promotion zones for stripe tray / chrome tools / expand-to-surface; Cards surface uses `kind: grid` |
| Paper MCP skin extract | Shipped for IslandShell anatomy: `paper-extract-island-shell.md` + JSX snapshot; register tokens match Paper; error-island radius corrected in Paper (33→10) |

## Topology note

B6b HTTP `/objects/*` lives on CommonPlace `apps/commonplace-api` (console
proxy). Theorem still has other object layers (`ColdObjectStore`,
commonplace-web atoms, `block_view`). See
`docs/learnings/2026-07-21-three-object-layers-not-http-only.md`.

## Supersession note

Prior Material Layer work used gutter 10 and a darker dark-mode frame. This
handoff replaced those constants. Grain reduction and Terminal dock removal from
the earlier polish pass remain in force.
