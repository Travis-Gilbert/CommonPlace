# Console Shell 1.1 (CS11–CS20) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/console` to SPEC-COMMONPLACE-CONSOLE-SHELL-1.1: launch rail of five, frame without toolbar, shared island anatomy, degradation contract, honest indicators, labels/mono, transcript/composer, polymorphic rows, and three render-defect fixes.

**Architecture:** Shell chrome shrinks to sidebar + island well + metadata status line. `PLACE_ENTRIES` and seed views define the launch set. `BlockShell` owns identity/control/body. New `lib/degradation.ts` and `dev/type-audit.ts` unify failure and type semantics. Views keep routes; blocks stay inside views.

**Tech Stack:** Next.js console app, react-resizable-panels, jotai/shell-store, Vitest, existing Int UI tokens.

## Global Constraints

- No new dependencies.
- No CS1/CS2/CS4/CS6/CS9/CS10 reversals.
- No em/en dashes in comments or UI strings.
- Indexer (survey sphere) layout stays byte-identical; rename to Researcher is product language only where the launch set says so.
- Surfaces removed from the rail stay reachable via layout switcher / Blocks palette.
- TDD for pure modules (`degradation`, `type-audit`, rail model, seed views).

## Verify First findings (2026-07-26)

- Rail entries: 7 places (all `tier: 'place'`) + 5 collections (`tier: 'collection'`). Surface seed `role` is `place` / `collection`.
- Floating Add Note / Add Browser: `HostCapabilityRailBridge.tsx`, absolute `bottom-3 right-3` under `data-shell`, mounted from `IntuiShell`.
- Two BlockShells: `blocks/BlockShell.tsx` (primary island) and `block/BlockShell.tsx` (legacy material).
- Files/Index polymorphic rows live in `views/FilesView.tsx` and Survey/Index views today; extract or reshape in place per CS19.
- `Live feed stale` incorrectly uses `setProgress` in `console-host.ts`.

## Task map

### Task 1: CS11 Launch rail + seeds
### Task 2: CS12 Frame loses toolbar + selection accent + capability rail relocate
### Task 3: CS13 + CS16 Status line and honest indicators
### Task 4: CS15 Degradation module
### Task 5: CS14 Island anatomy
### Task 6: CS17 Labels + mono + type-audit
### Task 7: CS18 Transcript + composer
### Task 8: CS19 Polymorphic rows
### Task 9: CS20 Three render defects
### Task 10: Acceptance report + gates
