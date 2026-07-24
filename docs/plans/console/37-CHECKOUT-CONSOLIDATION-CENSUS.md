# Checkout consolidation census (C1)

Canonical clone for this cloud run: `/workspace` on branch
`cursor/cloud-agent-1784908992752-gco9o`, tip includes MaterialLayer
(ancestor `e7d593c`). Same GitHub remote as both Mac clones:
`Travis-Gilbert/CommonPlace`.

## Mac clones (from prior session census; not reachable from this VM)

| Clone | Path | Tip then | MaterialLayer | Unique |
|---|---|---|---|---|
| Creative (canonical) | `…/Creative/Website/CommonPlace` | `e7d593c` | yes | island console lineage; large worktree forest |
| Tech Dev Local | `…/Tech Dev Local/CommonPlace` | `7ddca69` native-shell | no | local-only tip; browser-native / host-bridge |

## Origin salvage source

- `Travis-Gilbert/commonplace-native-shell-backend` (`7ddca69`): **not on origin** (404). Mac-only tip must be pushed from the Mac host during C4 host script, or is lost if never pushed.
- `claude/console-desktop-export` (`3580480`): **on origin**. Contains `apps/browser-native`, `packages/host-bridge`, `crates/browser-core`, `crates/interaction-arbiter`, console host wiring, native-shell docs/spec.

## Classification (Tech Dev Local branches from prior session)

| Branch | Class |
|---|---|
| `Travis-Gilbert/commonplace-native-shell-backend` | salvage (push from Mac if still present; else recover via `claude/console-desktop-export`) |
| `claude/console-desktop-export` | already on origin; salvage source |
| `/private/tmp/cp-pr33`, `/private/tmp/cp-pr63` | abandonable / prunable |
| `Travis-Gilbert/cohesive-turn-routing` | already on origin; rehome worktree under Creative if still needed |

## Freeze rule

Tech Dev Local must not be used as a primary agent root except for the
one-shot host retirement script (`scripts/retire-techdev-clone.sh`).
