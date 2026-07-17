# Hunk review on the Greenfield Console

Date: 2026-07-17

PR: `Travis-Gilbert/CommonPlace#56`

Baseline: Greenfield Console and Int UI register from PRs #57 and #58

## Vision Delta

The original Hunk PR mounted a review component inside the legacy
`apps/web` AgentThread route and painted it with a second component-local
palette. The Greenfield design makes every user surface a registered view over
an `ObjectQuery`, hosted in an arrangement described by `surface`, `region`,
and `view-instance` objects.

This revision moves the review surface to `apps/console` as the
`hunk.review` descriptor. A named `Review` surface carries the route, the
view queries typed `hunk` objects through the same-origin object seam, and
accept/reject/verify/edit emit named `invoke_tool` actions through
`BlockHost`. The view does not compile proposals or classify discharge; those
remain Rust-owned.

The adapter is bound to the paired Rust serialization rather than the first
legacy fixture: sources are snake-case (`agent_run`, `app_install`), while
`state` and `discharge` are internally tagged objects whose discriminator is
`kind`. Transparent Hunk, block, value, group, and verification references
remain strings on the wire.

## Runtime, product, and vision completion

| Layer | Requirement | Evidence |
| --- | --- | --- |
| Runtime | Hunk queries and executor actions ride `/api/objects/query` and `/api/objects/action`. | `ConsoleBlockHost` contract test and Playwright stub upstream. |
| Product | Five sources share one renderer; verify-first, human discharge, grouping, keyboard actions, CM6 merge, and nested descriptor resolution remain available. | Unit contract tests and `hunk-review.spec.ts`. |
| Vision | Review is a Greenfield surface and uses only the Int UI/REC register. | Register gate and `hunk-review-1440-dark` screenshot. |

## Do Not Downgrade

- Do not mount Hunk review back into `apps/web` or a bespoke AgentThread card.
- Do not compile, classify, auto-accept, or mint synthetic receipts in React.
- Do not bypass `ViewInstanceHost`, `ObjectQuery`, or `BlockHost.emit`.
- Do not add raw colors, arbitrary metrics, CSS modules, or a second motion
  vocabulary beside the Int UI register.
- Do not replace text merge with a hand-built diff or structured values with a
  JSON-only fallback when a registered descriptor is supplied.
- Do not make an undischarged hunk one-click acceptable; sovereign human
  accept remains an explicit secondary action and sets `human_discharge`.

## Reversible boundary

The previous legacy component is removed from this PR rather than left as a
second product path. PR #56 remains a draft while its Hunk wire depends on the
Theorem H1/H2 executor PR. The existing Workspace, Index, and Documents
surfaces and all PR #58 visual baselines remain unchanged; Review is an
additional seeded arrangement and can be removed by deleting only its surface
objects and descriptor registration.
