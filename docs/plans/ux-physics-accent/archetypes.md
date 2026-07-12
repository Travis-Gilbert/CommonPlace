# Screen archetypes (SPEC-UX-PHYSICS D8: steal IA per screen)

Each primary CommonPlace screen names the reference product whose information
hierarchy it borrows. The rule the spec sets: a new contributor should be able to
predict where an action lives on a screen by knowing its archetype. This file is
the registry; each screen's source file carries a one-line header comment naming
its archetype and pointing back here.

The point is not visual mimicry. It is hierarchy: what gets the most weight, where
the primary action sits, what is chrome and what is content. We keep the porcelain
register (oxblood asks, gold shows) and the warm/neutral tokens; we borrow only the
layout logic.

## The archetypes and where they live

| Screen | Archetype | Why this archetype | Source file |
|---|---|---|---|
| Object lists (Library lenses, records) | Linear: row-and-drawer | A dense, scannable list of objects; selecting one opens a detail drawer without leaving the list. The list is the surface; the drawer is transient. | `components/commonplace/views/ProjectListView.tsx`, `components/v2/record-table/*`, `components/v2/surface/RecordSurface.tsx` |
| Run / decision Ledger (Workrooms) | Railway / Vercel deploy-log | A run is a stream of real steps with states (queued, running, done, failed). The log is the spine; the newest event has the most weight; steps expand for detail. No invented progress bars. | `components/commonplace/control-center/AgentWorkroomControlCenter.tsx`, `app/v2/workrooms/page.tsx` |
| Receipts | Stripe drawer | A receipt is an immutable record of what happened and what it cost. It opens as a right-hand drawer over the run it belongs to: line items, totals, timestamps, provider. | Receipt views inside `AgentWorkroomControlCenter.tsx` |
| Approvals | PR-review-card | A pending decision is a card you accept or reject, with the change and its provenance visible on the card. Accept is the oxblood action; the card leaves the queue on decision. | `components/commonplace/engine/PromotionQueueView.tsx` |
| Data Ledger | Airtable / Linear table | Every item is a row; sort by any column; the table is the whole surface. Scale engine (Glide Data Grid) is reserved for millions of rows. | `app/v2/ledger/page.tsx` |
| Index (briefing) | Superhuman / inbox triage | A prioritized briefing: what needs you first, then the rest, grouped into bands. The top band has the most weight. | `app/v2/index/*`, `lib/commonplace/index-queries.ts` |
| Feed (networks) | Activity feed | A reverse-chronological stream of nodes; uniform rows; the newest at top. | `components/networks/InboxFeed.tsx` |
| Temporal evolution | Monitoring dashboard | The chart carries the most visual weight; controls are chrome. (Already labeled in-file before this pass.) | `components/commonplace/views/TemporalEvolutionView.tsx` |
| Agent thread | Streaming transcript (chat) | A heterogeneous, streaming conversation; the last item mutates as tokens arrive; auto-scroll to newest. Not a uniform list. | `components/commonplace/views/AgentThreadView.tsx` |

## Reading this in the source

Each screen file above names its archetype in a header comment, for example:

```tsx
/* Screen archetype: Railway/Vercel deploy-log (SPEC-UX-PHYSICS D8, see
   docs/plans/ux-physics-accent/archetypes.md). The run stream is the spine;
   the newest step has the most weight; steps expand for detail. */
```

## What UX-D8.2 (targeted refactor) does and does not do

D8.2 binds the existing real data into these hierarchies and reskins with tokens.
It is not a rebuild. Where a screen already matches its archetype's hierarchy (the
Data Ledger is already a sortable table; the Promotion Queue is already accept/reject
cards), the refactor is only the header-comment label plus any small hierarchy nudge.
Where a screen diverges, the nudge is bounded and uses existing tokens, never a new
visual system.
