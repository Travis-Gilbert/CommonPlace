# Planning-Theorem Artifact: Console chat surface

Register: planning projection of HANDOFF-CONSOLE-CHAT-SURFACE, inheriting
SPEC-MATERIAL-REGISTER-1.0 where feasible. Paper MCP plus ShaderSurface are
first-class design inputs, not optional polish.

Harness note: `plan create` on the substrate was unavailable this session
(user-theorems-harness and product plugin MCP failed live discovery). This
file and `.harness/checklists/console-chat-surface--plan-local.json` are the
executable board until a head can mint a Plan node and re-render.

## Executive Summary

- Goal: ship the designed `/chat` surface (composer + multibuffer thread) on
  assistant-ui primitives, with material-register elevation, radius, shader,
  and empty-state law.
- Intent: close the named defects (triple unavailable copy, bubble thread,
  parallel sheen canvas) without inventing a second material system.
- Summary of work: Paper state matrix first, then tokens/CH4, composer rebuild
  through ShaderSurface, ThreadView multibuffer, chips, gates.

## Not done (status lead)

- Playwright e2e suite not re-run this session (CH5 partial): signatures and
  console-ia expectations updated for ShaderSurface; need a green e2e pass
- Substrate Plan node still unminted (Harness MCP down at plan time)
- FORME receipt texture: deferred; see FOLLOWUP-FORME-DISCHARGE-TEXTURE.md
- Paper focused/disabled cards still need stronger visual differentiation from
  idle (state labels are correct; chrome deltas are thin)

## Current Condition

| Area | Evidence |
|---|---|
| Composer | `apps/console/src/components/composer/Composer.tsx` (17941 bytes), assistant-ui primitives already in use; placeholder carries unavailable copy |
| Sheen | `ComposerSheenCanvas.tsx` declared in `DECLARED_PAINT_SURFACES`; parallel to `ShaderSurface` |
| Thread | `ThreadView.tsx`: User/Assistant bubble shells, AgentPlan block, starter slots with duplicated refusal |
| Material | D1 through D6 largely done: `--ij-tier-*`, radius scale, `ShaderSurface`, `MATERIAL_MAP`, `EmptyRegion` |
| Focus | Cmd/Ctrl-L already in `IntuiShell.tsx` |
| Deps | `@assistant-ui/react` 0.12.28, `@paper-design/shaders` 0.0.77 pinned |
| Transport | `NEXT_PUBLIC_CONSOLE_CHAT_URL` / `railway.console.toml` |
| Paper | Island Shells file: Composer anatomy + Material elevation tiers present |

## Intent

Make `/chat` read as one designed instrument: a Theorem-proportioned composer
(claude.ai inspiration, register paint) and a Zed-shaped multibuffer thread
(excerpts, not bubbles), inheriting the material register axes so elevation,
keyline, radius, shader, and empty cause stay one grammar with the rest of the
console.

## Goal

- User-visible: centered 760px thread, lower-third composer, one unavailable
  notice, collapsible tool/object excerpts, presence-mark send states, chip
  starters on the token seam.
- System: composer remains the B9 block mount; island compact density inherits
  with zero composer-specific IslandShell chrome.
- Data: object pull-in through existing `BlockHost` / object seam; no chat
  backend changes.
- Operational: `pnpm gates` green; Playwright covers unavailable-once and
  focus shortcut.
- Must not regress: Cmd/Ctrl-L focus, presence mark as sole agent glyph,
  register fence, shader context budget, reduced-motion static paint.

## UI Visual Milestone

| Gate | Requirement | Evidence/validator | Status |
|---|---|---|---|
| Runtime complete | Code mounts and responds | unit/e2e + `pnpm gates` | planned |
| Product complete | Equal-or-better vs baseline chat | before/after + Paper targets | planned |
| Vision complete | Multibuffer + material inheritance | Vision Delta below | planned (partial after slice if Research/Code variants remain out of scope) |
| Baseline capture | Current `/chat` screenshots | Playwright or manual capture | planned |
| Target references | Paper artboards + material tiers | Paper MCP `get_screenshot` / `get_jsx` | in progress (existing Composer anatomy + D1 tiers) |
| Do Not Downgrade | No bubble loss of plan/tool visibility; no second accent in instrument row | screenshot review | planned |
| Reversible boundary | Keep ThreadView density prop and IslandShell mount; sheen removal behind ShaderSurface swap | commit boundary | planned |

## Vision Delta

- Target vision: one scroll of typed excerpts with sticky headers; composer as
  raised island with sunken input well and ShaderSurface lit edge; chips and
  status on the material token seam; grayscale still separates human/agent by
  face and weight.
- Current visual condition: bubble messages, dual refusal copy, legacy sheen
  canvas, `max-w-4xl`, chips as generic raised buttons.
- This plan makes true: CH1 through CH5 on `/chat`; Paper state matrix; sheen
  decision executed through ShaderSurface; material tier/radius inheritance.
- This plan does not make true: Research/Code chat variants; FORME
  Undischarged/Refused textures on receipts (until backend); sidebar; nesting
  radius lint automation left open on the material plan.
- Visual downgrade risks: collapsing plan/tool rows into opaque bubbles;
  washing text behind shader paint (forbidden by material named choice 7);
  reintroducing floating/docked chat chrome (banned).
- Remaining gaps after slice: island mini-composer visual polish inherits
  IslandShell handoff; texture axis beyond Deterministic.

## Material inheritance map

Material register axes applied to chat (no second meaning per axis):

| Axis | Chat application |
|---|---|
| Lightness tier | Thread column on `ground`/`editor`; excerpt and composer shell `raised` with keyline; input well `sunken`; mention popover `floating` (shadow OK) |
| Keyline | Composer and excerpt borders use seam tokens; no shadow on raised |
| Hue | Kind edge markers on object excerpts only; never status color on instrument row |
| Texture | Deterministic via ShaderSurface on composer chrome only; content stays flat above |
| Radius | Composer shell `--ij-radius-lg` (12, island); chips `--ij-radius-xs` or sm per handoff 8px chip; nested input radius = parent minus gap |
| Type weight/size | Human Manrope 15/500 in composer and human excerpts; agent IBM Plex; headers JetBrains Mono 11; model JetBrains Mono 12 |
| Motion | Streaming owns PresenceMark + optional speed=0 shader; no decorative sheen loop outside inventoried motion |
| Empty | Unavailable and empty thread use `EmptyRegion` / one status slot causes, never placeholder-as-error |

### Named sheen decision (CH1)

**Replace `ComposerSheenCanvas` with `ShaderSurface`.**

Reason: material register D6 and AGENTS ledger require chrome paint through the
owned ShaderSurface seam (context budget, reduced-motion, token-derived
colors, motion-gate `getContext`). A second 2d sheen canvas is a parallel
paint system. Lit top edge = ShaderSurface behind the content plane (or a
dedicated edge strip), `staticOnly` when idle, amplitude/speed only under
streaming if inventoried; text and controls remain on a flat plane above.

Record this decision in the Composer file header when CH1 lands. Remove
`ComposerSheenCanvas` from `DECLARED_PAINT_SURFACES` after the swap.

## Codebase Grounding

| Area | Path |
|---|---|
| Composer | `apps/console/src/components/composer/Composer.tsx` |
| Sheen (retire) | `apps/console/src/components/composer/ComposerSheenCanvas.tsx` |
| Thread | `apps/console/src/views/ThreadView.tsx` |
| Shader | `apps/console/src/components/material/ShaderSurface.tsx` |
| Materials | `apps/console/src/lib/material/materials.ts` |
| Empty | `apps/console/src/components/material/EmptyRegion.tsx` |
| Presence | `apps/console/src/components/mark/` |
| Focus | `apps/console/src/components/shell/IntuiShell.tsx` |
| CM theme | `apps/console/src/views/cm-register-theme.ts` |
| Registers | `int-ui-register*.css`, `register-bridge.css` |
| Endpoint | `apps/console/src/lib/state/thread-state.ts`, `railway.console.toml` |

## Orchestration Map

| Work type | Route to | Why |
|---|---|---|
| Paper state matrix | Paper MCP + design brief | Handoff choice 8 |
| Token/register | console register + bridge | CH4 |
| Composer rebuild | execute on CommonPlace | CH1, CH5 |
| Multibuffer thread | execute on CommonPlace | CH2 |
| Gates / e2e | `pnpm gates`, Playwright | acceptance |
| Substrate plan mint | harness `plan create` when MCP recovers | continuity |

## Checklist

| ID | Task | Spec backref | Codebase grounding | Acceptance | Proof | Status |
|---|---|---|---|---|---|---|
| CH0 | Paper: design brief + artboards for composer states (idle, focused, streaming, interrupted, disabled, endpoint-refused) and multibuffer excerpt anatomy; extract via `get_jsx` / `get_computed_styles` | Handoff choice 8, CH5 | Paper Island Shells file | Six composer states + excerpt anatomy reviewed by screenshot | Paper screenshots | pending |
| CH1a | Retire sheen canvas; mount ShaderSurface as lit edge / chrome behind content; update motion inventory | Handoff CH1 + Material D6/choice 7 | Composer.tsx, ShaderSurface, motion-tokens | Header records sheen decision; no second paint canvas; gate:motion passes | `pnpm --filter console gate:motion` | pending |
| CH1b | Rebuild composer anatomy to named metrics and typography; status slot owns unavailable once; placeholder never errors | Handoff choices 2-4, CH1, acceptance 1 | Composer.tsx, app.css, PresenceMark | Metrics match; one notice; Manrope 15/500; send 32px presence rules | Playwright unavailable-once + visual | pending |
| CH2 | Evolve ThreadView to multibuffer excerpts (sticky 24px header, collapse, tool default collapsed, object pull-in, CM code, jump strip >1200) | Handoff choice 5, CH2, acceptance 3-4 | ThreadView.tsx, new excerpt component, cm-register-theme | Tool + object excerpts collapsible; grayscale face/weight separation | component tests + screenshot | pending |
| CH3 | Restyle suggestion chips to token seam (h32, IBM Plex 13, island base, radius 8) | Handoff choice 6, CH3 | ThreadView StarterSuggestions | No free-floating pill styling; radius token | gate:register + visual | pending |
| CH4 | Add composer/excerpt tokens to registers and bridge; regenerate manifest | Handoff CH4 | int-ui-register*, register-bridge, token-manifest | Tokens named; no raw hex in components | gate:register + manifest refresh | pending |
| CH5 | State coverage wiring: each Paper state renders once in product | Handoff CH5, acceptance 1/5 | Composer + ThreadView | Idle/focus/stream/interrupt/disabled/refused distinct; one accent in instrument row | Playwright matrix | pending |
| CH6 | Placement: thread max-width 760 centered; composer width matches; IslandShell compact mount has zero composer-specific container styling | Handoff choice 1/7, acceptance 2/6 | ThreadView, registry, IslandShell consumers | Cmd/Ctrl-L still focuses; island inherits | e2e focus + mount inspect | pending |
| CH7 | Full gates | Acceptance 7 | apps/console | `pnpm gates` passes | CI command | pending |

## Test Strategy

- Preflight: capture current `/chat` screenshots (baseline).
- Focused: unavailable-once DOM assertion; excerpt collapse; object seam open.
- Visual: grayscale human vs agent; presence mark streaming/interrupt.
- Static: fence, register, contrast, motion, icons, radius lint.
- Manual: Paper vs product comparison for each CH5 state.
- Perf: ShaderSurface stays inside `SHADER_CONTEXT_BUDGET` with thread open.

## Production Gates

- [ ] Tests pass or failures explained
- [ ] No chat backend scope creep
- [ ] No secrets introduced
- [ ] Unavailable and empty causes named
- [ ] Rollback: revert CH1a sheen swap and ThreadView excerpt module independently
- [ ] UI Visual Milestone reconciled in execution report
- [ ] Do Not Downgrade reviewed before Product complete
- [ ] Checklist rows reconcile to handoff deliverables and material inheritance map

## Epistemic Ledger

| Primitive | Entry | Evidence | Confidence | Action |
|---|---|---|---|---|
| Claim | Material D1-D6 largely shipped | material-register implementation-plan.md | high | inherit, do not rebuild |
| Claim | Unavailable is duplicated today | Composer placeholder + ThreadView starters | high | CH1b closes |
| Decision | Sheen -> ShaderSurface | Material choice 7 + D6 | high | CH1a |
| Tension | Harness plan substrate unavailable | MCP discovery error | high | local checklist projection; mint later |
| Question | Chip radius: handoff says 8 (`--ij-radius-md` panels) vs scale xs/sm for chips | register comments map xs=4 chips, md=8 panels | medium | use `--ij-radius-md` only if chip height 32 reads as panel step; else introduce explicit chip token in CH4 |

## Explicit Non-Goals (handoff already named)

Sidebar; Research and Code chat variants; assistant-ui upgrades; chat backend
changes. These are out of scope without new consent.

## Deferral (accepted 2026-07-23)

Undischarged / Refused texture on tool-receipt excerpts is deferred until FORME
DischargeState is reachable. CH2 ships Deterministic chrome only.

Backend follow-up note:
[FOLLOWUP-FORME-DISCHARGE-TEXTURE.md](./FOLLOWUP-FORME-DISCHARGE-TEXTURE.md).

## Execution Instructions

1. Confirm or reject the deferral above.
2. CH0 in Paper (extend Island Shells; do not invent a second design file).
3. CH4 tokens as needed for anatomy, then CH1a/CH1b, then CH2/CH3/CH5/CH6, then CH7.
4. Preserve: presence mark monopoly, register fence, shader budget, 760px ban on floating/docked chat.
5. Report with Runtime / Product / Vision labels separately.

## Paper design brief (CH0 start)

Posted before mutating Paper, per Paper MCP rules. Register stays canonical;
Paper stages states against live anatomy.

- Mood candidates: instrument, mineral, phosphor, editorial, gallery
- Mood chosen: **instrument** (not phosphor): console chrome is measured
  tooling, not CRT nostalgia; matches JetBrains dimensions and material tiers
- Palette roles (from live register, not new hex in product): ground, sunken,
  raised+keyline, floating+shadow, accent for send only, ink / ink-info
- Type: Manrope 15/500 human input; IBM Plex Sans agent and chips; JetBrains
  Mono 11 headers and 12 model
- Direction: nested sunken well inside raised island; multibuffer excerpts as
  stacked raised strips with sticky mono headers; shader only under chrome,
  never under text
