# AMENDMENT-01-ELEVATION-AND-EDITIONS

Amends HANDOFF-CONSOLE-BLOCK-SYSTEM and HANDOFF-CONSOLE-ISLAND-SHELL. Register: amendment;
named choices are requirements. Decided with Travis 2026-07-21, after reviewing PR #91
(`claude/console-dimensionality`) rendered output and the two evolved desktop specs
(SPEC-COMMONPLACE-NATIVE-SHELL-1.0, SPEC-COMMONPLACE-CONSOLE-1.0).

Writing rules: no em dashes anywhere. No invented numbers. Status leads with what is not done.

## Why this amendment

PR #91 built the island shell anatomy correctly and completely. The rendered light theme is
washed, and it traces to one root cause verified in `apps/console/src/styles/int-ui-register-light.css`:
the surface stack is crushed into the top of the ramp (`--ij-frame` gray-11 `#DFE1E5`, `--ij-chrome`
gray-13 `#F7F8FA`, `--ij-editor`/`--ij-raised` gray-14 `#FFFFFF`). Three surfaces within about 32
luminance levels of white read as one value. This is the customization point the doctrine
anticipated: verbatim Int UI Light is this pale, and islands-on-a-shader need more elevation
separation than JetBrains flat panels do. Separately, the desktop app has evolved from "web app
plus a browser and terminal" to "a superset of the web app, as a browser, with blocks as apps,"
and that needs reconciling with the block contract so heads do not build conflicting things.

## Named choices

### A1. Light elevation decompression

Customize past verbatim in light mode. Direction (exact values chosen during implementation
against the contrast and island-class gates, which must pass):
- Editor islands stay `#FFFFFF` (paper, the brightest surface).
- Tool islands drop to about `gray-12` `#EBECF0` so editor-to-tool is a perceptible step, not
  the current 8/255.
- Frame goes one step deeper toward `gray-10` `#D3D5DB` so island-to-frame separation strengthens
  and gutter shadows from the Material Layer receive a ground.
- Seam and header values re-derive from the new bases (A3).

Dark mode is not assumed correct or broken here; it was not the acute case in the PR captures.
Re-verify dark separately and record the finding; change it only if it fails the same perceptual
bar.

### A2. Perceptual gates, not label gates

- `apps/console/scripts/check-island-classes.mjs` today asserts two distinct class labels. It must
  additionally assert a minimum luminance delta between the `editor` and `tool` base tokens, so a
  surface cannot pass with two classes that look identical. The current 8/255 must fail; pick the
  threshold so the A1 values pass and anything below a visible step fails.
- `theme-engine.ts` gains a target separation band for adjacent elevations, not only the 1.20:1
  island-to-frame floor. Generated themes must not hug the floor. Stock presets stay byte-stable
  in `theme-engine.test.ts`.

### A3. Header distinction is an observable outcome

The island header must be visibly distinct from its body. The IS choice-2 saturated header (the
`ToolWindow.Header.background` analog, base lightness up one step plus chroma up) is currently
delegated to the Material Layer paint region and produces no visible delta. Implementer picks the
mechanism: either the Material Layer renders a real delta for `data-paint-region="island-header"`,
or the header element takes an `--ij-island-header` background token. The DOM-paints-nothing lint
still holds if the token path is chosen only for the header band and the shader owns everything
else. Required outcome: in a screenshot, the header band is distinguishable from its body without
relying on the seam hairline alone.

### A4. Video block (Remotion)

Add `video` to the declared blocks (block-system B8, choice 13). Usage "compose video." Source:
`remotion-dev/remotion`, React programmatic video. Mounts surface and island; sizes w, full.
Sibling to the pdfx `document` block: both are artifact-production blocks with a render pipeline,
not pure client widgets. Remotion renders to MP4 through a headless browser server-side, so the
in-app block is the composition preview plus a render action that dispatches through the object
seam (`dispatch`), and the rendered artifact returns with a receipt. Register the descriptor now
with its designed empty state; the render pipeline is its own follow-on. Natural pairing later:
Remotion consuming Galley or run history to produce explainer clips.

### A5. Blocks as apps: the edition split and the host bridge

The two evolved desktop specs are consistent with the block contract once the seam is named. Pin
this so no head reads a conflict where there is none.

- **The host bridge is the portability seam.** SPEC-COMMONPLACE-NATIVE-SHELL-1.0's
  `CommonplaceHost` interface with three adapters (Web over HTTP and GraphQL and WebSocket, Tauri
  over invoke and events, Gpui over typed loopback IPC) is the durable asset. The React block app
  never knows its host. This is the same seam as `BlockHost` in `packages/block-view`, viewed from
  the app boundary rather than the block boundary; they are reconciled during native-shell work,
  not duplicated.
- **The block contract defines capabilities and addressing. The edition decides surface.** A block
  is the unit of application. In the web and Tauri editions, blocks render inside the React canvas.
  In the native GPUI edition, the thin shell governs surfaces: it hosts the React surface (blocks
  inside it) as one realm and native Servo surfaces as peer realms. GPUI arranges surfaces; React
  arranges blocks inside its surface; they never share authority over one panel.
- **`browser-pane` and `terminal` are the web-edition renderings, not a contradiction with the
  native shell.** Block-system B8 declares `browser-pane` (usage "view a page") backed by the Servo
  render worker (`POST /render`, an image or DOM into the canvas) and `terminal` (usage "operate a
  shell") backed by a web renderer such as textmode. SPEC-COMMONPLACE-NATIVE-SHELL-1.0 renders the
  same two capabilities as native Servo surfaces and native shell surfaces. Both are the same
  capability under one addressing scheme; the shared verb is `openTarget` on the host bridge. The
  native edition supersedes the block rendering for fidelity where the shell is present; that is the
  edition split, not drift. Each block descriptor's data note records both renderings so an
  implementer cannot mistake them for one component.
- **SPEC-COMMONPLACE-CONSOLE-1.0 is the same pattern applied to "your data."** One Rust
  `console-core` compiled to native and wasm32, two paints (GPUI instanced nodes, web block on
  cosmos.gl), same authed doors, no privileged bypass. It is additive to the block system: the web
  console ships as a block or plugin and speaks the Data API like everything else. Nothing in it
  conflicts with this contract.

Net rule for heads: capability and addressing live in the block contract; portability lives in the
host bridge; the edition decides the surface. A capability may render as a block in one edition and
a native surface in another, and that is expected.

## Deliverables

**AM1.** A1 elevation values in `int-ui-register-light.css` (and any re-derived seam and header
tokens), `token-manifest.json` regenerated, `gate:contrast` and `gate:tokens` pass; dark re-verified
and its finding recorded.

**AM2.** A2 perceptual delta in `check-island-classes.mjs` (current 8/255 fails, A1 values pass) and
the A2 target band in `theme-engine.ts` with presets byte-stable.

**AM3.** A3 header distinction landed by whichever mechanism, with a before-and-after screenshot in
the report.

**AM4.** `video` descriptor registered per A4 with its designed empty state; data note records the
server-side render pipeline; no claim that rendering is wired.

**AM5.** A5 is documentation and boundary, not code. The obligation on heads: `browser-pane` and
`terminal` descriptors carry a data note naming both the web rendering and the native-surface
supersession, so the edition split is legible in the contract itself.

## Acceptance

Report status as a scannable list leading with what is not done.

1. A three-island light-mode capture shows two clearly different base surfaces and a header band
   distinguishable from its body without relying on the seam line.
2. `check-island-classes.mjs` fails on an 8/255 editor-tool pair and passes on the A1 values.
3. No generated theme sits at the 1.20:1 floor for adjacent elevations; the target band holds.
4. Dark mode re-verified; either unchanged with a recorded reason or brought to the same bar.
5. `video` appears in `blocksForMount("island")` and `blocksForMount("surface")` with a designed
   empty state and no rendered-pipeline claim.
6. `browser-pane` and `terminal` descriptors each carry the dual-rendering data note from A5.
7. `pnpm gates` passes.

## Out of scope

The Remotion render pipeline itself, native-shell and console spec implementation (their own
specs), dark-mode redesign beyond meeting the perceptual bar, and any Material Layer change beyond
what A3 requires.
