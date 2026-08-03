# 012 — The twenty-ui hard fork

Executes `SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0` (2026-08-01), deliverables TU1
through TU7. Upstream `twentyhq/twenty` `packages/twenty-ui` at
`b754e15331c6472d772b1bbe448469f811b28afd`, MIT, vendored as
`packages/twenty-ui`.

Amendment (SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL9): the final deliverable of this surface is its `.commonplace-canonical` manifest row flipped and its production smoke green at a named URL; any superseded primitive layer carries that deletion as a deliverable with its own acceptance.

## What changed about the verdict

The spec was written expecting Emotion. At the pinned SHA there is none.
twenty-ui 1.0.0-alpha.1 uses SCSS Modules that read `--t-*` CSS custom
properties, with `src/theme-constants/theme-{light,dark}.css` as the paint layer
and `src/theme/constants/*.ts` as a typed mirror. `src/theme/index.ts` is marked
auto-generated, but the generator is `scripts/generateBarrels.ts`, a barrel
writer, not a theme generator: the values were hand-authored constant files
sourced from `@radix-ui/colors`.

That moved TU2's seam. The reskin had to emit **both** surfaces from one model,
not replace one file.

## Named decisions

1. **Semantic slots bind by reference, not by snapshot.** Every twenty-ui theme
   slot that the console register already names resolves to `var(--ij-*)`. Light
   and dark, the two-knob theme engine, and the Primer presets therefore reach
   fork components without the fork participating, and `dist` contains no
   upstream color literal by construction rather than by discipline.
2. **The palette namespace is derived, not adopted.** twenty-ui addresses record
   tag colour by 25 hue names the console register does not carry. Those are
   generated in OKLCH from the same paper and ink model under the same chroma
   clamp. Where the console does own a hue, `REGISTER_HUE_SLOTS` binds the name
   to that register token, so a fork `Tag` and a console row tint are one paint.
3. **The CSS variable names are read from upstream's own accessor map.**
   `emit.ts` walks `themeCssVariables.ts` in lockstep with the new model. A path
   the accessor still reads but the model fails to fill throws at generate time.
   994 variables per mode, zero misses.
4. **Round, not squircle.** Upstream's `@supports (corner-shape: squircle)` block
   is not emitted, and the generator writes `--t-corner-shape: round`. The
   MaterialLayer SDF draws circular rounded rects behind each island; a squircle
   DOM clip over a circular shader corner is the doubled-corner halo the console
   geometry spec already ruled out.
5. **Monaco's theme resolves through the browser.** With theme values now
   `var(--ij-*)`, upstream's display-p3 string parser cannot work. `resolveCssColor`
   sets the expression on a probe element and reads back the computed colour,
   which handles nesting, `oklch()`, and `color-mix()` without a parser.
6. **The AGPL bright line is a CI gate, not a memo.**
   `apps/console/scripts/check-twenty-fence.mjs` fails when any import resolves
   into a Twenty path other than `twenty-ui`, when any file in the fork carries
   `@license Enterprise`, or when MODIFICATIONS.md's deletion list disagrees with
   the filesystem.

## What the console gained

- One JSON surface. `components/receipt-json.tsx` over the fork's json-visualizer
  replaces the jalco viewer and its 65 shiki editor themes, which were a second
  theming system beside the register.
- One inline code surface. `components/inline-code-editor.tsx` puts Monaco behind
  `next/dynamic` with `ssr: false`; the 1422KB chunk is absent from
  `rootMainFiles`, so no route pays for it at first paint.
- Record primitives with anatomy the hand-rolled versions never had: overflow
  tooltips, the icon slot, keyboard-activatable state pills, indeterminate
  checkboxes.

## Named limits

Three surfaces keep their existing sources, each structurally rather than by
deferral: general text inputs (the fork ships only `SearchInput`), the enum
select (Twenty's Dropdown lives in AGPL `twenty-front`), and the ViewBar popover
trigger (Radix `asChild` needs a ref-forwarding child; the fork's `Button` does
not forward one). All three are existing ledger rows, not hand-rolled code.

## Fixed in passing

`apps/console/src/app/api/identity/workspaces/[workspaceId]/api-keys/route.ts`
exported `API_KEY_REVOCATION_CACHE_SECS`, which Next 16 rejects as a non-Route
export. The console could not build at HEAD. The constant moved to
`lib/server/api-key-revocation.ts`. Introduced by `3c609b28` (2026-07-31),
unrelated to this work.
