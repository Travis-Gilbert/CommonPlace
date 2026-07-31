# Merge order: canvas substrate stack

Four pull requests across two repositories land the model and program canvases
and the substrate beneath them. They are stacked, and the `check:generated`
drift gate compares a CommonPlace file against a Rust binary in the Theorem
repo, so merging out of order surfaces as a contract-drift failure that reads
like a code bug. This is the order and the reason for it.

| Step | PR | Base | Carries |
| --- | --- | --- | --- |
| 1 | Theorem#385 | `main` | Registry projections, OKF model profile, programmable-graph playground contracts, the ts-rs contract export |
| 2 | Theorem#392 | `feat/program-canvas-serving-1-0` | Provider facet on declared object types, registry-ERD projection spec |
| 3 | CommonPlace#143 | `main` | Model canvas fork, program canvas, `/Data-model` surface |
| 4 | CommonPlace#145 | `codex/model-program-canvas-mainline` | Canvas substrate, node-kind registry, edge language, provider badge, registry change signal |

## Why this order

**Theorem before CommonPlace.** `@commonplace/program-contracts` is generated
from `rustyred-thg-programmable-graph` by `export_program_contracts`, and
`check:generated` re-runs that binary against the checked-in TypeScript. The
Rust side has to be on `main` first, or the gate regenerates from a commit that
does not contain the types the console imports.

**385 before 392.** 392 adds `ProviderFacet` to the same export list 385
introduces. Rebased onto bare `main` its diff does not apply.

**143 before 145.** 145's base branch *is* 143's head. It adds a workspace
package both canvases depend on; on bare `main` neither canvas exists.

## At each step

Before merging a CommonPlace PR, point the drift gate at the Theorem commit
that is actually on `main`:

```bash
THEOREM_REPO=<path-to-theorem-checkout> pnpm --filter @commonplace/program-contracts check:generated
```

If it fails after step 1 or 2, the fix is to regenerate, not to hand-edit
`program.generated.ts`:

```bash
pnpm --filter @commonplace/program-contracts generate
```

After step 2 lands, retarget the CommonPlace PRs rather than rebasing them:

```bash
gh pr edit 145 --repo Travis-Gilbert/CommonPlace --base main
```

Do that only once 143 has merged. A diff anchored on specific blocks in
`ProgramView.tsx` and `registry.tsx` does not apply cleanly onto bare `main`.

## Shared-checkout note

`apps/console/src/views/program/` is worked by more than one agent at a time.
Binding-station work (`BindingStationTray.tsx`, the station fields on
`ProgramNode`, the `programClient` preset calls) belongs to a separate lane and
is deliberately **not** in #145. It needs `ProgramStationFields`,
`ProgramBindingPreset` and `StationDropReceipt`, which arrive with the
regenerated contracts, so it lands after step 2 like everything else.
