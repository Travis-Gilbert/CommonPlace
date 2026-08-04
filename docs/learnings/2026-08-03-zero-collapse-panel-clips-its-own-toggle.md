---
title: A Panel collapsed to zero clips its own reopen control but keeps it in the a11y tree
kind: gotcha
date: 2026-08-03
scope: apps/console (IntuiShell + InspectorRail) — any react-resizable-panels collapsible Panel
---

## trigger_case (the real scar)

Making the console right rail a `collapsible` `Panel` with
`collapsedSize={0}` looked complete: collapse worked, reopen worked, sizes
persisted. The toggle lived inside `InspectorRail`, which now *is* the Panel's
content.

Measured it on the live dev server instead of trusting `offsetParent`:

```json
{"collapsed":{"panelW":0,"edgeInDom":true,"edgeRectW":40,
 "edgeIsHittable":false,"atEdgeCentre":"reopen-button"}}
```

`offsetParent` was truthy and the element still reported a 40px rect, so the
naive visibility check said "visible." `document.elementFromPoint` at the
button's own centre returned a *different* element. `Panel` sets
`overflow: hidden`, so at width 0 the control was painted nowhere and
clickable nowhere, while remaining a focusable, labelled button that a screen
reader would still offer. A dead "Open inspector rail" in the tab order.

## rule_short

For a `collapsible` Panel with `collapsedSize={0}`, the reopen affordance must
live **outside** the Panel, in a positioned ancestor owned by whoever holds
the collapsed state. The Panel's own content renders the collapse direction
only, gated on `open`. In this repo that is `InspectorRailReopen`, exported
from `InspectorRail.tsx` so the shell and the chrome preview mount one
definition.

Do not test control visibility with `offsetParent` or `getBoundingClientRect`
inside a clipped ancestor. Both lie. Use
`document.elementFromPoint(cx, cy)` and assert the hit element is the control,
plus assert the dead control is absent from the DOM, not merely hidden.
