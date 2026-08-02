# Modifications to twenty-ui

Upstream: `https://github.com/twentyhq/twenty` `packages/twenty-ui` (MIT), pinned
at commit `b754e15331c6472d772b1bbe448469f811b28afd`, version `1.0.0-alpha.1`.
See `UPSTREAM.md` for the pin and the remote, `NOTICE` for attribution, `LICENSE`
for the MIT text that travels with this fork.

Executed under `SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0`.

## The one law

CommonPlace tokens are the only styling truth. The fork's theme objects and its
`--t-*` CSS variable layer are generated from them by
`src/theme/generator/`. No upstream color value survives in `dist`.

Twenty's proportions survive as structure: `THEME_COMMON` (spacing multiplicator,
animation durations, icon and modal sizes, table metrics, side panel width,
sibling gap, the 0.1s background transition) is preserved field for field.

## TU1. Vendor and strip

### Removed: Twenty marks

MIT licenses the code, not the trademarks.

- `src/icon/components/IconTwentyStar.tsx`
- `src/icon/components/IconTwentyStarFilled.tsx`
- `src/assets/icons/twenty-star.svg`
- `src/assets/icons/twenty-star-filled.svg`
- `src/assets/themes/dark-noise.jpg`, `src/assets/themes/light-noise.png`
  (Twenty's material texture; the console's ambient material is the WebGL
  MaterialLayer, and a second grain layer would fight it)
- `logo.png` (never copied)

### Removed: third-party company marks

Upstream vendored these for its own integration surfaces. They are other
companies' trademarks, they carry hardcoded brand fills that the console's
`gate:icons` rejects, and the console has no integration surface for them.

- Components: `IconBrandAnthropic`, `IconBrandGemini`, `IconBrandGroq`,
  `IconBrandMistral`, `IconBrandXai`, `IconGmail`, `IconGoogle`,
  `IconGoogleCalendar`, `IconMicrosoft`, `IconMicrosoftCalendar`,
  `IconMicrosoftOutlook`, `IconModelClaude`, `IconProviderOpenai`
- Assets: `anthropic.svg`, `claude.svg`, `gemini.svg`, `groq.svg`, `gmail.svg`,
  `google.svg`, `google-calendar.svg`, `microsoft.svg`, `microsoft-calendar.svg`,
  `microsoft-outlook.svg`, `mistral.svg`, `openai.svg`, `xai.svg`
- `src/icon/index.ts` re-exports for the above

### Kept, with reasons

- The field-type `IllustrationIcon*` family and its assets. These are functional
  field-kind glyphs (array, currency, one-to-many, uid, ...), not identity. The
  console's own product and domain glyphs remain Noun Project per its icon
  policy; the illustration family stays available inside the fork for
  data-display surfaces.
- `@tabler/icons-react` re-exports (`src/icon/components/TablerIcons.ts`). Tabler
  Icons is MIT. Bumped to `^3.45.0` to match the console's installed version so
  one copy resolves.
- `src/testing/decorators` (TU3 removes their router providers).

### Removed: build-time surfaces

- All Storybook stories: 156 `*.stories.tsx` files and every `__stories__`
  directory. The fork is consumed by the console, not documented by Storybook,
  and the stories carried the router and brand-asset couplings.
- Storybook, Argos, size-limit, jest, and prettier devDependencies.
- `vite-plugin-checker` and `vite-plugin-sass-dts` from the build: type checking
  runs as `npm run check` (`tsc --noEmit`), and the ambient
  `src/scss-modules.d.ts` already types the SCSS module imports.
- `@radix-ui/colors`: upstream's palette source for the theme constants. TU2's
  generator replaces every constant it fed, so the dependency is gone from the
  graph, which is also how "no upstream color value survives" becomes structural
  rather than a promise.

### Package identity

- Name kept as `twenty-ui`, per named choice 1: the pnpm workspace shadows the
  registry name so no published copy can resolve beside the fork. Marked
  `private: true` and versioned `1.0.0-alpha.1-cp.0`.
- `next` added as a peer dependency (TU3's router seam).
- `monaco-editor` peer marked optional (TU7 loads it lazily).

## TU2. The token generator

`src/theme/generator/` is the single seam where styling truth enters.

- `commonplaceTokens.ts` vendors the CommonPlace token model into the fork so the
  package has no back-dependency on `apps/console`: the OKLCH paper and ink
  ladders with the ink chroma clamp, the two derived families (`paperRoles`,
  `inkRoles`), the three materials (sunken, lifted, docked), and the radius law.
- `themeModel.ts` maps every twenty-ui theme slot onto a CommonPlace register
  token by reference (`var(--ij-...)`), not by value. Light and dark therefore
  follow the console's own register switch and its two-knob theme engine for
  free, and `dist` contains no upstream color literal.
- `emit.ts` writes both surfaces from that one model: the TS constant files under
  `src/theme/constants/` and the `--t-*` CSS layer in
  `src/theme-constants/theme-light.css` and `theme-dark.css`. Regenerate with
  `npm run generate:theme`.
- `THEME_COMMON`, `Animation`, `Icon`, `Modal`, and `Text` are untouched
  upstream files: the proportions layer.

## TU3. The router seam

`react-router-dom` is removed from the dependency graph. One adapter,
`src/navigation/LinkAdapter/LinkAdapter.tsx`, wraps `next/link`, and every
Link-consuming component routes through it.

Rewritten:

- `src/feedback/Info/Info.tsx`
- `src/navigation/RawLink/RawLink.tsx`
- `src/navigation/UndecoratedLink/UndecoratedLink.tsx`
- `src/data-display/LinkChip/LinkChip.tsx`
- `src/input/FloatingButton/FloatingButton.tsx`
- `src/input/Button/Button.tsx`
- `src/input/AnimatedButton/AnimatedButton.tsx`
- `src/input/TabButton/parts/StyledTabBase.tsx`
- `src/utilities/navigation/hooks/useResetLocationHash.ts`
- `src/utilities/navigation/hooks/useMouseDownNavigation.ts`
- `src/testing/decorators/RouterDecorator.tsx`
- `src/testing/decorators/ComponentWithRouterDecorator.tsx`

## TU5. Console components deleted by the re-seat

Every hand-rolled console component replaced by a fork primitive, deleted the
same day. This list is verified against the actual removals by
`apps/console/scripts/check-twenty-fence.mjs`.

| Deleted path | Replaced by |
|---|---|
| `apps/console/src/components/ui/checkbox.tsx` | `twenty-ui/input` `Checkbox` |
| `apps/console/src/components/status-indicator.tsx` | `twenty-ui/data-display` `Status` |
| `apps/console/src/components/json-viewer.tsx` | `twenty-ui/json-visualizer` `JsonTree`, through `apps/console/src/components/receipt-json.tsx` |
| `apps/console/src/styles/jalco-json-themes.ts` | the token generator: 65 shiki editor themes beside the register were a second theming system |

Re-seated in place, keeping the module path so the orchestration around them
diffs empty:

| Path | Now binds |
|---|---|
| `apps/console/src/views/records/RecordChip.tsx` | `twenty-ui/data-display` `Tag` |
| `apps/console/src/views/records/cells.tsx` | `Chip`, `LinkChip`, `Status`, `LightButton` |
| `apps/console/src/views/records/tints.ts` | `TagColor` names, resolved by the generator |
| `apps/console/src/views/records/editors.tsx` | `twenty-ui/input` `Checkbox` |
| `packages/model-canvas/src/components/canvas/MartNode.tsx` | `TintedIconTile`, `Tag`, `Pill`, `Button`, `LightButton` |
| `apps/console/src/components/shell/EditorTabs.tsx` | `twenty-ui/input` `StyledTabButton` |

### Named limits

Three surfaces keep their existing sources, each for a structural reason, not a
deferral:

- **Text, number, and date inputs** (`views/records/editors.tsx`) stay on shadcn.
  The fork ships `SearchInput` and no general text field.
- **The enum select** stays on shadcn. Twenty's Dropdown lives in `twenty-front`,
  which is AGPL and never crosses into this repository, so the fork has no
  dropdown host to adopt.
- **The ViewBar popover trigger** stays on the shadcn Button. Radix `asChild`
  needs a ref-forwarding child and the fork's `Button` does not forward one.

None of these is a hand-rolled component; all three are existing ledger rows.

### The Monaco subpath

Upstream exports `CodeEditor` from `input/index.ts`, beside `Checkbox`, `Button`,
and every other control. That barrel is what a console imports to get a
checkbox, so shipping Monaco through it puts `@monaco-editor/react` and
`monaco-editor` in the module graph of every route that uses any input. A
dynamic import at the call site cannot undo that; the bundler has already walked
the barrel.

The fork publishes them at `twenty-ui/code-editor` instead
(`src/code-editor/index.ts`). TU7's "banned from initial route bundles" is a
package boundary now, not a convention a future import can quietly break.

## Behavioral changes

- Components are consumed from `dist`. The console adds `twenty-ui` as a
  `workspace:*` dependency and builds it before its own build.
- `AppTooltip`, `Modal`, `Checkbox`, `Radio`, `Toggle`, `SearchInput`,
  `ProgressBar`, and the collapsible layout components keep their `@base-ui/react`
  bindings. Base UI is headless; the paint comes from the generated theme.
