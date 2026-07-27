# Full-bleed islands make MaterialLayer look dead without removing any code

**Kind:** anti_pattern
**Captured:** 2026-07-24
**Session signature:** `e7d593c`
**Domain tags:** commonplace, console, material-layer, island-shell, webgl

## Trigger

Screenshots of the console read as "CSS plaster on a lifted surface." The
instinct is to rebuild or replace the material system. The shader was intact:
SDF rounded rects, gutter shadows, header bands, terracotta pools, grain,
`inactiveAlpha` were all still in `MaterialLayer.tsx`.

The failure was coverage versus absolute-pixel constants designed for several
mid-size islands:

- Ground pools (`g1`/`g2`/`g3`) painted the frame, then one ~95% island covered
  them; only a thin border of terracotta survived.
- Gutter shadow used `exp(-d*0.11)`, decaying around ~20px, while the gutter was
  6px, so most of the shadow was clipped.
- Vertical wash used a tiny `cHiMix` (~1.4% dark) normalized over full island
  height; visible on a ~300px card, invisible on a ~1200px full block.
- Radius was one global `--ij-island-radius: 10` while the register size ramp
  says full surfaces use `--ij-radius-xl: 16`.

Fix was scale-relative falloff, per-`data-block-size` radius, and dark-ladder
reorder in `e7d593c`, not a MaterialLayer rewrite.

## Rule

If island material looks flat, first check island coverage versus absolute-pixel
shader constants and per-size radius. Do not rebuild MaterialLayer until those
fail.

## Evidence

- `apps/console/src/components/ground/MaterialLayer.tsx` (pre-fix absolute
  falloffs; post-fix `gutterPx` + coverage-scaled sheen/shadow)
- `apps/console/src/styles/register-bridge.css` (`[data-block-size="…"]` radius ramp)
- Commit: `e7d593c`
- Plan note: `docs/plans/console/36-DESIGN-FIX-LADDER-MATERIAL-CHROME.md`

## Encoded in

- `docs/learnings/2026-07-24-full-bleed-kills-absolute-pixel-material.md` (this file)
