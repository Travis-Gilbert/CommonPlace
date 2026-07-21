# HANDOFF-CONSOLE-ISLAND-SHELL

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`, package `packages/block-view`. Register:
execution handoff; named choices are requirements. Decided with Travis 2026-07-20.

Companions: HANDOFF-CONSOLE-BLOCK-SYSTEM (B1 presentation grammar, B2 tokens, B10 movement are
dependencies), HANDOFF-CONSOLE-ISLANDS-AND-MATERIAL (the material layer this shell registers
with), the console pivot decision log.

Writing rules: no em dashes anywhere. No invented numbers. Status reports lead with what is not
done.

## What this is

The base block. Islands are blocks wearing shared chrome, and today that chrome does not exist
as a component: each view draws its own container, which is why islands do not compose in
proportion. This handoff creates `IslandShell`, the one shell every island-mounted block
inherits: header band, body, footer status, states, density, and geometry. Blocks bring
content; the shell brings composition.

## Verify first

- `apps/console/src/views/ViewStates.tsx` and `ViewStates.test.tsx` (the state grammar seed;
  extend it, do not replace it)
- `apps/console/src/components/shell/ViewInstanceHost.tsx` and `IntuiShell.tsx` (where view
  instances mount today)
- `apps/console/src/components/ground/` (the material layer mechanism; learn how island
  geometry reaches the shader before wiring anything)
- `apps/console/src/views/registry.tsx`, `CardView.tsx`, `RecordTableView.tsx` (the two
  migration proofs)
- `apps/console/src/styles/int-ui-register.css`, `int-ui-register-light.css`,
  `register-bridge.css`, `token-manifest.json`
- `packages/block-view/src/types.ts` (B1's `BlockPresentation`)

Search before asserting absence. Listings truncate.

## Named choices

1. **One shell.** `IslandShell` at `apps/console/src/components/blocks/IslandShell.tsx` is the
   only island chrome. Every island-mounted block renders inside it. No view draws its own
   container, border, radius, or shadow. Anatomy is fixed: header band, body, footer status.

2. **Header band.** 36px cozy, 30px compact. Contents left to right: kind glyph (16px, icons
   never letters, kind tint pairs per the object-system ruling), title (IBM Plex Sans, 15/600
   cozy, 13/600 compact), count (JetBrains Mono 11, tabular-nums, muted), spacer, actions
   overflow, drag handle (dnd-kit handle from B10, visible on hover and focus). Header surface
   gets its own token, the `ToolWindow.Header.background` analog: island base lightness raised
   one elevation step and chroma raised between 0.005 and 0.010 over base. This is the
   saturated, more granular header.

3. **Body is flat.** No nested card surfaces by default; rows and content sit directly on the
   island base. Padding 16 cozy, 10 compact. Internal ramp: section label IBM Plex Sans 12/600;
   body 13/400; machine values JetBrains Mono 11, muted, tabular-nums, per the authorship
   amendment. A block that needs an inner raised surface names the reason in review.

4. **Footer status line.** 24px, JetBrains Mono 11, muted. Hosts the live dot, staleness note,
   receipt notes, and the one-line error summary. Hidden entirely when empty. This is the only
   place transport health appears inside an island.

5. **States through ViewStates.** Loading (skeleton shaped to the block type), empty (designed,
   per B8), error (one rendering: body notice plus footer summary, never raw strings in the
   content flow, never duplicated), stale. `ViewStates.tsx` is extended to cover all four and
   the shell consumes it; blocks never hand-roll state rendering.

6. **Two island base classes minimum.** `editor` (lighter base) and `tool`, per the ratified
   variation amendment. `BlockPresentation` gains optional
   `surfaceClass?: "editor" | "tool"` defaulting to `tool`. Homogeneous islands remain a
   defect; a surface with three or more islands renders at least two classes.

7. **Geometry from B2, painted by the material layer.** Radius 10, gutter 6, border equals
   base, frame inversion, `inactiveAlpha` 0.44 when the window loses focus. The shell paints
   nothing: it registers its rect and class with the ground mechanism found in
   `components/ground/` and the shader renders base, lit top edge, gradient, grain, and gutter
   shadow. The DOM-paints-nothing lint continues to hold.

8. **Size grammar realized.** The 12-column island grid maps `BlockSize` spans (s 3x2, m 4x3,
   v 3x5, sq 4x4, w 6x3, full). Minimum sizes keep the header legible; a block whose declared
   sizes cannot fit its header fails registration in dev.

9. **Density.** `compact` and `cozy` values above are the two densities; the descriptor's
   `density` picks, `both` lets the mount decide (islands default cozy, stripe and chrome
   default compact).

10. **Paper stage.** The shell's four states and both base classes are designed in Paper
    against live records (Paper MCP plus harness MCP, heads-local), extracted with `get_jsx`
    and `get_computed_styles`. The in-repo register stays canonical; Paper is the design
    surface.

## Deliverables

**IS1.** `IslandShell.tsx` with the anatomy, classes, densities, and material registration
above; typed props take a `ViewDescriptor` plus a `view-instance` id.

**IS2.** Header and footer tokens in the registers and `register-bridge.css`;
`token-manifest.json` regenerated; `gate:tokens` and `gate:contrast` pass, including the
header-over-base step.

**IS3.** `ViewStates.tsx` extended to loading, empty, error, stale, consumed by the shell;
`ViewStates.test.tsx` covers the single-rendering error rule.

**IS4.** Migration proofs: `CardView.tsx` and `RecordTableView.tsx` render inside the shell
with their own container styling deleted. These two prove the pattern before anything else
migrates.

**IS5.** Grid realization: island mounts place shells on the 12-column grid with B10 drag
handles wired; resize snaps to declared sizes.

## Acceptance

1. One screenshot of a three-island surface shows two base classes and consistent header
   anatomy across all three.
2. A forced query failure renders the error exactly once: body notice plus footer summary,
   nothing in the content flow, nothing duplicated.
3. Grayscale capture passes the speaker and label checks; no chrome label is mono.
4. `CardView` and `RecordTableView` draw no island or nested-card container chrome
   (no own radius, border, shadow, or raised fill). Interaction and control paint
   (row hover, selection, focus) remains allowed.
5. Blurring the window applies the 0.44 overlay via MaterialLayer; refocusing removes it.
6. `pnpm gates` passes.

## Out of scope

Sidebar and chat visuals (their own handoffs), new block renderers, material shader changes
beyond consuming the new header tokens.
