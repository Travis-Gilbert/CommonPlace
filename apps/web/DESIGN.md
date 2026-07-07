---
name: CommonPlace Porcelain
description: A warm-neutral, structural workspace theme where one reserved accent carries all decision weight.
colors:
  ground-0: "#F6F5F4"
  ground-1: "#E9E8E5"
  raised: "#FDFDFB"
  ink: "#211F1B"
  ink-dim: "#57534A"
  ink-faint: "#736E63"
  accent: "#8A2E29"
  accent-deep: "#71231F"
  accent-ink: "#FBF3E4"
  hairline: "rgba(33, 31, 27, 0.15)"
  ok: "#3D7A4A"
  teal: "#2E6F69"
  amber: "#9A6A14"
  navy: "#33455C"
  tag-grey: "#6B665C"
  tag-yellow: "#8A6A12"
  tag-orange: "#A2531F"
  tag-red: "#9A2E29"
  tag-pink: "#97386A"
  tag-purple: "#64499A"
  tag-blue: "#33455C"
  tag-sky: "#2E6A8A"
  tag-teal: "#2E6F69"
  tag-green: "#3D7A4A"
typography:
  display:
    fontFamily: "'Cabinet Grotesk', 'IBM Plex Sans Condensed', sans-serif"
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "normal"
  body:
    fontFamily: "'IBM Plex Sans Condensed', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "0.68rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  chip: "5px"
  control: "7px"
  row: "10px"
  band: "15px"
  pill: "20px"
spacing:
  unit: "8px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  band:
    backgroundColor: "{colors.ground-0}"
    rounded: "{rounded.band}"
    padding: "18px 20px 12px"
  command-bar:
    backgroundColor: "{colors.ground-0}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.mono}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  nav-item:
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.row}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  tag-chip:
    rounded: "{rounded.chip}"
    padding: "2px 8px"
    typography: "{typography.mono}"
---

## Overview

Porcelain is a lit, warm-neutral ground, not a card grid. Every surface is one of three things: a sheet (the rail, resting on the ground with a hairline and no shadow), a float (a band, translucent and softly elevated over the ground), or a well (an inset control, pressed slightly into the surface). There is exactly one accent color and it carries exactly one meaning: a pending decision or genuine tension. Everything else (status, categories, tags) lives in a muted, desaturated palette so the surface never reads as all-alarm. A second register, umber, exists for containers where "the machine is speaking" (active tool execution, streaming output) and flips the ground dark without changing the structural language. Anti-references: generic AI-chat SaaS chrome (gradient hero metrics, glass cards, badge-heavy sidebars, drop-shadowed chat bubbles).

## Colors

Ground is warm off-white (`ground-0` / `ground-1`), built from a radial bloom plus directional wash rather than a flat fill, so it reads as lit rather than painted. Ink is a warm near-black (`ink`), stepping down through `ink-dim` and `ink-faint` for secondary and tertiary text, both tuned to clear 4.5:1 against the ground. `accent` (a muted brick red) is reserved for pending decisions and tension; it must not be reused as a generic "primary button" color. `teal` is the calm baseline for categories and tags. `amber` marks attention/waiting-on-a-human. `navy` marks quiet forward progress. The eleven-color tag palette (`tag-grey` through `tag-green`) exists specifically for user-assigned status/tag values on objects and is deliberately desaturated so no tag competes visually with the one reserved accent.

## Typography

Three families: `display` (Cabinet Grotesk, falling back to IBM Plex Sans Condensed) for headings and section titles, `body` (IBM Plex Sans Condensed) for all running UI text at a 14px base, and `mono` (IBM Plex Mono) for anything machine-adjacent: command input, keyboard hints, timestamps, tool-call payloads. Hierarchy comes from the display/body/mono split plus weight, not from a deep numeric type scale.

## Elevation

Three-tier light model, not a shadow ramp: `edge` (an inset top highlight simulating a lit bevel), `raise` (a soft, low-contrast shadow pair for rail/control-level lift), and `float` (a larger, softer shadow for bands sitting over the ground). `well` is the inverse, an inset shadow for pressed/inset controls (search inputs, code wells). Backdrop blur (4-5px, with slight saturation boost on floats) reinforces the translucent-plane read. Nothing uses a hard drop shadow or a glass-morphism blur as pure decoration; blur is always paired with a hairline border and a real elevation role.

## Components

`.p-ground` is the page-level lit backdrop. `.p-rail` is a one-tone-lighter inset sheet, hairline-bordered, shadow-free, for primary navigation. `.p-band` is the floating-plane container for grouped content (translucent background, `plane-grad` gradient, blur, `edge` + `float` shadow) with `.p-bandh` as its header row. `.p-cmd` is the existing command-bar treatment (mono type, plane background, hairline border, blur, text cursor) and is the correct base for any new omnibar/search input rather than a hand-rolled input style. `.p-tag` renders object tag/status values in the muted tag palette. `.p-kbd` renders keyboard-shortcut hints with a bottom-weighted hairline border reading as a physical key. Radius is chosen by element role, not by component type, so sibling elements always share a tier: `chip` (5px) for pills/tags, `control` (7px) for buttons/inputs/tabs, `row` (10px) for list rows, `band` (15px) for cards/panels, `pill` (20px) fully rounded.

## Do's and Don'ts

- Do reuse `.p-band`, `.p-rail`, `.p-cmd`, `.p-tag`, `.p-row` before writing any new class; the vocabulary already covers sheet/float/well/nav/tag.
- Do keep `accent` scoped to pending-decision/tension states only; use `teal`/`navy`/`amber` for calm status and progress.
- Do respect `prefers-reduced-motion` (the theme already zeroes `--motion` under that query); any new transition must read `--motion`/`--ease` rather than a literal duration.
- Don't introduce a new hex literal outside `porcelain-theme.css`; consume the CSS custom properties.
- Don't use gradient text, glassmorphism as a default treatment, side-stripe borders, hero-metric templates, or repeated identical card grids; these are standing project-wide bans.
- Don't reach for a modal as the first affordance; inline and progressive disclosure are the porcelain default.
