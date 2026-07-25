---
title: PaperTexture Details preset is paperTexturePresets-by-name, not a root detailsPreset export
kind: gotcha
date: 2026-07-25
scope: apps/console + @paper-design/shaders-react
---

## trigger_case (the real scar)

CS4 called for `detailsPreset` (transparent `colorFront`/`colorBack`,
`speed: 0`). Importing `{ PaperTexture, detailsPreset }` from
`@paper-design/shaders-react` typechecked/failed with
`Module has no exported member 'detailsPreset'`. The package’s
`paper-texture.d.ts` declares `detailsPreset`, but the package root
re-exports only `PaperTexture` and `paperTexturePresets`. Runtime
`paperTexturePresets` entries are named `'Default' | 'Cardboard' |
'Abstract' | 'Details'`.

## rule_short

Resolve Details via
`paperTexturePresets.find((p) => p.name === 'Details') ?? paperTexturePresets[0]`,
then spread `.params`. Do not import a root `detailsPreset` from
`@paper-design/shaders-react` even if a nested `.d.ts` mentions it.
