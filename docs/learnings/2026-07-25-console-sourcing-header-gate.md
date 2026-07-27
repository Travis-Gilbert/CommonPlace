---
title: apps/console Write gate rejects new sources without a SOURCING header
kind: rule
date: 2026-07-25
scope: apps/console (Write / component-sourcing)
---

## trigger_case (the real scar)

Creating `apps/console/src/dev/hue-audit.ts` without a leading SOURCING
comment was blocked by the Write tool: "New source surface requires a
SOURCING decision" with the three allowed forms (`named upstream`,
`hand-roll`, `none`). The file only landed after
`// SOURCING: none. Pure logic, no upstream component applies.`

## rule_short

Before writing any new file under `apps/console/src/`, put a SOURCING
header in the first lines. Use `none` for pure logic, a named ledger
library + mode for adopted UI, or `hand-roll` only when the ledger /
sourcing spec has no upstream for that meaning.
