# AMENDMENT-01 report: elevation and editions

Source: `AMENDMENT-01-ELEVATION-AND-EDITIONS.md` (PR #91 review).
Branch work on `claude/console-dimensionality`.

## Status lead (what is not done)

1. **Three-island light screenshot (acceptance 1):** not captured in this pass.
   Token and gate work is in; visual proof still needs a live light-mode shot
   with Files/Context/Thread + editor after pull.
2. **Before/after header screenshot (AM3 evidence):** not on disk yet. Mechanism
   landed (header token background); shot is the remaining artifact.
3. **Harness `plan create`:** 502 from Theorem MCP during the session; work
   proceeded without a durable plan id.

Everything else below is done.

## Acceptance checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Light three-island capture: distinct bases + header | **Not done** (needs screenshot) |
| 2 | Island gate fails 8/255, passes A1 | Pass (`ΔY` legacy `#FFFFFF/#F7F8FA` under 0.10; A1 `#FFFFFF/#EBECF0` = 0.161) |
| 3 | Theme target band above 1.20 floor | Pass (`ISLAND_FRAME_TARGET` 1.22; editor/tool OKLCH delta ≥ 0.04) |
| 4 | Dark re-verified | Pass with recorded find (unchanged; see below) |
| 5 | `video` on island + surface, empty state only | Pass (`id: video`, Remotion source, `VideoBlock` empty copy) |
| 6 | `browser-pane` / `terminal` dual-rendering notes | Pass (`block.dataNote`) |
| 7 | Gates | Pass (`npm run gates`) |

## Shipped

### AM1 light elevation

`int-ui-register-light.css`:
- `--ij-frame` → gray-10 `#D3D5DB`
- `--ij-chrome` (tool) → gray-12 `#EBECF0`
- `--ij-editor` / `--ij-raised` stay gray-14 `#FFFFFF`
- Seam / divider / hover re-derived to gray-11 so they are not identical to tool

Gold light clamp moved to `#8F5800` so gold-on-chrome clears 4.5 on gray-12.

### AM2 perceptual gates

- `check-island-classes.mjs`: label mix plus `MIN_EDITOR_TOOL_LUMINANCE_DELTA = 0.1`
- `theme-engine.ts`: light chrome index gray-12, frame `#D3D5DB`,
  `ISLAND_FRAME_TARGET = 1.22`, editor/tool elevation check
- Stock gray ramp remains byte-stable at zero chroma (`theme-engine.test.ts`)

### AM3 header distinction

Token path (not a MaterialLayer-only delta):
- Light headers: tool → gray-11, editor → gray-12
- CSS: `[data-island-shell][data-island=…] > [data-island-header]` sets
  `background-color` from those tokens
- IslandShell header dropped `bg-transparent` so the token wins

### AM4 video block

`video` descriptor: mounts surface+island, sizes w/full, Remotion source,
designed empty state, `dataNote` describes server-side MP4 pipeline without
claiming it is wired.

### AM5 edition notes

`browser-pane` and `terminal` `block.dataNote` name web canvas rendering vs
native-surface supersession under host-bridge `openTarget`.

## Dark re-verification (acceptance 4)

Measured against Int UI dark stock bases (editor `#1E1F22`, tool `#2B2D30`,
frame `#393B40`):

| Pair | Value |
| --- | --- |
| tool vs editor ΔY | 0.012 (below light A2 threshold 0.10) |
| tool on frame contrast | 1.23 (≥ 1.22) |
| editor on frame contrast | 1.47 (≥ 1.22) |
| header tool over chrome | 1.14 (≥ 1.05) |
| header editor over editor | 1.09 (≥ 1.05) |

**Finding:** dark fails the *light* ΔY 0.10 editor/tool bar, but clearing that
bar would force tool chrome into mid-gray (`#6F737A` territory) and break the
Int UI dark look. Island-to-frame and header pairs already clear their gates.
**Decision:** leave dark elevation unchanged; a dark-specific ΔL* threshold is
a follow-on if captures still look washed in dark.

## Evidence

- `apps/console/src/styles/int-ui-register-light.css`
- `apps/console/src/styles/register-bridge.css`
- `apps/console/scripts/check-island-classes.mjs`
- `apps/console/src/styles/theme-engine.ts`
- `apps/console/src/views/registry.tsx` (`video`, data notes)
- `apps/console/src/views/blocks/DeclaredBlocks.tsx` (`VideoBlock`)
