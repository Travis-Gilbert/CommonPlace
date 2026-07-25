---
title: IntuiShell stays aria-busy forever unless the active surface has a kind=editor region
kind: gotcha
date: 2026-07-25
scope: apps/console (IntuiShell + seed-views)
---

## trigger_case (the real scar)

CS8 seed views used `kind: 'well'` for the main region (spec language).
`IntuiShell`’s `regionsOf` only promotes `properties.kind === 'editor'`
into `editor`, and the render path early-returns
`<div aria-busy="true" />` when `!root || !editor`. Chat/index/data-model
seeds therefore never painted content despite a valid surface tree.

## rule_short

Until IntuiShell understands a first-class well region, any surface it
must render needs one child region with `kind: 'editor'` (sunken well
material can still live on `material` / styling). Do not seed
`kind: 'well'` alone against the current shell.
