# Checkout consolidation census (C1)

**Status:** closed on `main` at `5a9f1e3` (PR #109). Native-shell salvage and
MaterialLayer both live on that tip.

Canonical day-to-day root:

`/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace`

Cloud / CI clones that carry `.commonplace-canonical` and MaterialLayer are also
valid product roots.

## Historical Mac clones (pre-consolidation)

| Clone | Path | Tip then | MaterialLayer | Unique then |
|---|---|---|---|---|
| Creative (canonical) | `…/Creative/Website/CommonPlace` | `e7d593c` | yes | island console lineage; large worktree forest |
| Tech Dev Local | `…/Tech Dev Local/CommonPlace` | `7ddca69` native-shell | no | second full clone; native-shell tip |

## Origin salvage outcome

| Ref | Outcome |
|---|---|
| `7ddca69` / `Travis-Gilbert/commonplace-native-shell-backend` | Merged via PR #112; ancestor of current `main` |
| `claude/console-desktop-export` (`3580480`) | Earlier salvage source; also on origin |
| `/private/tmp/cp-pr33`, `/private/tmp/cp-pr63` | Abandonable / prunable via host script |
| `Travis-Gilbert/cohesive-turn-routing` | On origin; host script rehomes under SSD worktrees if needed |

## Freeze rule

Do not open `Tech Dev Local/CommonPlace` as an agent root. One-shot retirement:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace"
git fetch origin && git checkout main
bash scripts/retire-techdev-clone.sh
```
