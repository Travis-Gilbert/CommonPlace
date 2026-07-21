# Paper extract: Console sidebar

Source: Paper file Island Shells (`01KY0ZC4NKHV0KSBQDCFNWE5RJ`), artboards
Sidebar expanded and Sidebar collapsed. Companion to
`implementation-plan.md` and HANDOFF-CONSOLE-SIDEBAR.

## Fitted values (canonical; register owns them)

| Token / rule | Value |
|---|---|
| Expanded width | 264px (`--ij-sidebar-expanded-w`) |
| Collapsed rail | 44px (`--ij-sidebar-collapsed-w`) |
| Row height | 36px (`--ij-nav-row-h`) |
| Icon size | 16px (`--ij-stripe-icon`) |
| Row radius | 8px (`--ij-arc` via `--radius-ij-sidebar-row`) |
| Label | IBM Plex Sans 14 / 500; active 14 / 600 |
| Shortcuts / counts | JetBrains Mono 11, tabular-nums, muted |
| Active wash | `--ij-selection` (Paper stage showed `#2B2D30` on dark) |
| Hover | `--ij-hover-surface` wash, never shadow |
| Collapsed active | leading `--ij-accent` pip (`--ij-sidebar-pip-w: 2px`) + full ink glyph |
| Frame paint | transparent; no border; no shadow |

## Zones (top to bottom)

1. Surfaces radio: Chat, Workspace, Index, Documents, Cards
2. Divider (`--ij-seam`)
3. Companions toggles: Files, Context, Thread
4. Divider
5. Landmarks (content-shaped titles, kind glyph leading)
6. Footer: collapse control, profile initials, tenant (connection stays in StatusBar)

## Review checkpoints (Paper)

- Spacing: zone gaps and 36px rows read as one vertical rhythm.
- Typography: label vs shortcut hierarchy is clear.
- Contrast: ink on frame wash passes grayscale skim.
- Alignment: fixed 16px icon slots; shortcut column right-aligned when expanded.
- Artboard fit: height set to fit-content after staging.
- Glyph distinctness in code: IconChat, IconWorkspace, IconIndex, IconDoc,
  IconCards, IconFiles, IconMemory, IconThread (Paper stage reused some
  duplicated SVGs; implementation icons are the authority).

## Code mapping

- `apps/console/src/components/shell/Sidebar.tsx`
- Tokens in `register-bridge.css`; `--ij-stripe-w` tracks expanded/collapsed
- Extracted from Paper for structure; register remains canonical for color
