# Model Canvas Fork and Program Canvas Borrowings Implementation

Date: 2026-07-29

This record reconciles:

- `SPEC-COMMONPLACE-MODEL-CANVAS-FORK-1.0`
- `langflow-borrowings-program-canvas`

The implementation is split across CommonPlace for every user-facing surface
and Theorem for registry, OKF, programmable-graph, sandbox, and tool contracts.
It extends the existing feature branches instead of rebuilding completed work.

## Model Canvas

| Deliverable | Source-local result | Acceptance boundary |
| --- | --- | --- |
| MF1 | OWOX/models is preserved as an Apache-2.0 hard fork in `packages/model-canvas`; prohibited services and product chrome are absent; the package builds and tests. | A rendered network trace remains required because no browser was connected during this run. |
| MF2 | `canvas.model.*` uses the same object-seam store as `canvas.inspector.rail`, with layout-only serialization, debounce, and refusal on failed hydration. | The env-gated test still needs a live Railway restart and re-login run. |
| MF3 | The fork adapter renders the generated observed and declared model contracts, observed ghosts, typed fields, field anchors, cardinality, and counts. | A live cross-door registry mutation remains a deployed acceptance check. |
| MF4 | Ghost declare and field edits use the canonical registry mutation doors with anchors, receipts, and verbatim refusal messages. | A live conflict receipt remains a deployed acceptance check. |
| MF5 | `rustyred-thg-okf` owns the model profile, import preview, atomic declaration batch, byte-stable export, and extension preservation; `@commonplace/okf` is the portable preview renderer. | Third-party OKF preservation remains an external-tool oracle. |
| MF6 | Schema history stores canonical version projections; diff compares tables, fields, and joins; restore creates a new atomic declaration version with receipts. | The final visual history and restore flow remains a browser acceptance check. |
| MF7 | Verify First found no registry-projection consumer contract in `theorem-canvas-compile`. Its actual contract compiles semantic CanvasDoc and Graph Lisp state. | Blocked pending a spec amendment or a new versioned registry projection contract. The implementation does not substitute `compileDeclaredModel` or force Program CanvasDoc into the ERD. |

## Langflow borrowings

The feature patterns are adopted without importing Langflow code or its
server-side execution model.

| Borrowing | Implementation |
| --- | --- |
| 1. Playground | Program Canvas includes run, node inspection, input/output views, and spill handles. |
| 2. Node events and drain law | Theorem emits node-scoped started, output chunk, finished, error, and cached events; terminal state is appended after buffered output. |
| 3. Pin | Run options carry explicit pinned values; receipts and the canvas identify cached stale choices until unpinned. |
| 4. Tweaks | Per-run overlays are separate from ProgramDefinition identity and are recorded verbatim in the run receipt. |
| 5. Program as node | Published programs enter the catalog with declared ports and use the same edge-schema validation as other nodes. |
| 6. Publish is a tool | Publishing registers a generated, callable MCP tool whose schema comes from the program contract and whose result includes the run receipt. |
| 7. Human input | Human-input execution parks durably with a resume token and visible parked liveness, then resumes through the apply tool. |
| 8. Starters | Empty Program Canvas state is served from the starter-program catalog rather than a console fixture. |
| 9. Lifecycle | Catalog entries carry beta and legacy lifecycle metadata rendered in the palette. |
| 10. In-canvas authoring | QuickJS runs through durable code mode and WAT runs through the existing Extism host with no grants and finite limits. Ports remain BlockContract-derived and schema-validated. |

Declines 11 through 13 remain laws: no serving-runtime evaluation of authored
code, no application-database flow blobs, and no wholesale Langflow UI import.

## Local oracle summary

- `rustyred-thg-mcp` authored-code sandbox tests: 8 passed.
- `rustyred-thg-mcp` tenant-scope GraphQL integration: passed.
- `rustyred-thg-mcp` OKF preview/import/export integration: passed.
- `rustyred-thg-okf`: 29 tests passed.
- Rust-generated `@commonplace/program-contracts`: drift check, test, and
  typecheck passed.
- `@commonplace/model-canvas`: 45 tests passed and typecheck passed.
- `@commonplace/okf`: 54 tests passed and typecheck passed.
- Focused CommonPlace model, program, and canvas store suite: 26 tests passed;
  the two env-gated live tests were discovered and skipped.
- Console fence, contrast, radius, motion, icons, sourcing, tokens, paper
  shader, persistence, and canonical-root gates passed.
- Register and block gates retain pre-existing branch failures outside the
  touched Model and Program Canvas files. The patch-local raw hue failure is
  resolved through semantic register tokens.

## Live oracle commands

Run the object-seam durability smoke with an admitted user and live Console
data door:

```bash
CONSOLE_LIVE_CANVAS_SMOKE=1 \
CONSOLE_LIVE_CANVAS_BASE=https://v2.theoremharness.com/api \
CONSOLE_LIVE_CANVAS_COOKIE='...' \
pnpm --filter @commonplace/console exec vitest run \
  src/lib/canvas/store.live.test.ts
```

Run the deployed browser acceptance with an authenticated storage state:

```bash
THEOREM_RUN_CANVAS_LIVE=1 \
THEOREM_CANVAS_LIVE_STORAGE_STATE=/absolute/path/to/storage-state.json \
pnpm --filter @commonplace/console exec playwright test \
  --config playwright.live.config.ts
```

Run the deployed product acceptance at `https://v2.theoremharness.com` with a
connected browser and record:

1. zero third-party Model Canvas network calls;
2. card layout surviving refresh, re-login, and a Railway restart;
3. cross-door registry invalidation, declare conflict, history diff, and
   restore receipts;
4. a live Program run stream, spill retrieval, durable human park, resume, and
   generated published-tool call.
