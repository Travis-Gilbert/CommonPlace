# Strangler census: what apps/web shipped, and where each capability goes

Purpose: the cutover gate. The console replaces `apps/web` at the primary domain only when this ledger shows a functional superset or a deliberate kill for every row. Seeded from PR titles 1 through 55 (pre-console history) on 2026-07-17; the deep pass below upgrades each row from title-level to capability-level.

Classification lanes:
A carried already (contract or package extracted, console consumes)
B re-lands via an existing spec (named)
C dies deliberately (presentation or superseded; named so it is a decision, not amnesia)
D backend or protocol, unaffected by the frontend pivot
E open question, needs a disposition decision
F separate app (mobile, desktop shell), unaffected

## Seeded ledger

| PRs | Capability | Lane | Disposition |
|---|---|---|---|
| 9, 13, 17, 19, 20, 25, 26, 27, 28, 50, 51, 52 | Porcelain v2 shell, register, UX physics, design-taste lane | C | Paint and shell die; the governance habits already carried into the console constitution |
| 14, 24, 31, 36, 49 | Object and annotation foundation, operator live contracts, PUBLISH and CARRY, BFF endpoints | D | Backend; console consumes through the same seams |
| 42, 43, 54, 55 | ACP chat transport, hosted ACP, assistant bridge | A | Transport carried; console chat route built in round 2 |
| 40, 41 | Harness memory as Files (OKF, REST) | B | Superseded by SPEC-HARNESS-MEMORY-PROJECTION; console landing is HANDOFF-CONSOLE-IA I3; engine deliverables dispatch to Theorem repo |
| 21, 8 | SceneHost, patent renderer, tool cards | B | Carries as packages/scene-host per AMENDMENT-SCENE-OS-INTUI |
| 53 | Margin recall (salience, annotation store, overlay) | B | Rust and contracts carry; overlay UI re-lands with co-browse in the console; salience already reused by Context companion and action auto-suggest |
| 7, 37, 44 | Data views, lens-index, Chat and Index on the inquiry layer | B | Console Index and record surfaces supersede; inquiry layer is the backend seam |
| 18 | Twenty reconstruction TW1-TW7 surfaces | C | Superseded by the extracted-values approach (TWENTY-APP-VALUES); worth one read in the deep pass for record-surface behaviors worth keeping |
| 16 | Reconstruction frontend phase 4 (TypeScript viewers) | E | Disposition against the reconstruction north star; likely B into scene-host descriptors |
| 6, 23 | Vector space atlas | E | Likely re-lands as a cosmos.gl editor document; needs a read |
| 22 (draft) | Anytype-backed database surfaces | E | Open pre-pivot draft; reconcile against the record surface and Model surface before any further work |
| 33 (open) | Co-browse surface and Presence mark | E | Open pre-pivot PR on the porcelain branch; the mark shipped separately in the console; co-browse re-targets per HANDOFF-COBROWSE-PRESENCE when desktop work resumes |
| 30, 34 | Operator library controls, crawl triggers | E | Capability belongs in the console (likely Command mode actions plus a tool window); needs a read |
| 11 | Control center security guard | D | Pattern re-applies to console routes at deploy time |
| 1, 5, 10 | Mobile app, Capacitor | F | Separate app, untouched by the pivot |
| 29, 32, 38, 45, 46, 47, 48 | Railway build fixes | D | History; console has its own deploy wiring |

## The deep pass (dispatch)

For every row marked E, and for rows 18, 30, 34: read the PR body and the shipped code, write the capability inventory (what a user could do), and upgrade the row to A, B, C, or D with a one-line disposition. Where a capability has no console home, name the future descriptor or handoff that owns it. The pass runs cheapest in-repo (gh pr view, gh pr diff) and lands as edits to this file.

## The superset gate

Cutover of the primary domain requires: every row A, B, C, or D; every B either landed or scheduled with a named handoff; and the five-minute tests of the landed handoffs passing on the deployed console. Until then the console ships alongside (decision log item 16).
