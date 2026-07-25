---
title: ConsoleBlockHost product seed vs test seed must stay dual-path when CS8 shrinks fresh installs
kind: gotcha
date: 2026-07-25
scope: apps/console (ConsoleBlockHost.hydrateLayout)
---

## trigger_case (the real scar)

SPEC-COMMONPLACE-CONSOLE-SHELL CS8 required a fresh profile to land only
`/v/chat`, `/v/index`, `/v/data-model`. Hydrate was switched to
`buildSeedViews()` for `restored == null`. Immediately,
`console-host.test.ts` failed: move/update/activate cases still expected
legacy ids (`region-editor`, `workspace.region-files`, `console-workspace`,
`vi-code`). One assert went from 10 surfaces to 13 (or 3) and move tests
could not find legacy nodes.

## rule_short

When shrinking the product fresh seed, keep a dual hydrate path: product
(`records === null`) gets the shell seeds; hosts constructed with an
explicit `records` pool (including `records: []`) keep `seedLayout()` so
arrangement tests stay on the rich IA. Do not make HTTP-only tests pass
`records: []` just to "fix the seed" — that flips them onto the local
query path and breaks fetch assertions.
