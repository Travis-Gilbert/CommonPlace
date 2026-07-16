---
title: "The console-register Tailwind utility layer is incomplete: no full spacing/sizing scale yet"
kind: gotcha
date: 2026-07-12
area: CommonPlace apps/web design system
rule_short: "global.css @theme maps only --cr-* colors, radius, text, fonts (+ a handful of hand @utility spacing rules). There is NO full spacing/sizing scale, so v2 surfaces cannot yet be expressed purely in register utilities without extending the layer first."
---

## trigger_case

After deciding to convert v2 surfaces to Tailwind register utilities, I went to convert the shell `Rail` (uses `.p-rail` width 216px, nav-item paddings on the `--cr-space-*` lh rhythm). Reading `global.css @theme` revealed it exposes `--color-cr-*`, `--radius-cr-*`, `--text-cr-*`, `--font-cr-*`, plus a few hand `@utility` rules (`gap-cr-1..4`, `p-cr-2..4`, `h-row`, `px-chip`, `shadow-transient`). It does NOT map the `--cr-space-1..6` rhythm into a real spacing scale, and there is no named width utility for the rail. The register lint bans arbitrary values (`w-[216px]`, `p-[2.4lh]`), so the surfaces are not expressible in lint-legal utilities today. Grep confirmed ZERO components consume the existing hand spacing utilities: they are unused scaffolding.

## rule

- The v2 -> Tailwind conversion has a prerequisite phase: extend `global.css @theme` to map `--spacing-cr-1..6` (from `--cr-space-*`) so the full spacing scale (`p-cr-*`, `m-cr-*`, `gap-cr-*`, `w-cr-*`) generates, plus named layout sizes (rail width). Tailwind v4 generates the whole spacing family from a single `--spacing-*` theme entry.
- Because nothing consumes the existing hand `@utility gap-cr-*/p-cr-*`, they can be replaced by the generated scale without breaking consumers.
- `console-register.css` is GENERATED ("do not edit by hand"); it already defines `--cr-space-1..6`. The bridge work is in `global.css @theme` (the Tailwind mapping layer), not in the generated token file.
- Converting surfaces also moves spacing from porcelain's 8px `--u` grid onto the register lh rhythm (CR3 intent), so conversions are a reflow, not a pure class swap.
