# Console Information Architecture 1.0

Spec: `SPEC-CONSOLE-INFORMATION-ARCHITECTURE-1.0` (Downloads handoff).
Companion: `docs/plans/material-register/SPEC-MATERIAL-REGISTER-1.0.md`.
Repo: CommonPlace `apps/console`.

## Verify First (confirmed 2026-07-23)

### V1. Kind set
Authoritative for the console: `BlockKindGlyph` in `packages/block-view/src/types.ts`
(15 glyphs). Theorem `ShapeRegistry` is not consumed. Console mirrors hues in
`kind-hues.ts`. No `hidden` / rail-surface flag exists yet; D2 adds
`railCollection` policy per glyph.

### V2. Rail classification (before change)
Dead entries in stripe radiogroup: **0**.

| Entry | Class |
|---|---|
| Chat, Workspace, Index, Documents, Cards | route destinations |
| Files, Context, Thread companions | dock panels (remove from rail) |
| Workspace Automation companion | dock panel (promote Automation to Place) |
| Landmarks Chat / Records | pins (keep; rename group Pins; drop seeded Chat landmark that duplicates Place) |
| Goal Stack / Review / Appearance / Proactivity / Account | unbuilt routes or secondary (not Places) |

Duplicate names: Chat (place + landmark), Records (landmark vs cards grid), Documents (surface vs list window).

### V3. Cards
Real card engine (`cards.grid` / `card.full`) over object queries with
`cards` kindGlyph. **Keep** as a collection destination; demote from Places.

### V4. Composer
Not a `ViewDescriptor`. Embedded in `chat.surface` / `chat.thread`. Chrome today:
outer raised card, 1px ShaderSurface lit edge, sunken input well, controls row.
Reclassification is a component change (D5/D6).

### V5. Connection reporters
`StatusBar` (authoritative always-on) + Sidebar footer (duplicate). Workspace
`Building` is readiness, not connection. No out-of-frame identity banner found
in current tree. D7: StatusBar sole owner; remove rail connection UI; keep
transport / identity / progress labels distinct.

## Named place set (closed)
Chat (`/chat`), Workspace (`/workspace`), Filing (`/filing`, label Filing),
Canvas (`/canvas`), Automation (`/automation`).

## Collections (derived)
Generated from `BlockKindGlyph` via per-kind policy. Place-owned and chrome
glyphs declare `hidden`. Surfaced collections include Documents, Cards, Files,
Records, Threads (plural; Chat keeps the place name), plus any future kind that
opts in.

## Checklist

| ID | Spec | Work | Status |
|---|---|---|---|
| D1 | Named 1,3,4 | Typed rail tiers; remove companions; unique names; Places resolve | done |
| D2 | Named 2 | Generate collections; no hand list; hidden policy | done |
| D3 | Cards | Keep as collection under registered `cards` glyph | done |
| D4 | Tier styling | Place / collection / pin weight + kind hue | done |
| D5 | Composer chrome | One container; delete lit edge and inset well | done |
| D6 | Composer states | Six states on one ShaderSurface; Paper fragments (paper-texture / grain-gradient / fluted-glass); stream-driven motion | done |
| D7 | Connection | One owner in StatusBar | done |
| D8 | Empty causes | Default actions: reconnect / clear / loading | done |
| G | System | Unit tests + contrast/motion/blocks gates pass; register gate blocked by pre-existing AgentAliasPane | partial |

## Classification table (after)

| Label | Tier | Destination |
|---|---|---|
| Chat | place | `/chat` |
| Workspace | place | `/workspace` |
| Filing | place | `/filing` |
| Canvas | place | `/canvas` |
| Automation | place | `/automation` |
| Documents | collection | `/documents` |
| Cards | collection | `/cards` |
| Files | collection | `/files` |
| Records | collection | `/records` |
| Threads | collection | `/threads` |
| Console brief / surface-tree.ts | pin | landmark drag / activate |

Companions remain layout dock panels (Alt+Shift); they leave the rail.
