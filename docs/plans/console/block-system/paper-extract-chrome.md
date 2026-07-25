# Paper skin extract: Stripe, Tool window, Composer

Extracted 2026-07-21 via Paper Desktop MCP. File: Island Shells.
Artboards: Stripe anatomy, Tool window anatomy, Composer anatomy.

Continues the IslandShell anatomy extract in the same file. Register remains
canonical truth; Paper is the design surface (HANDOFF choice 14).

Mood for this pass: vehicle dashboard (instrument black), matching the existing
IJ dark extract rather than inventing a parallel palette.

## Verdict

Chrome skins reuse IslandShell hex targets. No register token changes required.
Code already paints stripe / tool window / composer against these values via
Material Layer and `--ij-*` tokens.

## Shared palette (unchanged)

| Role | Paper | Register |
| --- | --- | --- |
| Frame ground | `#393B40` | `--ij-frame` |
| Tool / chrome body | `#2B2D30` | `--ij-chrome` |
| Editor body | `#1E1F22` | `--ij-editor` |
| Tool header | `#34363C` | `--ij-island-header-tool` |
| Seam | `#1E1F22` | `--ij-seam` |
| Ink | `#DFE1E5` | `--ij-ink` |
| Meta ink | `#868A91` | `--ij-ink-info` |
| Live | `#57965C` | `--ij-ok` |
| Island radius | `10px` | `--ij-island-radius` |

## Stripe anatomy

| Rule | Paper |
| --- | --- |
| Button size | `36×36` (`size-9`) |
| Selected fill | weak `#2B2D30` (not accent) |
| Rest fill | transparent |
| Selected glyph | full ink `#DFE1E5` |
| Rest glyph | meta ink `#868A91` |
| Companion divider | `24×1` seam |
| Rail width hint | `48px` column |

Maps to `IntuiShell` stripe buttons (`STRIPE_BUTTON_CLASS` + `stripeButtonStyle`).

## Tool window anatomy

Same IslandShell bands as the prior extract: 36px header, inset body, 24px
footer with live dot. Header shows Return to grid for stripe-tray demotion
(B10 round-trip). Wrapper is layout only; paint stays on the island.

Maps to `ToolWindow` + `ViewInstanceHost` (`forceShell`,
`returnToGridRegionId`).

## Composer anatomy

| Rule | Paper |
| --- | --- |
| Shell | chrome `#2B2D30`, seam border, 10px radius |
| Input well | editor `#1E1F22`, 8px radius, min-height 72 |
| Shortcut chips | header fill `#34363C`, mono 11 |
| Affordance | Cmd/Ctrl-L focus; single input slot |

Maps to composer `[data-composer-input]` + IntuiShell Cmd/Ctrl-L focus handler.

## Snapshots

JSX siblings (Tailwind export):

- `paper-extract-stripe.jsx.txt`
- `paper-extract-tool-window.jsx.txt`
- `paper-extract-composer.jsx.txt`

## Not claimed

- Literal `[data-bottom-dock]` band (desktop follow-up; web uses companion docks).
- Pixel-perfect icon set parity with every IntuiShell glyph (Paper uses
  simplified SVG stand-ins).
