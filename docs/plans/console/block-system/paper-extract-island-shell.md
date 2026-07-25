# Paper skin extract: IslandShell anatomy

Extracted 2026-07-21 via Paper Desktop MCP (`get_jsx` Tailwind +
`get_computed_styles`). File: Engaging beacon. Artboard: IslandShell anatomy.

In-repo register remains canonical truth. Paper is the design surface and
extraction tool (HANDOFF choice 14).

## Verdict

Register and IslandShell already match the Paper anatomy on metrics and
semantic colors. One Paper drift was fixed in-file: the error island radius was
33px and is now 10px to match the other islands and `--ij-island-radius`.

IslandShell DOM paint stays transparent; Material Layer owns chrome / editor /
header fills. Paper shows those fills as opaque rectangles so the extract can
name the hex targets the Material Layer and register already carry.

## Frame and grid

| Role | Paper computed | Register token |
| --- | --- | --- |
| Frame ground | `#393B40` | `--ij-frame` / `--ij-gray-3` |
| Island gutter | `6px` | `--ij-island-gutter` |
| Island radius | `10px` | `--ij-island-radius` |
| Frame pad | `24px` | artboard chrome (not a block token) |

## Island surfaces

| Role | Paper | Register |
| --- | --- | --- |
| Tool body | `#2B2D30` | `--ij-chrome` / `--ij-gray-2` |
| Editor body | `#1E1F22` | `--ij-editor` / `--ij-gray-1` |
| Tool header | `#34363C` | `--ij-island-header-tool` |
| Editor header | `#25262A` | `--ij-island-header-editor` |
| Seam | `#1E1F22` | `--ij-seam` |
| Ink | `#DFE1E5` | `--ij-ink` / `--ij-gray-12` |
| Meta ink | `#868A91` | `--ij-ink-info` / `--ij-gray-8` |
| Live / ok | `#57965C` | `--ij-ok` / `--ij-green-6` |
| Error | `#DB5C5C` | `--ij-error` / `--ij-red-7` |
| Retry accent | `#3574F0` | `--ij-accent` / `--ij-blue-6` |

## Anatomy metrics

| Band | Paper | Register / shell |
| --- | --- | --- |
| Header height | `36px` | `--ij-island-header-h` / `h-ij-island-header` |
| Footer height | `24px` | `--ij-island-footer-h` |
| Body pad | `16px` | `--ij-island-body-pad` |
| Title | 15px / 600 / IBM Plex Sans | `--ij-island-title-size` + `font-ij-ui` weight 600 |
| Meta / count | 11px / JetBrains Mono / `tnum` | `--ij-island-meta-size` + `font-ij-mono` |
| Header gap | `8px` | `gap-2` on header |
| Kind glyph | `16×16` | `size-4` |

## States shown

1. Tool island (Records): skeleton rows + live footer.
2. Editor island (Cards): card skeleton pair, no footer (empty status is honest).
3. Tool island error: body error copy + footer status + Retry action.

Chrome labels (island titles) use IBM Plex Sans, not mono. Counts and status
use JetBrains Mono. Matches `gate:register` chrome-labels-not-mono.

## Code mapping

- Shell structure: `apps/console/src/components/blocks/IslandShell.tsx`
- Paint realization: `apps/console/src/components/ground/MaterialLayer.tsx`
- Tokens: `apps/console/src/styles/register-bridge.css` (`--ij-island-*`)
- JSX snapshot: `paper-extract-island-shell.jsx.txt` (sibling)

## Paper fixes applied this pass

- Error island radius: 33px → 10px (aligned with tool / editor islands).

## Not claimed

- Full console chrome (stripe, tool windows, composer) was not on this artboard.
- Second Paper file (Amazing glacier) had no artboards; skipped.
- No register token values were changed; they already matched the extract.
